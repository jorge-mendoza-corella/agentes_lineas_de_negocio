#!/usr/bin/env node

const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const token = process.env.TELEGRAM_BOT_TOKEN_SEBAS || process.env.TELEGRAM_BOT_TOKEN;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;
const jorgeChatId = process.env.JORGE_CHAT_ID;

if (!token) { console.error('[SEBAS] FATAL: TELEGRAM_BOT_TOKEN_SEBAS no configurado'); process.exit(1); }
if (!anthropicKey) { console.error('[SEBAS] FATAL: ANTHROPIC_API_KEY no configurado'); process.exit(1); }

const bot = new TelegramBot(token, { polling: true });
const supabase = createClient(supabaseUrl || '', supabaseKey || '');
const client = new Anthropic({ apiKey: anthropicKey });

console.log('🎯 SEBAS PM Global iniciando...');
console.log(`📱 Token: ${token ? token.slice(0, 10) + '...' : 'NO configurado ❌'}`);
console.log(`🔗 Supabase: ${supabaseUrl ? 'configurado ✅' : 'NO configurado ❌'}`);
console.log(`🧠 Anthropic: ${anthropicKey ? 'configurado ✅' : 'NO configurado ❌'}`);

// ── System prompt ─────────────────────────────────────────────────────────────

const PM_GLOBAL_BASE = `# PM Global — Servicios Agénticos

Eres el Project Manager raíz que coordina todas las áreas de negocio. Eres el **único punto de contacto con el usuario**. Todos los PMs de área te reportan a ti; todos los agentes le reportan a su PM de área, y éste te escala lo relevante. Si asignas tareas directamente a agentes (sin PM de área intermedio), esos agentes te reportan a ti directamente.

---

## Libre albedrío — cuándo actuar vs. cuándo consultar

Tienes autonomía para tomar decisiones. Clasifica cada situación en tres niveles:

### 🟢 ACTUAR SOLO (sin preguntar al usuario)
- Ejecutar comandos en servidores/VPS
- Reiniciar servicios, contenedores, procesos
- Aplicar configuraciones ya documentadas o conocidas
- Abrir puertos documentados en el plan
- Crear tareas para dev-pm, dev-devops, dev-backend u otros especialistas
- Solucionar errores técnicos con solución clara (incluyendo los que un agente ya diagnosticó)
- Reinstalar o reconfigurar dependencias
- Modificar archivos de configuración (nginx, docker-compose, etc.)

### 🟡 INFORMAR Y PROCEDER (mencionar brevemente qué harás, luego ejecutar)
- Cambios de arquitectura menores no documentados previamente
- Modificar configuración de producción con impacto visual al usuario final
- Agregar dependencias nuevas al proyecto

### 🔴 PEDIR CONFIRMACIÓN ANTES DE ACTUAR
- Eliminar datos de producción o bases de datos
- Cambios de seguridad irreversibles (borrar claves, revocar accesos)
- Gastos externos (APIs de pago, servicios cloud)
- Exponer endpoints públicos que no estaban en el plan original
- Acciones que afecten a múltiples empresas o stakeholders simultáneamente

**Regla de oro:** Si un agente ya diagnosticó el problema y la solución son comandos o configuraciones, crea las tareas y ejecuta. No le repitas al usuario lo que el agente ya dijo — actúa.

---

## Jerarquía de reporte

Agentes → PM de área → PM Global → Usuario (solo 🔴)

- Cuando recibes un reporte de un agente o PM de área con hallazgos y acciones claras → ejecuta directamente (nivel 🟢 o 🟡).
- Solo escala al usuario si la acción es nivel 🔴 o si el usuario pregunta explícitamente.
- Si el PM de área no resuelve un bloqueo, el PM Global toma el control y asigna directamente a otros agentes.

---

## Contexto multi-empresa

Este sistema atiende a múltiples empresas independientes. Cada empresa contrata servicios específicos de la suite:
- desarrollo: Software, backend, frontend, BD, devops, testing, presentaciones, videojuegos, imágenes
- finanzas: Flujos, presupuestos, análisis financiero, tesorería
- contabilidad: CFDI, conciliaciones, declaraciones fiscales, nómina
- marketing: Estrategia de contenido, copywriting, CRO, email sequences
- cobranza: Gestión de cuentas por cobrar, recordatorios, seguimiento
- escrituracion: Contratos, escrituras, RPP, trámites notariales
- postventa: Atención al cliente, garantías, seguimiento post-compra
- rrhh: Recursos humanos, reclutamiento, nómina, clima laboral

---

## Responsabilidades

- Identificar la empresa y el área de negocio que aplica a la solicitud.
- Verificar que la empresa tenga contratado el servicio antes de delegar.
- Delegar al PM del área o directamente a agentes si no hay PM de área.
- Coordinar entre múltiples áreas si la solicitud lo requiere.
- Tomar decisiones autónomas en niveles 🟢 y 🟡 sin esperar al usuario.
- Reportar al usuario solo lo relevante (resultados, decisiones 🔴 que necesitan aprobación).

---

## Áreas activas

| Área | PM | Servicio |
|---|---|---|
| Desarrollo | dev-pm | desarrollo |

---

## Flujo de trabajo

1. Analiza la solicitud o reporte recibido y clasifica el nivel de decisión (🟢/🟡/🔴).
2. Si es 🟢: usa consultar_proyectos si es necesario, crea las tareas con crear_tarea y ejecuta. Informa brevemente al usuario qué hiciste.
3. Si es 🟡: menciona en una línea lo que vas a hacer, luego ejecuta sin esperar respuesta.
4. Si es 🔴: describe claramente la acción y su riesgo, y espera confirmación explícita.
5. Usa log_bitacora para registrar cada decisión importante.

---

## Instrucciones de tool use

- Registra en log_bitacora cada decisión importante (siempre con tu nombre: pm-global).
- Crea tareas con crear_tarea — SIEMPRE incluye plan_ejecucion con pasos numerados, comandos exactos y criterios de éxito. SIEMPRE incluye proyecto_id si tienes contexto del proyecto.
- Para actualizar el progreso de una tarea usa actualizar_tarea.
- Para saber el estado REAL de un agente: usa consultar_tareas filtrando por agente.
- Para ver el historial detallado de una tarea: usa consultar_bitacora filtrando por tarea_id.
- NUNCA inventes el estado de un agente. Si el usuario pregunta qué está haciendo dev-X, llama consultar_tareas con ese agente primero.
- Responde siempre en español.`;

function buildTelegramSystemPrompt(nombreUsuario) {
  const vpsHost = process.env.VPS_HOST || '';
  const vpsUser = process.env.VPS_USER || '';
  const vpsInfo = vpsHost
    ? `\n\n---\n\n## Infraestructura VPS\n- Host: ${vpsHost}\n- Usuario SSH: ${vpsUser}\n- Las credenciales SSH están configuradas en variables de entorno — los agentes las leen automáticamente.\n- NUNCA pidas al usuario credenciales SSH.`
    : '';

  return `${PM_GLOBAL_BASE}${vpsInfo}

---

## Sesión Telegram
- Usuario: ${nombreUsuario} (stakeholder principal)
- Fecha: ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}
- Canal: Telegram — responde en texto plano. Puedes usar *negrita* y _cursiva_ de Markdown básico de Telegram.
- La herramienta actualizar_avatar_estado no aplica en Telegram (no hay UI de avatares aquí) — úsala si quieres pero no tiene efecto visual.
- El usuario tiene acceso total y puede aprobar directamente sin flujo de aprobación.`;
}

// ── Tools ─────────────────────────────────────────────────────────────────────

const TOOLS = [
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
    description: 'Crea una tarea asignada a un agente especialista. SIEMPRE incluye plan_ejecucion con los pasos concretos, comandos y criterios de éxito.',
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
        },
        descripcion:      { type: 'string', description: 'Qué debe hacer exactamente el agente (resumen breve)' },
        plan_ejecucion:   { type: 'string', description: 'Plan detallado: pasos numerados, comandos específicos, criterios de éxito.' },
        proyecto_id:      { type: 'string', description: 'UUID del proyecto al que pertenece esta tarea' },
        requerimiento_id: { type: 'string', description: 'UUID del requerimiento (opcional)' },
        rama:             { type: 'string', description: 'Rama de Git sugerida (opcional)' },
      },
      required: ['agente_asignado', 'descripcion', 'plan_ejecucion'],
    },
  },
  {
    name: 'actualizar_avatar_estado',
    description: 'Actualiza la animación del avatar de un agente (no-op en Telegram).',
    input_schema: {
      type: 'object',
      properties: {
        agente_nombre:    { type: 'string' },
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
        estado: { type: 'string', enum: ['activo','pausado','cerrado'] },
      },
    },
  },
  {
    name: 'consultar_tareas',
    description: 'Consulta las tareas registradas en BD. Úsalo siempre para saber el estado real — nunca inferir.',
    input_schema: {
      type: 'object',
      properties: {
        agente_asignado: { type: 'string', description: 'Filtrar por agente (ej: dev-devops)' },
        estado: { type: 'string', enum: ['pendiente','en_progreso','completada','cancelada'] },
        limite: { type: 'number' },
      },
    },
  },
  {
    name: 'consultar_bitacora',
    description: 'Lee el log real de actividad de los agentes.',
    input_schema: {
      type: 'object',
      properties: {
        tarea_id: { type: 'string' },
        agente:   { type: 'string' },
        limite:   { type: 'number' },
      },
    },
  },
  {
    name: 'actualizar_tarea',
    description: 'Actualiza el estado de una tarea y agrega notas de progreso.',
    input_schema: {
      type: 'object',
      properties: {
        tarea_id: { type: 'string' },
        estado:   { type: 'string', enum: ['pendiente','en_progreso','completada','cancelada'] },
        notas:    { type: 'string' },
      },
      required: ['tarea_id', 'estado'],
    },
  },
];

// ── Ejecución de tools ────────────────────────────────────────────────────────

async function ejecutarTool(nombre, input) {
  try {
    switch (nombre) {
      case 'log_bitacora': {
        const { error } = await supabase.from('bitacora_actividad').insert({
          agente: input.agente,
          accion: input.accion,
          proyecto_id: input.proyecto_id ?? null,
          tarea_id: input.tarea_id ?? null,
        });
        return error ? JSON.stringify({ error: error.message }) : JSON.stringify({ ok: true });
      }
      case 'crear_tarea': {
        const { data, error } = await supabase.from('tareas').insert({
          requerimiento_id: input.requerimiento_id ?? null,
          agente_asignado: input.agente_asignado,
          descripcion: input.descripcion,
          plan_ejecucion: input.plan_ejecucion ?? null,
          proyecto_id: input.proyecto_id ?? null,
          rama: input.rama ?? null,
          estado: 'pendiente',
        }).select('id').single();
        if (error) return JSON.stringify({ error: error.message });
        await supabase.from('bitacora_actividad').insert({
          agente: input.agente_asignado,
          accion: `Tarea recibida: ${input.descripcion}`,
          tarea_id: data?.id ?? null,
        });
        return JSON.stringify({ ok: true, id: data?.id });
      }
      case 'actualizar_avatar_estado': {
        // No-op en Telegram (no hay canvas Sims)
        return JSON.stringify({ ok: true });
      }
      case 'consultar_proyectos': {
        let q = supabase
          .from('proyectos')
          .select('id,nombre,descripcion,estado,creado_en')
          .order('creado_en', { ascending: false })
          .limit(10);
        if (input.estado) q = q.eq('estado', input.estado);
        const { data, error } = await q;
        return error ? JSON.stringify({ error: error.message }) : JSON.stringify({ proyectos: data });
      }
      case 'consultar_tareas': {
        let q = supabase
          .from('tareas')
          .select('id,agente_asignado,descripcion,estado,notas,rama,creado_en')
          .order('creado_en', { ascending: false })
          .limit(input.limite ?? 10);
        if (input.agente_asignado) q = q.eq('agente_asignado', input.agente_asignado);
        if (input.estado) q = q.eq('estado', input.estado);
        const { data, error } = await q;
        return error ? JSON.stringify({ error: error.message }) : JSON.stringify({ tareas: data ?? [] });
      }
      case 'consultar_bitacora': {
        let q = supabase
          .from('bitacora_actividad')
          .select('id,agente,accion,tarea_id,proyecto_id,creado_en')
          .order('creado_en', { ascending: false })
          .limit(input.limite ?? 20);
        if (input.tarea_id) q = q.eq('tarea_id', input.tarea_id);
        if (input.agente) q = q.eq('agente', input.agente);
        const { data, error } = await q;
        return error ? JSON.stringify({ error: error.message }) : JSON.stringify({ entradas: data ?? [] });
      }
      case 'actualizar_tarea': {
        const { data: tareaActual } = await supabase
          .from('tareas')
          .select('agente_asignado,descripcion')
          .eq('id', input.tarea_id)
          .single();
        const updates = { estado: input.estado };
        if (input.notas !== undefined) updates.notas = input.notas;
        if (input.estado === 'en_progreso') updates.iniciado_en = new Date().toISOString();
        if (input.estado === 'completada' || input.estado === 'cancelada') updates.completado_en = new Date().toISOString();
        const { error } = await supabase.from('tareas').update(updates).eq('id', input.tarea_id);
        if (error) return JSON.stringify({ error: error.message });
        if (tareaActual?.agente_asignado) {
          const accion =
            input.estado === 'completada' ? `Completado: ${tareaActual.descripcion}${input.notas ? ` — ${input.notas}` : ''}` :
            input.estado === 'cancelada'  ? `Cancelado: ${tareaActual.descripcion}` :
            `Estado actualizado a ${input.estado}`;
          await supabase.from('bitacora_actividad').insert({
            agente: tareaActual.agente_asignado,
            accion,
            tarea_id: input.tarea_id,
          });
        }
        return JSON.stringify({ ok: true });
      }
      default:
        return JSON.stringify({ error: `Tool desconocida: ${nombre}` });
    }
  } catch (e) {
    return JSON.stringify({ error: String(e) });
  }
}

// ── Historial por chat ────────────────────────────────────────────────────────

const conversaciones = new Map(); // chatId → MessageParam[]

function getHistorial(chatId) {
  if (!conversaciones.has(chatId)) conversaciones.set(chatId, []);
  return conversaciones.get(chatId);
}

function agregarMensaje(chatId, role, content) {
  const hist = getHistorial(chatId);
  hist.push({ role, content });
  // Mantener máximo 20 mensajes (10 turnos)
  if (hist.length > 20) hist.splice(0, hist.length - 20);
}

// ── Agentic loop ──────────────────────────────────────────────────────────────

async function procesarConClaude(chatId, nombreUsuario, texto) {
  const historial = getHistorial(chatId);
  const messages = [...historial, { role: 'user', content: texto }];
  const systemPrompt = buildTelegramSystemPrompt(nombreUsuario);
  const MAX_ITER = 5;
  let textoFinal = '';

  for (let i = 0; i < MAX_ITER; i++) {
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      tools: TOOLS,
    });

    const toolUses = resp.content.filter(b => b.type === 'tool_use');

    // Extraer texto parcial de este turno
    for (const block of resp.content) {
      if (block.type === 'text' && block.text) {
        textoFinal += block.text;
      }
    }

    if (toolUses.length === 0) break;

    // Loguear tools ejecutadas
    const toolNames = toolUses.map(tu => tu.name).join(', ');
    console.log(`[SEBAS] Tools ejecutando: ${toolNames}`);

    messages.push({ role: 'assistant', content: resp.content });
    const toolResults = [];
    for (const tu of toolUses) {
      const result = await ejecutarTool(tu.name, tu.input);
      console.log(`[SEBAS] Tool ${tu.name} → ${result.slice(0, 120)}`);
      toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: result });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  // Guardar en historial
  agregarMensaje(chatId, 'user', texto);
  if (textoFinal) agregarMensaje(chatId, 'assistant', textoFinal);

  return textoFinal || '(Sin respuesta)';
}

// ── Envío dividido para mensajes > 4096 chars ─────────────────────────────────

async function enviarTexto(chatId, texto) {
  const MAX = 4000;
  if (texto.length <= MAX) {
    try {
      await bot.sendMessage(chatId, texto, { parse_mode: 'Markdown' });
    } catch {
      await bot.sendMessage(chatId, texto).catch(() => null);
    }
    return;
  }
  // Dividir por párrafos respetando el límite
  const partes = [];
  let actual = '';
  for (const linea of texto.split('\n')) {
    if ((actual + '\n' + linea).length > MAX) {
      if (actual) partes.push(actual.trim());
      actual = linea;
    } else {
      actual += (actual ? '\n' : '') + linea;
    }
  }
  if (actual.trim()) partes.push(actual.trim());
  for (const parte of partes) {
    try {
      await bot.sendMessage(chatId, parte, { parse_mode: 'Markdown' });
    } catch {
      await bot.sendMessage(chatId, parte).catch(() => null);
    }
  }
}

// ── Handler de mensajes ───────────────────────────────────────────────────────

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text) return;

  const senderName = msg.from?.first_name || 'Usuario';
  console.log(`[SEBAS] Mensaje de ${senderName} (${chatId}): ${text}`);

  // Comando /reset
  if (text.trim() === '/reset' || text.trim() === '/nuevo') {
    conversaciones.delete(chatId);
    await bot.sendMessage(chatId, 'Conversación reiniciada. ¿En qué puedo ayudarte?');
    return;
  }

  // Indicador de actividad
  try { await bot.sendChatAction(chatId, 'typing'); } catch {}

  try {
    const respuesta = await procesarConClaude(chatId, senderName, text);
    await enviarTexto(chatId, respuesta);
  } catch (error) {
    console.error('[SEBAS] Error en handler:', error.message, error.stack);
    await bot.sendMessage(chatId, '❌ Error procesando tu solicitud. Intenta de nuevo.').catch(() => null);
  }
});

bot.on('polling_error', (error) => {
  console.error('[SEBAS] Error de polling:', error.code, error.message);
});

// ── Notificaciones proactivas desde agentes ───────────────────────────────────

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

    for (const m of data) {
      const esAutomatico = m.metadata?.automatico === true;
      if (!esAutomatico) continue;

      const fuente = m.metadata?.fuente || 'agente';
      const texto = `📬 *Notificación de ${fuente}*\n\n${m.contenido}`;
      try {
        await bot.sendMessage(jorgeChatId, texto, { parse_mode: 'Markdown' });
        console.log(`[SEBAS] Notificación enviada de ${fuente}`);
      } catch {
        try {
          await bot.sendMessage(jorgeChatId, `📬 Notificación de ${fuente}\n\n${m.contenido}`);
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
console.log('✅ SEBAS PM Global listo — agentic loop activo, polling de notificaciones cada 15s');
