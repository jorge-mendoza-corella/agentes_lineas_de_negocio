#!/usr/bin/env node

const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const token = process.env.TELEGRAM_BOT_TOKEN_SEBAS || process.env.TELEGRAM_BOT_TOKEN;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

if (!token) { console.error('[SEBAS] FATAL: TELEGRAM_BOT_TOKEN_SEBAS no configurado'); process.exit(1); }
if (!anthropicKey) { console.error('[SEBAS] FATAL: ANTHROPIC_API_KEY no configurado'); process.exit(1); }

const bot = new TelegramBot(token, { polling: true });
const supabase = createClient(supabaseUrl, supabaseKey);
const client = new Anthropic({ apiKey: anthropicKey });

console.log('🎯 SEBAS PM Global iniciando...');
console.log(`📱 Token: ${token ? 'configurado ✅' : 'NO configurado ❌'}`);

const conversations = new Map();

const CLAUDE_TOOLS = [
  {
    name: 'log_bitacora',
    description: 'Registra una acción en la bitácora de actividad. Úsalo para cada decisión o acción importante.',
    input_schema: {
      type: 'object',
      properties: {
        agente:      { type: 'string', description: 'Nombre del agente, ej: pm-global' },
        accion:      { type: 'string', description: 'Descripción de la acción realizada' },
        proyecto_id: { type: 'string', description: 'UUID del proyecto relacionado (opcional)' },
        tarea_id:    { type: 'string', description: 'UUID de la tarea relacionada (opcional)' },
      },
      required: ['agente', 'accion'],
    },
  },
  {
    name: 'crear_tarea',
    description: 'Crea una tarea asignada a un agente especialista. SIEMPRE incluye plan_ejecucion con los pasos concretos.',
    input_schema: {
      type: 'object',
      properties: {
        agente_asignado: {
          type: 'string',
          enum: [
            'dev-pm','dev-analista','dev-backend','dev-bd','dev-frontend','dev-devops',
            'dev-testing','dev-diseno','dev-documentador','dev-seguridad','dev-ciberseguridad',
            'dev-redes','dev-soporte','dev-imagenes','dev-presentaciones','dev-videojuegos',
          ],
          description: 'Agente que ejecutará la tarea',
        },
        descripcion:       { type: 'string', description: 'Qué debe hacer exactamente el agente' },
        plan_ejecucion:    { type: 'string', description: 'Plan detallado: pasos numerados, comandos específicos, criterios de éxito' },
        proyecto_id:       { type: 'string', description: 'UUID del proyecto (opcional)' },
        requerimiento_id:  { type: 'string', description: 'UUID del requerimiento (opcional)' },
        rama:              { type: 'string', description: 'Rama de Git sugerida (opcional)' },
      },
      required: ['agente_asignado', 'descripcion', 'plan_ejecucion'],
    },
  },
  {
    name: 'actualizar_avatar_estado',
    description: 'Actualiza la animación del avatar de un agente en el dashboard.',
    input_schema: {
      type: 'object',
      properties: {
        agente_nombre:    { type: 'string', description: 'Ej: pm-global, dev-backend' },
        estado_animacion: { type: 'string', enum: ['idle','caminando','trabajando','hablando','celebrando'] },
      },
      required: ['agente_nombre', 'estado_animacion'],
    },
  },
  {
    name: 'consultar_proyectos',
    description: 'Obtiene los proyectos activos del sistema.',
    input_schema: {
      type: 'object',
      properties: {
        estado: { type: 'string', enum: ['activo','pausado','cerrado'], description: 'Filtrar por estado (opcional)' },
      },
    },
  },
  {
    name: 'consultar_tareas',
    description: 'Consulta las tareas registradas en BD.',
    input_schema: {
      type: 'object',
      properties: {
        agente_asignado: { type: 'string', description: 'Filtrar por agente (ej: dev-devops)' },
        estado: { type: 'string', enum: ['pendiente','en_progreso','completada','cancelada'] },
        limite: { type: 'number', description: 'Máximo de resultados (default 10)' },
      },
    },
  },
];

const SYSTEM_PROMPT = `# PM Global — Servicios Agénticos

**Tu nombre es Sebas.** Eres el Project Manager raíz que coordina todas las áreas de negocio.

## Tu identidad
- **Nombre:** Sebas
- **Rol:** PM Global
- **Funciones:**
  - Orquestar y coordinar agentes especialistas
  - Delegar tareas a agentes de desarrollo
  - Tomar decisiones estratégicas
  - Monitorear progreso real de tareas
  - Ser el único punto de contacto con stakeholders

## Libre albedrío — cuándo actuar

### 🟢 ACTUAR SOLO (sin preguntar)
- Crear tareas para agentes especialistas
- Registrar en bitácora cada decisión importante
- Animar avatares en el dashboard durante acciones

### 🟡 INFORMAR Y PROCEDER
- Cambios de arquitectura menores
- Modificar configuración con impacto visual

### 🔴 PEDIR CONFIRMACIÓN
- Eliminar datos de producción
- Cambios de seguridad irreversibles
- Gastos externos

## Flujo de trabajo

1. **Analiza** la solicitud y clasifica el nivel (🟢/🟡/🔴)
2. **Si es 🟢:** Usa \`crear_tarea\` para delegar. Registra en \`log_bitacora\`.
3. **Usa \`actualizar_avatar_estado\`** para animar tu avatar en cada fase (trabajando → caminando → idle)
4. Responde siempre en español. Sé conversacional, no robótico.

## Herramientas disponibles
- \`crear_tarea\`: Crea tareas para agentes
- \`log_bitacora\`: Registra decisiones en bitácora
- \`actualizar_avatar_estado\`: Anima tu avatar
- \`consultar_proyectos\`: Obtiene proyectos activos
- \`consultar_tareas\`: Consulta tareas reales`;

async function ejecutarTool(nombre, input, db) {
  try {
    switch (nombre) {
      case 'log_bitacora': {
        const { agente, accion, proyecto_id, tarea_id } = input;
        const { error } = await db.from('bitacora_actividad').insert({
          agente, accion, proyecto_id: proyecto_id ?? null, tarea_id: tarea_id ?? null,
        });
        return error ? JSON.stringify({ error: error.message }) : JSON.stringify({ ok: true });
      }
      case 'crear_tarea': {
        const { requerimiento_id, agente_asignado, descripcion, rama, plan_ejecucion, proyecto_id } = input;
        const { data, error } = await db.from('tareas').insert({
          requerimiento_id: requerimiento_id ?? null,
          agente_asignado,
          descripcion,
          plan_ejecucion: plan_ejecucion ?? null,
          proyecto_id: proyecto_id ?? null,
          rama: rama ?? null,
          estado: 'pendiente',
        }).select('id').single();

        if (error) return JSON.stringify({ error: error.message });

        // Auto-log y animar agente
        await Promise.all([
          db.from('bitacora_actividad').insert({
            agente: agente_asignado,
            accion: `Tarea recibida: ${descripcion}`,
            tarea_id: data?.id ?? null,
          }),
          db.from('avatares').update({ estado_animacion: 'caminando' }).eq('agente_nombre', agente_asignado),
        ]);

        return JSON.stringify({ ok: true, id: data?.id });
      }
      case 'actualizar_avatar_estado': {
        const { agente_nombre, estado_animacion } = input;
        const { error } = await db.from('avatares').update({ estado_animacion }).eq('agente_nombre', agente_nombre);
        return error ? JSON.stringify({ error: error.message }) : JSON.stringify({ ok: true });
      }
      case 'consultar_proyectos': {
        const { estado } = input;
        let q = db.from('proyectos').select('id,nombre,descripcion,estado,creado_en').order('creado_en', { ascending: false }).limit(10);
        if (estado) q = q.eq('estado', estado);
        const { data, error } = await q;
        return error ? JSON.stringify({ error: error.message }) : JSON.stringify({ proyectos: data });
      }
      case 'consultar_tareas': {
        const { agente_asignado, estado, limite } = input;
        let q = db.from('tareas').select('id,agente_asignado,descripcion,estado,notas,rama,creado_en')
          .order('creado_en', { ascending: false }).limit(limite ?? 10);
        if (agente_asignado) q = q.eq('agente_asignado', agente_asignado);
        if (estado) q = q.eq('estado', estado);
        const { data, error } = await q;
        return error ? JSON.stringify({ error: error.message }) : JSON.stringify({ tareas: data ?? [] });
      }
      default:
        return JSON.stringify({ error: `Tool desconocida: ${nombre}` });
    }
  } catch (e) {
    return JSON.stringify({ error: String(e) });
  }
}

async function processRequest(chatId, userMessage, userName) {
  try {
    let history = conversations.get(chatId) || [];

    history.push({ role: 'user', content: userMessage });
    if (history.length > 20) history = history.slice(-20);

    const messages = [...history];
    const MAX_ITERATIONS = 5;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages,
        tools: CLAUDE_TOOLS,
      });

      let textContent = '';
      const toolUses = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          textContent += block.text;
        } else if (block.type === 'tool_use') {
          toolUses.push(block);
        }
      }

      if (textContent) {
        await bot.sendMessage(chatId, textContent);
        history.push({ role: 'assistant', content: textContent });
      }

      if (toolUses.length === 0) break;

      messages.push({ role: 'assistant', content: response.content });
      const toolResults = [];

      for (const tu of toolUses) {
        console.log(`[SEBAS] Ejecutando tool: ${tu.name}`);
        const result = await ejecutarTool(tu.name, tu.input, supabase);
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: result });
      }

      messages.push({ role: 'user', content: toolResults });
    }

    conversations.set(chatId, history);

    // Log en Supabase
    try {
      await supabase.from('sebas_messages').insert({
        chat_id: chatId,
        user_name: userName,
        user_message: userMessage,
        timestamp: new Date().toISOString(),
      });
    } catch (dbError) {
      console.warn('[SEBAS] Error guardando en Supabase:', dbError.message);
    }

    // Animar a idle al terminar
    try {
      await supabase.from('avatares').update({ estado_animacion: 'idle' }).eq('agente_nombre', 'pm-global');
    } catch (e) {
      console.warn('[SEBAS] Error animando a idle:', e.message);
    }

  } catch (error) {
    console.error('[SEBAS] Error completo:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    await bot.sendMessage(
      chatId,
      `Disculpa, tuve un problema: ${errorMsg.substring(0, 100)}`
    ).catch(e => console.error('[SEBAS] Error al enviar:', e));
  }
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const userName = msg.from.first_name || msg.from.username || 'Usuario';

  console.log(`[SEBAS] Mensaje de ${userName}: ${text}`);

  if (!text || text.startsWith('/')) return;

  await bot.sendChatAction(chatId, 'typing');
  await processRequest(chatId, text, userName);
});

bot.on('polling_error', (error) => {
  console.error('[SEBAS] Error de polling:', error.code, error.message);
});

// ── Notificaciones proactivas desde agentes ───────────────────────────────
// Polling cada 15 s: revisa mensajes automáticos de agentes en mensajes_pm
// y los reenvía al stakeholder por Telegram.
let lastNotificacionAt = new Date().toISOString();

async function enviarNotificacionesPendientes() {
  if (!jorgeChatId) return;
  try {
    const { data, error } = await supabase
      .from('mensajes_pm')
      .select('id, contenido, created_at, metadata')
      .eq('rol', 'agente')
      .gt('created_at', lastNotificacionAt)
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) { console.warn('[SEBAS] Polling mensajes_pm error:', error.message); return; }
    if (!data || data.length === 0) return;

    for (const msg of data) {
      const esAutomatico = msg.metadata?.automatico === true;
      if (!esAutomatico) continue;

      const fuente = msg.metadata?.fuente || 'agente';
      const texto = `📬 *Notificación de ${fuente}*\n\n${msg.contenido}`;
      try {
        await bot.sendMessage(jorgeChatId, texto, { parse_mode: 'Markdown' });
        console.log(`[SEBAS] Notificación enviada de ${fuente}`);
      } catch (e) {
        // Reintentar sin Markdown si hay error de formato
        try {
          await bot.sendMessage(jorgeChatId, `📬 Notificación de ${fuente}\n\n${msg.contenido}`);
        } catch (e2) {
          console.warn('[SEBAS] Error enviando notificación:', e2.message);
        }
      }
    }

    lastNotificacionAt = data[data.length - 1].created_at;
  } catch (e) {
    console.warn('[SEBAS] Error en polling notificaciones:', e.message);
  }
}

setInterval(enviarNotificacionesPendientes, 15000);
console.log('✅ SEBAS PM Global listo — polling de notificaciones activo cada 15s');
