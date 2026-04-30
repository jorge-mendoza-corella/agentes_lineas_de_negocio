import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { Client as SshClient } from 'ssh2';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

const AGENT_DESCRIPTIONS: Record<string, string> = {
  'dev-devops':        'especialista en DevOps y CI/CD. Configuras pipelines con GitHub Actions, deploys a Firebase Hosting / Cloud Run / Supabase CLI, y gestionas secretos y entornos.',
  'dev-backend':       'especialista en backend. Implementas Supabase Edge Functions, Firebase Functions, APIs REST e integraciones con Postmark, EvolutionAPI, FacturAPI, Mifiel y n8n.',
  'dev-bd':            'especialista en base de datos PostgreSQL/Supabase. Diseñas esquemas, escribes migraciones SQL, creas funciones PL/pgSQL, triggers y políticas RLS.',
  'dev-frontend':      'especialista en frontend React/Next.js. Implementas UI, componentes, páginas, formularios y consumo de APIs con TypeScript + Tailwind.',
  'dev-testing':       'especialista en pruebas. Escribes tests unitarios, integración y E2E con Vitest, Jest y Playwright.',
  'dev-diseno':        'especialista en UX/UI. Defines experiencia de usuario, flujos de navegación, wireframes y arquitectura de información.',
  'dev-documentador':  'especialista en documentación técnica. Generas docs de APIs, diagramas Mermaid, manuales y arquitectura.',
  'dev-ciberseguridad':'especialista en ciberseguridad. Proteges el sistema, auditas vulnerabilidades y realizas hardening.',
  'dev-redes':         'especialista en infraestructura de redes, DNS y Cloudflare.',
  'dev-soporte':       'especialista en soporte a producción y atención al usuario final.',
  'dev-pm':            'Project Manager de desarrollo. Coordinas el equipo y aseguras entregas de calidad.',
};

// ── Ejecución SSH real ────────────────────────────────────────────────────
async function ejecutarSSH(
  host: string, usuario: string, password: string,
  comando: string, timeoutMs = 240000
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const conn = new SshClient();
    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      conn.destroy();
      reject(new Error(`SSH timeout (${timeoutMs / 1000}s) ejecutando: ${comando.slice(0, 80)}`));
    }, timeoutMs);

    conn.on('ready', () => {
      // DEBIAN_FRONTEND=noninteractive evita prompts interactivos en apt
      const cmdFinal = `DEBIAN_FRONTEND=noninteractive ${comando}`;
      conn.exec(cmdFinal, (err, stream) => {
        if (err) { clearTimeout(timer); conn.end(); reject(err); return; }
        stream.on('data', (d: Buffer) => { stdout += d.toString(); });
        stream.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
        stream.on('close', (code: number) => {
          clearTimeout(timer);
          conn.end();
          resolve({ stdout, stderr, exitCode: code ?? 0 });
        });
      });
    });
    conn.on('error', (err) => { clearTimeout(timer); reject(err); });
    conn.connect({ host, port: 22, username: usuario, password, readyTimeout: 20000 });
  });
}

// ── Tools para Anthropic ──────────────────────────────────────────────────
const CLAUDE_TOOLS: Anthropic.Tool[] = [
  {
    name: 'log_progreso',
    description: 'Registra un paso de tu ejecución. Úsalo para CADA acción que tomes.',
    input_schema: {
      type: 'object',
      properties: {
        paso:    { type: 'string', description: 'Qué estás haciendo ahora (acción concreta)' },
        detalle: { type: 'string', description: 'Output técnico, comandos, configuraciones relevantes (opcional)' },
      },
      required: ['paso'],
    },
  },
  {
    name: 'completar_tarea',
    description: 'Marca la tarea como COMPLETADA cuando todos los pasos estén terminados.',
    input_schema: {
      type: 'object',
      properties: {
        resumen: { type: 'string', description: 'Resumen de lo ejecutado y resultado final.' },
      },
      required: ['resumen'],
    },
  },
  {
    name: 'reportar_bloqueante',
    description: 'Reporta un problema que impide continuar. La tarea queda en espera.',
    input_schema: {
      type: 'object',
      properties: {
        problema:         { type: 'string', description: 'Descripción exacta del bloqueante' },
        accion_requerida: { type: 'string', description: 'Qué necesita el superadmin para desbloquearte' },
      },
      required: ['problema', 'accion_requerida'],
    },
  },
  {
    name: 'ejecutar_ssh',
    description: 'Ejecuta un comando en un servidor remoto vía SSH. Úsalo para instalar paquetes, configurar servicios, editar archivos y cualquier operación que requiera acceso al VPS. Siempre usa -y en comandos apt. Para comandos sudo usa: sudo -n <cmd> o pasa la contraseña con echo password | sudo -S <cmd>.',
    input_schema: {
      type: 'object',
      properties: {
        host:     { type: 'string', description: 'IP o hostname del servidor (ej: 45.232.252.100)' },
        usuario:  { type: 'string', description: 'Usuario SSH (ej: srvsozu)' },
        password: { type: 'string', description: 'Contraseña SSH' },
        comando:  { type: 'string', description: 'Comando shell a ejecutar. Usa && para encadenar pasos.' },
      },
      required: ['host', 'usuario', 'password', 'comando'],
    },
  },
];

// ── Tools para Gemini ────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GEMINI_TOOLS: any[] = [{
  functionDeclarations: [
    {
      name: 'log_progreso',
      description: 'Registra un paso de ejecución en la bitácora. Úsalo para CADA acción.',
      parameters: {
        type: 'OBJECT',
        properties: {
          paso:    { type: 'STRING', description: 'Qué estás haciendo ahora' },
          detalle: { type: 'STRING', description: 'Output técnico u observaciones (opcional)' },
        },
        required: ['paso'],
      },
    },
    {
      name: 'completar_tarea',
      description: 'Marca la tarea como COMPLETADA cuando todos los pasos están listos.',
      parameters: {
        type: 'OBJECT',
        properties: {
          resumen: { type: 'STRING', description: 'Resumen de lo ejecutado y resultado final.' },
        },
        required: ['resumen'],
      },
    },
    {
      name: 'reportar_bloqueante',
      description: 'Reporta un problema que impide continuar.',
      parameters: {
        type: 'OBJECT',
        properties: {
          problema:         { type: 'STRING', description: 'Descripción del bloqueante' },
          accion_requerida: { type: 'STRING', description: 'Acción que necesita el superadmin' },
        },
        required: ['problema', 'accion_requerida'],
      },
    },
    {
      name: 'ejecutar_ssh',
      description: 'Ejecuta un comando en servidor remoto vía SSH.',
      parameters: {
        type: 'OBJECT',
        properties: {
          host:     { type: 'STRING', description: 'IP del servidor' },
          usuario:  { type: 'STRING', description: 'Usuario SSH' },
          password: { type: 'STRING', description: 'Contraseña SSH' },
          comando:  { type: 'STRING', description: 'Comando shell a ejecutar' },
        },
        required: ['host', 'usuario', 'password', 'comando'],
      },
    },
  ],
}];

// ── Ejecutor de herramienta (compartido) ──────────────────────────────────
async function handleTool(
  nombre: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: Record<string, any>,
  agente: string,
  tareaId: string,
  db: DB
): Promise<{ resultado: string; terminar: boolean }> {
  if (nombre === 'log_progreso') {
    const accion = input.detalle ? `${input.paso}\n${input.detalle}` : input.paso;
    await db.from('bitacora_actividad').insert({ agente, accion, tarea_id: tareaId });
    return { resultado: JSON.stringify({ ok: true }), terminar: false };
  }

  if (nombre === 'completar_tarea') {
    await Promise.all([
      db.from('tareas').update({
        estado: 'completada',
        notas: input.resumen,
        completado_en: new Date().toISOString(),
      }).eq('id', tareaId),
      db.from('avatares').update({ estado_animacion: 'celebrando' }).eq('agente_nombre', agente),
      db.from('bitacora_actividad').insert({ agente, accion: `✅ Completado: ${input.resumen}`, tarea_id: tareaId }),
    ]);
    setTimeout(() => {
      db.from('avatares').update({ estado_animacion: 'idle' }).eq('agente_nombre', agente)
        .then(() => {}).catch(() => {});
    }, 4000);
    return { resultado: JSON.stringify({ ok: true }), terminar: true };
  }

  if (nombre === 'reportar_bloqueante') {
    const nota = `🚧 BLOQUEANTE: ${input.problema}\n👉 Acción requerida: ${input.accion_requerida}`;
    await Promise.all([
      db.from('tareas').update({ estado: 'pendiente', notas: nota }).eq('id', tareaId),
      db.from('avatares').update({ estado_animacion: 'idle' }).eq('agente_nombre', agente),
      db.from('bitacora_actividad').insert({ agente, accion: `🚧 Bloqueante: ${input.problema} — ${input.accion_requerida}`, tarea_id: tareaId }),
    ]);
    return { resultado: JSON.stringify({ ok: true }), terminar: true };
  }

  if (nombre === 'ejecutar_ssh') {
    const host     = (input.host     as string) || process.env.SSH_DEFAULT_HOST;
    const usuario  = (input.usuario  as string) || process.env.SSH_DEFAULT_USER;
    const password = (input.password as string) || process.env.SSH_DEFAULT_PASSWORD;
    const comando  = input.comando as string;

    if (!host || !usuario || !password) {
      return { resultado: JSON.stringify({ error: 'Credenciales SSH incompletas. Proporciona host, usuario y password.' }), terminar: false };
    }

    // Log del comando ejecutado (sin contraseña)
    await db.from('bitacora_actividad').insert({
      agente,
      accion: `🖥️ SSH [${host}]: ${comando.slice(0, 200)}`,
      tarea_id: tareaId,
    });

    try {
      const { stdout, stderr, exitCode } = await ejecutarSSH(host, usuario, password, comando);
      const salida = stdout.slice(0, 2000) + (stderr ? `\n[STDERR] ${stderr.slice(0, 500)}` : '');

      await db.from('bitacora_actividad').insert({
        agente,
        accion: `📤 SSH resultado (exit ${exitCode}):\n${salida}`,
        tarea_id: tareaId,
      });

      return {
        resultado: JSON.stringify({ exitCode, stdout: stdout.slice(0, 3000), stderr: stderr.slice(0, 500) }),
        terminar: false,
      };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      await db.from('bitacora_actividad').insert({
        agente,
        accion: `❌ SSH error: ${errMsg}`,
        tarea_id: tareaId,
      });
      return { resultado: JSON.stringify({ error: errMsg }), terminar: false };
    }
  }

  return { resultado: JSON.stringify({ error: `Tool desconocida: ${nombre}` }), terminar: false };
}

// ── Loop con Anthropic ────────────────────────────────────────────────────
async function loopClaude(
  systemPrompt: string, tareaId: string, agente: string, db: DB
): Promise<void> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: `Ejecuta tu tarea asignada. ID: ${tareaId}` },
  ];

  for (let i = 0; i < 10; i++) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      tools: CLAUDE_TOOLS,
    });

    messages.push({ role: 'assistant', content: response.content });

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    );
    if (toolUses.length === 0) break;

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const { resultado, terminar } = await handleTool(
        tu.name, tu.input as Record<string, unknown>, agente, tareaId, db
      );
      toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: resultado });
      if (terminar) { messages.push({ role: 'user', content: toolResults }); return; }
    }
    messages.push({ role: 'user', content: toolResults });
    if (response.stop_reason === 'end_turn') break;
  }
}

// ── Loop con Gemini ───────────────────────────────────────────────────────
async function loopGemini(
  systemPrompt: string, tareaId: string, agente: string, db: DB
): Promise<void> {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', tools: GEMINI_TOOLS, systemInstruction: systemPrompt });
  const chat = model.startChat();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mensaje: any = `Ejecuta tu tarea asignada. ID: ${tareaId}`;

  for (let i = 0; i < 10; i++) {
    const result = await chat.sendMessage(mensaje);
    const response = await result.response;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const functionCalls: any[] = (response as any).functionCalls?.() ?? [];
    if (functionCalls.length === 0) break;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const functionResponses: any[] = [];
    for (const fc of functionCalls) {
      const { resultado, terminar } = await handleTool(fc.name, fc.args ?? {}, agente, tareaId, db);
      functionResponses.push({ functionResponse: { name: fc.name, response: JSON.parse(resultado) } });
      if (terminar) { await chat.sendMessage(functionResponses); return; }
    }
    mensaje = functionResponses;
  }
}

// ── Función principal exportada ───────────────────────────────────────────
export async function ejecutarEspecialista(tareaId: string, db: DB): Promise<void> {
  const tieneAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const tieneGemini    = !!process.env.GOOGLE_GEMINI_API_KEY;

  if (!tieneAnthropic && !tieneGemini) {
    console.error('[especialista] Sin proveedor de IA configurado');
    return;
  }

  // Cargar la tarea
  const { data: tarea, error } = await db
    .from('tareas')
    .select('id, agente_asignado, descripcion, plan_ejecucion, estado')
    .eq('id', tareaId)
    .single();

  if (error || !tarea) {
    console.error('[especialista] tarea no encontrada:', tareaId, error);
    return;
  }

  const agente: string      = tarea.agente_asignado;
  const descripcion: string = tarea.descripcion;
  const plan: string        = tarea.plan_ejecucion ?? 'Sin plan detallado — actuar con criterio profesional.';
  const descAgente          = AGENT_DESCRIPTIONS[agente] ?? 'agente especialista';

  // Decidir modelo (Anthropic primero, Gemini como fallback)
  const modelo = tieneAnthropic ? 'claude-sonnet-4-6' : 'gemini-2.5-flash';

  // Marcar en progreso + animar avatar + log de inicio
  await Promise.all([
    db.from('tareas').update({ estado: 'en_progreso', iniciado_en: new Date().toISOString() }).eq('id', tareaId),
    db.from('avatares').update({ estado_animacion: 'trabajando' }).eq('agente_nombre', agente),
    db.from('bitacora_actividad').insert({
      agente,
      accion: `🤖 Iniciando con ${modelo}: ${descripcion}`,
      tarea_id: tareaId,
    }),
  ]);

  const systemPrompt = `Eres **${agente}**, ${descAgente}.

## Tu tarea actual
**Descripción:** ${descripcion}

## Plan de ejecución
${plan}

---

## Herramientas disponibles
- **log_progreso**: Registra cada paso que ejecutas.
- **ejecutar_ssh**: Ejecuta comandos reales en servidores remotos vía SSH. Si el plan incluye credenciales SSH (usuario, contraseña, IP), úsalas directamente en esta herramienta. Puedes encadenar comandos con &&.
- **completar_tarea**: Marca la tarea como terminada.
- **reportar_bloqueante**: Solo si algo es genuinamente imposible de resolver (credenciales incorrectas, permiso del proveedor, etc.).

## Instrucciones
1. Ejecuta el plan paso a paso.
2. Llama \`log_progreso\` para CADA acción importante — incluye detalles técnicos y outputs relevantes.
3. Para tareas en servidores: usa \`ejecutar_ssh\` directamente con las credenciales del plan. NO reportes como bloqueante algo que puedas ejecutar tú mismo.
4. Encadena múltiples comandos en un solo \`ejecutar_ssh\` usando && cuando sean pasos secuenciales.
5. Al terminar todos los pasos: llama \`completar_tarea\` con resumen ejecutivo.
6. Responde siempre en español.`;

  try {
    if (tieneAnthropic) {
      try {
        await loopClaude(systemPrompt, tareaId, agente, db);
        return;
      } catch (claudeErr: unknown) {
        const msg = claudeErr instanceof Error ? claudeErr.message : String(claudeErr);
        // Fallback solo si es error de créditos/autenticación y tenemos Gemini
        const esCreditError = msg.includes('credit') || msg.includes('401') || msg.includes('403');
        if (!esCreditError || !tieneGemini) throw claudeErr;

        await db.from('bitacora_actividad').insert({
          agente,
          accion: `⚠️ Anthropic sin créditos — cambiando a gemini-2.5-flash`,
          tarea_id: tareaId,
        });
      }
    }
    // Gemini (fallback o primario)
    await loopGemini(systemPrompt, tareaId, agente, db);

  } catch (e) {
    console.error(`[especialista:${agente}] error:`, e);
    const msg = e instanceof Error ? e.message : String(e);
    await db.from('bitacora_actividad').insert({
      agente,
      accion: `❌ Error en ejecución: ${msg}`,
      tarea_id: tareaId,
    });
    await db.from('tareas').update({ notas: `Error: ${msg}` }).eq('id', tareaId);
    await db.from('avatares').update({ estado_animacion: 'idle' }).eq('agente_nombre', agente);
  }
}

export function makeDb() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
