import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { Client as SshClient } from 'ssh2';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// ── Estado paso-actual por tarea ──────────────────────────────────────────
// Mantiene en memoria el paso actual (1-based) de cada tarea en ejecución.
// Se usa para anotar paso_index en cada entrada de bitacora_actividad.
const pasoActualPorTarea = new Map<string, number | null>();

function parsePasosDePlan(plan: string | null | undefined): string[] {
  if (!plan) return [];
  const headerRe = /^===\s*PASO\s+(\d+)\s*[—–\-]\s*(.+?)\s*===\s*$/gim;
  const headers: string[] = [];
  let m;
  while ((m = headerRe.exec(plan)) !== null) headers.push((m[2] ?? '').trim());
  if (headers.length > 0) return headers;
  return plan.replace(/^===.*===\s*$/gm, '').split('\n').map(l => l.trim())
    .filter(l => /^\d+[\.\)\-]\s+\S/.test(l) || /^\*\*\d+[\.\)]\*?\*?\s+\S/.test(l) || /^[-*•]\s+\S/.test(l) || /^Paso\s+\d+/i.test(l) || /^Step\s+\d+/i.test(l))
    .map(l => l.replace(/^\d+[\.\)\-]\s*/, '').replace(/^\*\*\d+[\.\)]\*?\*?\s*/, '').replace(/^[-*•]\s*/, '').replace(/^Paso\s+\d+[\.\:\-]?\s*/i, '').replace(/^Step\s+\d+[\.\:\-]?\s*/i, '').replace(/\*\*/g, '').trim())
    .filter(l => l.length > 4);
}

function detectarPasoEnTexto(texto: string, totalPasos: number): number | null {
  if (!texto) return null;
  const m = texto.match(/(?:iniciando|comenzando|empezando|ejecutando|aplicando|paso|step)\s*#?\s*(\d+)/i);
  if (!m || !m[1]) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n < 1) return null;
  if (totalPasos > 0 && n > totalPasos) return null;
  return n;
}

async function bitacoraInsert(
  db: DB, agente: string, accion: string, tareaId: string,
  pasoOverride?: number | null,
): Promise<void> {
  const pasoActual = pasoOverride !== undefined ? pasoOverride : (pasoActualPorTarea.get(tareaId) ?? null);
  await db.from('bitacora_actividad').insert({
    agente, accion, tarea_id: tareaId,
    paso_index: pasoActual,
  });
}

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
// Usa autenticación por llave privada (SSH_KEY_PATH + SSH_KEY_PASSPHRASE en .env.local).
// Fallback a contraseña solo si no existe la llave.
async function ejecutarSSH(
  host: string, usuario: string, credencial: string,
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
      // Si es root, quitar prefijos sudo — ya tiene todos los permisos
      const esRoot = usuario === 'root';
      const cmdSinSudo = esRoot ? comando.replace(/\bsudo\s+/g, '') : comando;
      let cmdFinal = `DEBIAN_FRONTEND=noninteractive ${cmdSinSudo}`;

      // Para usuarios no-root con sudo: inyectar contraseña mediante PTY + heredoc.
      // PTY satisface "requiretty" de sudoers; -S lee la contraseña de stdin.
      const sudoPass = process.env.SSH_SUDO_PASSWORD;
      if (!esRoot && sudoPass && /\bsudo\b/.test(comando)) {
        const safePass  = sudoPass.replace(/'/g, "'\\''");
        const cmdAsRoot = `DEBIAN_FRONTEND=noninteractive ${comando.replace(/\bsudo\s+/g, '')}`;
        const b64 = Buffer.from(cmdAsRoot).toString('base64');
        cmdFinal = `echo '${safePass}' | sudo -Sp '' bash -c "$(echo '${b64}' | base64 -d)"`;
      }

      // pty:true satisface "Defaults requiretty" en sudoers sin necesitar sesión interactiva
      conn.exec(cmdFinal, { pty: true }, (err, stream) => {
        if (err) { clearTimeout(timer); conn.end(); reject(err); return; }
        // Con PTY activo stderr se mezcla en stdout; capturamos ambos canales por si acaso
        stream.on('data', (d: Buffer) => { stdout += d.toString(); });
        stream.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
        stream.on('close', (code: number) => {
          clearTimeout(timer);
          conn.end();
          resolve({ stdout, stderr, exitCode: code ?? 0 });
        });
      });
    });
    conn.on('error', (err) => { clearTimeout(timer); reject(err); });

    // Autenticación: llave privada preferida sobre contraseña
    const keyPath   = process.env.SSH_KEY_PATH || path.join(os.homedir(), '.ssh', 'id_rsa');
    const passphrase = process.env.SSH_KEY_PASSPHRASE || credencial;

    const connectOpts: Parameters<typeof conn.connect>[0] = {
      host, port: 22, username: usuario, readyTimeout: 20000,
    };

    if (fs.existsSync(keyPath) && fs.statSync(keyPath).isFile()) {
      connectOpts.privateKey = fs.readFileSync(keyPath);
      if (passphrase) connectOpts.passphrase = passphrase;
    } else {
      if (fs.existsSync(keyPath)) {
        console.error(`[SSH] SSH_KEY_PATH apunta a un directorio: ${keyPath}. Revisa el volumen Docker (/home/srvsozu/.ssh/id_rsa debe existir en el host).`);
      }
      connectOpts.password = credencial;
    }

    conn.connect(connectOpts);
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
    description: 'Ejecuta un comando en un servidor remoto vía SSH usando llave privada. Host y usuario son requeridos; password solo si la passphrase NO está en SSH_KEY_PASSPHRASE del entorno. Úsalo para instalar paquetes, configurar servicios, editar archivos y cualquier operación en el VPS. Siempre usa -y en comandos apt.',
    input_schema: {
      type: 'object',
      properties: {
        host:             { type: 'string', description: 'IP o hostname del servidor (ej: 45.232.252.100)' },
        usuario:          { type: 'string', description: 'Usuario SSH (ej: srvsozu). Para ejecutar como root usa "root".' },
        password:         { type: 'string', description: 'Passphrase de la llave privada SSH (omitir — ya está configurada en el entorno)' },
        comando:          { type: 'string', description: 'Comando shell a ejecutar en el servidor. Usa && para encadenar pasos. Si usuario es root, NO uses sudo.' },
        timeout_segundos: { type: 'number', description: 'Timeout en segundos. Default 300. Para apt install / docker pull usa 600 o más.' },
        como_root:        { type: 'boolean', description: 'Si true, conecta como usuario root (evita sudo completamente). Úsalo cuando sudo falle o para comandos de sistema.' },
      },
      required: ['host', 'usuario', 'comando'],
    },
  },
  {
    name: 'ejecutar_ssh_env',
    description: 'Ejecuta un comando en el VPS principal usando TODAS las credenciales del entorno (host, usuario, llave, passphrase). No necesitas pasar ningún parámetro de conexión — úsalo siempre que el plan no especifique un servidor diferente al VPS principal.',
    input_schema: {
      type: 'object',
      properties: {
        comando:          { type: 'string', description: 'Comando shell a ejecutar en el VPS. Usa && para encadenar. Para sudo usa el formato normal — la contraseña se inyecta automáticamente.' },
        timeout_segundos: { type: 'number', description: 'Timeout en segundos. Default 300. Para apt install / docker pull usa 600 o más.' },
        como_root:        { type: 'boolean', description: 'Si true, conecta como root (evita sudo). Úsalo cuando sudo falle.' },
      },
      required: ['comando'],
    },
  },
  {
    name: 'actualizar_tarea',
    description: 'Actualiza el estado, notas o plan de ejecución de una tarea existente. Úsalo como PM para corregir el plan de una tarea bloqueada o agregar instrucciones adicionales al agente.',
    input_schema: {
      type: 'object',
      properties: {
        tarea_id:       { type: 'string', description: 'ID de la tarea a actualizar' },
        notas:          { type: 'string', description: 'Nuevas notas o instrucciones para la tarea (opcional)' },
        plan_ejecucion: { type: 'string', description: 'Plan de ejecución actualizado con pasos corregidos (opcional)' },
      },
      required: ['tarea_id'],
    },
  },
  {
    name: 'notificar_usuario',
    description: 'Escala un mensaje al PM Global. SOLO el PM Global habla con el usuario — tú nunca contactas al usuario directamente. Usa este tool para reportar resultados al PM Global o para escalarle un bloqueante que requiera su gestión. El mensaje lo recibirá el PM Global en su chat.',
    input_schema: {
      type: 'object',
      properties: {
        mensaje: { type: 'string', description: 'Mensaje para el PM Global: qué hiciste, qué pasó, qué necesitas que él gestione.' },
      },
      required: ['mensaje'],
    },
  },
  {
    name: 'crear_subtarea',
    description: 'Crea y dispara una nueva tarea para un agente especialista. Úsalo cuando el bloqueante sea técnico y otro agente pueda resolverlo.',
    input_schema: {
      type: 'object',
      properties: {
        agente_asignado: {
          type: 'string',
          enum: ['dev-backend','dev-bd','dev-frontend','dev-devops','dev-testing','dev-diseno','dev-documentador','dev-ciberseguridad','dev-redes','dev-soporte'],
          description: 'Agente que resolverá el problema técnico',
        },
        descripcion:    { type: 'string', description: 'Resumen breve de lo que debe hacer el agente' },
        plan_ejecucion: { type: 'string', description: 'Plan detallado con pasos, comandos y criterio de éxito. Sé exhaustivo.' },
        proyecto_id:    { type: 'string', description: 'UUID del proyecto relacionado (opcional)' },
      },
      required: ['agente_asignado', 'descripcion', 'plan_ejecucion'],
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
      description: 'Ejecuta un comando en servidor remoto vía SSH. Password solo si la passphrase no está en el entorno.',
      parameters: {
        type: 'OBJECT',
        properties: {
          host:             { type: 'STRING', description: 'IP del servidor' },
          usuario:          { type: 'STRING', description: 'Usuario SSH. Para root usa "root".' },
          password:         { type: 'STRING', description: 'Passphrase SSH (omitir — ya está en el entorno)' },
          comando:          { type: 'STRING', description: 'Comando shell a ejecutar. Si usuario es root, NO uses sudo.' },
          timeout_segundos: { type: 'NUMBER', description: 'Timeout en segundos. Default 300. Para apt install / docker pull usa 600.' },
          como_root:        { type: 'BOOLEAN', description: 'Si true, conecta como root (evita sudo). Úsalo cuando sudo falle.' },
        },
        required: ['host', 'usuario', 'comando'],
      },
    },
    {
      name: 'ejecutar_ssh_env',
      description: 'Ejecuta un comando en el VPS principal usando credenciales del entorno. No necesitas pasar host, usuario ni password — todo está configurado. Úsalo siempre que el destino sea el VPS principal.',
      parameters: {
        type: 'OBJECT',
        properties: {
          comando:          { type: 'STRING', description: 'Comando shell a ejecutar en el VPS. Usa && para encadenar.' },
          timeout_segundos: { type: 'NUMBER', description: 'Timeout en segundos. Default 300. Para apt install / docker pull usa 600.' },
          como_root:        { type: 'BOOLEAN', description: 'Si true, conecta como root (evita sudo). Úsalo cuando sudo falle.' },
        },
        required: ['comando'],
      },
    },
    {
      name: 'actualizar_tarea',
      description: 'Actualiza notas o plan de ejecución de una tarea existente.',
      parameters: {
        type: 'OBJECT',
        properties: {
          tarea_id:       { type: 'STRING', description: 'ID de la tarea a actualizar' },
          notas:          { type: 'STRING', description: 'Nuevas notas o instrucciones (opcional)' },
          plan_ejecucion: { type: 'STRING', description: 'Plan de ejecución actualizado (opcional)' },
        },
        required: ['tarea_id'],
      },
    },
    {
      name: 'notificar_usuario',
      description: 'Escala un mensaje al PM Global. SOLO el PM Global habla con el usuario — tú nunca contactas al usuario directamente. Úsalo para reportar resultados o escalar bloqueantes al PM Global.',
      parameters: {
        type: 'OBJECT',
        properties: {
          mensaje: { type: 'STRING', description: 'Mensaje para el PM Global: qué hiciste, qué pasó, qué necesitas que él gestione.' },
        },
        required: ['mensaje'],
      },
    },
    {
      name: 'crear_subtarea',
      description: 'Crea y dispara una nueva tarea para un agente especialista. Úsalo cuando el bloqueante sea técnico.',
      parameters: {
        type: 'OBJECT',
        properties: {
          agente_asignado: {
            type: 'STRING',
            enum: ['dev-backend','dev-bd','dev-frontend','dev-devops','dev-testing','dev-diseno','dev-documentador','dev-ciberseguridad','dev-redes','dev-soporte'],
            description: 'Agente que resolverá el problema técnico',
          },
          descripcion:    { type: 'STRING', description: 'Resumen breve de la tarea' },
          plan_ejecucion: { type: 'STRING', description: 'Plan detallado con pasos, comandos y criterio de éxito.' },
          proyecto_id:    { type: 'STRING', description: 'UUID del proyecto relacionado (opcional)' },
        },
        required: ['agente_asignado', 'descripcion', 'plan_ejecucion'],
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
    // Detectar transiciones de paso del plan a partir del texto
    try {
      const { data: tareaRow } = await db.from('tareas').select('plan_ejecucion').eq('id', tareaId).maybeSingle() as { data: { plan_ejecucion: string | null } | null };
      const pasos = parsePasosDePlan(tareaRow?.plan_ejecucion);
      const detectado = detectarPasoEnTexto(accion, pasos.length);
      if (detectado !== null) pasoActualPorTarea.set(tareaId, detectado);
    } catch {}
    await bitacoraInsert(db, agente, accion, tareaId);
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
      bitacoraInsert(db, agente, `✅ Completado: ${input.resumen}`, tareaId),
    ]);
    setTimeout(() => {
      db.from('avatares').update({ estado_animacion: 'idle' }).eq('agente_nombre', agente)
        .then(() => {}).catch(() => {});
    }, 4000);

    // Notificar al PM responsable para que informe al stakeholder
    try {
      const [{ data: tareaInfo }, { data: primeraEntradaPM }] = await Promise.all([
        db.from('tareas').select('descripcion').eq('id', tareaId).maybeSingle() as Promise<{ data: { descripcion: string } | null }>,
        db.from('bitacora_actividad').select('agente').eq('tarea_id', tareaId).like('agente', '%pm%').order('creado_en', { ascending: true }).limit(1).maybeSingle() as Promise<{ data: { agente: string } | null }>,
      ]);
      const pmResponsable = primeraEntradaPM?.agente ?? 'pm-global';
      const descTarea     = (tareaInfo?.descripcion ?? '').slice(0, 120);
      const resumenCorto  = (input.resumen as string).slice(0, 200);

      await Promise.all([
        bitacoraInsert(db, pmResponsable, `🎉 ${agente} completó su tarea.\n• Tarea: ${descTarea}\n• Resumen: ${resumenCorto}\n→ Puedes informar al stakeholder.`, tareaId),
        db.from('avatares').update({ estado_animacion: 'hablando' }).eq('agente_nombre', pmResponsable),
      ]);
      setTimeout(() => {
        db.from('avatares').update({ estado_animacion: 'idle' }).eq('agente_nombre', pmResponsable)
          .then(() => {}).catch(() => {});
      }, 6000);
    } catch {}

    pasoActualPorTarea.delete(tareaId);
    return { resultado: JSON.stringify({ ok: true }), terminar: true };
  }

  if (nombre === 'reportar_bloqueante') {
    const nota = `🚧 BLOQUEANTE: ${input.problema}\n👉 Acción requerida: ${input.accion_requerida}`;
    await Promise.all([
      db.from('tareas').update({ estado: 'pendiente', notas: nota }).eq('id', tareaId),
      db.from('avatares').update({ estado_animacion: 'idle' }).eq('agente_nombre', agente),
      bitacoraInsert(db, agente, `🚧 Bloqueante: ${input.problema} — ${input.accion_requerida}`, tareaId),
    ]);

    // El PM Global nunca se auto-asigna para gestionar su propio bloqueante — notifica al usuario y para
    if (agente === 'pm-global' || agente.startsWith('pm-')) {
      try {
        await handleTool('notificar_usuario', {
          mensaje: `🚧 **PM Global bloqueado — necesito tu orientación.**\n\n**Problema:** ${input.problema}\n\n**Para continuar necesito:** ${input.accion_requerida}\n\n¿Cómo deseas proceder?`,
        }, agente, tareaId, db);
      } catch {}
      return { resultado: JSON.stringify({ ok: true }), terminar: true };
    }

    // Auto-disparar al PM para que analice y gestione el bloqueante (solo para agentes especialistas)
    try {
      const [{ data: tareaInfo }, { data: primeraEntradaPM }] = await Promise.all([
        db.from('tareas').select('descripcion, plan_ejecucion, requerimiento_id').eq('id', tareaId).maybeSingle() as Promise<{ data: { descripcion: string; plan_ejecucion: string | null; requerimiento_id: string | null } | null }>,
        db.from('bitacora_actividad').select('agente').eq('tarea_id', tareaId).like('agente', '%pm%').order('creado_en', { ascending: true }).limit(1).maybeSingle() as Promise<{ data: { agente: string } | null }>,
      ]);
      const pmResponsable = primeraEntradaPM?.agente ?? 'pm-global';
      const descTarea     = (tareaInfo?.descripcion ?? '').slice(0, 200);
      const planOriginal  = (tareaInfo?.plan_ejecucion ?? '').slice(0, 600);

      const planPM = `Hay un bloqueante reportado por el agente **${agente}**.

## Contexto del bloqueante
- **Agente bloqueado:** ${agente}
- **ID de tarea bloqueada:** ${tareaId}
- **Descripción de la tarea:** ${descTarea}
- **Problema reportado:** ${input.problema}
- **Acción requerida:** ${input.accion_requerida}

## Plan original de la tarea bloqueada (extracto)
${planOriginal}

## Árbol de decisión — SIGUE ESTE ORDEN

### A) Bloqueante TÉCNICO (comando fallido, dependencia, configuración, permisos, entorno):
→ Analiza si otro agente puede resolverlo.
→ Usa \`crear_subtarea\` para crear una tarea al agente adecuado (dev-devops si es infra, dev-backend si es API, etc.).
→ Actualiza también el plan de la tarea bloqueada con \`actualizar_tarea\` si el plan original era incorrecto.
→ Reporta al PM Global con \`notificar_usuario\` explicando qué agente tomará el relevo. NO preguntes nada al usuario.

### B) Bloqueante OPERATIVO / DE NEGOCIO (dato de cliente, credencial de tercero, decisión de diseño, aprobación):
→ NO puedes resolverlo solo — pero TAMPOCO preguntas al usuario directamente.
→ Usa \`notificar_usuario\` para ESCALAR AL PM GLOBAL: describe exactamente qué información o decisión se necesita.
→ El PM Global decidirá si preguntar al usuario o si puede resolverlo con los recursos del sistema.
→ Actualiza las notas de la tarea bloqueada con \`actualizar_tarea\` documentando qué se necesita.

### C) Error transitorio (timeout, red caída, API temporal):
→ Actualiza el plan de la tarea bloqueada con \`actualizar_tarea\` añadiendo instrucciones de reintento.
→ Reporta al PM Global que la tarea puede reanudarse.

## Instrucciones
1. Usa \`log_progreso\` para documentar tu diagnóstico.
2. Aplica la opción A, B o C del árbol de decisión.
3. **OBLIGATORIO**: Llama a \`notificar_usuario\` con un mensaje DIRIGIDO AL PM GLOBAL explicando: agente bloqueado, problema, acción tomada y próximos pasos. **NUNCA pidas información al usuario directamente — solo el PM Global habla con el usuario.**
4. Termina con \`completar_tarea\`.`;

      const insertResult = await db.from('tareas').insert({
        agente_asignado: pmResponsable,
        descripcion: `Gestionar bloqueante de ${agente}: ${(input.problema as string).slice(0, 100)}`,
        plan_ejecucion: planPM,
        estado: 'pendiente',
        ...(tareaInfo?.requerimiento_id ? { requerimiento_id: tareaInfo.requerimiento_id } : {}),
      }).select('id').single();

      const pmTaskId = (insertResult as { data: { id: string } | null }).data?.id;
      if (pmTaskId) {
        await bitacoraInsert(db, pmResponsable, `🚨 ${agente} reportó un bloqueante — iniciando análisis automático.\n• Problema: ${input.problema}\n• Requiere: ${input.accion_requerida}`, pmTaskId);
        // Fire-and-forget: no esperamos que el PM termine para continuar
        ejecutarEspecialista(pmTaskId, db).catch((e: unknown) => {
          console.error('[especialista] auto-trigger PM error:', e);
        });
      }
    } catch (e) {
      console.error('[especialista] Error al auto-disparar PM:', e);
    }
    return { resultado: JSON.stringify({ ok: true }), terminar: true };
  }

  if (nombre === 'notificar_usuario') {
    const mensaje = input.mensaje as string;
    try {
      // Buscar el superadmin (o plataforma_admin como fallback)
      const { data: rowSuper } = await db.from('perfiles')
        .select('id').in('rol', ['superadmin', 'plataforma_admin'])
        .order('created_at', { ascending: true }).limit(1).maybeSingle() as { data: { id: string } | null };

      if (!rowSuper?.id) return { resultado: JSON.stringify({ error: 'No se encontró usuario admin' }), terminar: false };
      const adminId = rowSuper.id;

      // Buscar conversación más recientemente activa del usuario (updated_at para que llegue al chat abierto)
      const { data: conv } = await db.from('conversaciones_pm')
        .select('id').eq('usuario_id', adminId)
        .order('updated_at', { ascending: false }).limit(1).maybeSingle() as { data: { id: string } | null };

      let convId: string | null = conv?.id ?? null;
      if (!convId) {
        const { data: newConv } = await db.from('conversaciones_pm').insert({
          usuario_id: adminId,
          titulo: `Notificación de ${agente}`,
        }).select('id').single() as { data: { id: string } | null };
        convId = newConv?.id ?? null;
      }

      if (!convId) return { resultado: JSON.stringify({ error: 'No se pudo obtener conversación' }), terminar: false };

      await db.from('mensajes_pm').insert({
        conversacion_id: convId,
        rol: 'agente',
        contenido: mensaje,
        metadata: { automatico: true, fuente: agente },
      });

      await bitacoraInsert(db, agente, `📬 Mensaje enviado al usuario: ${mensaje.slice(0, 100)}`, tareaId);
    } catch (e) {
      console.error('[notificar_usuario] error:', e);
    }
    return { resultado: JSON.stringify({ ok: true }), terminar: false };
  }

  if (nombre === 'actualizar_tarea') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {};
    if (input.notas          !== undefined) updates.notas          = input.notas;
    if (input.plan_ejecucion !== undefined) updates.plan_ejecucion = input.plan_ejecucion;

    if (Object.keys(updates).length === 0) {
      return { resultado: JSON.stringify({ error: 'Debes proporcionar al menos notas o plan_ejecucion para actualizar.' }), terminar: false };
    }

    await db.from('tareas').update(updates).eq('id', input.tarea_id);
    const camposActualizados = Object.keys(updates).join(', ');
    await bitacoraInsert(db, agente, `📝 Tarea ${input.tarea_id} actualizada (${camposActualizados})`, tareaId);
    return { resultado: JSON.stringify({ ok: true, actualizados: camposActualizados }), terminar: false };
  }

  if (nombre === 'crear_subtarea') {
    const { agente_asignado, descripcion, plan_ejecucion, proyecto_id } = input as {
      agente_asignado: string; descripcion: string; plan_ejecucion: string; proyecto_id?: string;
    };
    const { data, error } = await db.from('tareas').insert({
      agente_asignado,
      descripcion,
      plan_ejecucion: plan_ejecucion ?? null,
      proyecto_id: proyecto_id ?? null,
      estado: 'pendiente',
    }).select('id').single();

    if (error) return { resultado: JSON.stringify({ error: error.message }), terminar: false };

    await Promise.all([
      bitacoraInsert(db, agente, `📋 Subtarea delegada a ${agente_asignado}: ${descripcion.slice(0, 120)}`, tareaId),
      db.from('avatares').update({ estado_animacion: 'caminando' }).eq('agente_nombre', agente_asignado),
    ]);

    ejecutarEspecialista(data.id, db).catch((e: unknown) => {
      console.error('[crear_subtarea] especialista error:', e);
    });

    return { resultado: JSON.stringify({ ok: true, subtarea_id: data.id }), terminar: false };
  }

  if (nombre === 'ejecutar_ssh' || nombre === 'ejecutar_ssh_env') {
    const esEnv           = nombre === 'ejecutar_ssh_env';
    const comoRoot        = !!(input.como_root as boolean);
    const host            = esEnv ? (process.env.VPS_HOST || process.env.SSH_DEFAULT_HOST || '') : ((input.host as string) || process.env.VPS_HOST || process.env.SSH_DEFAULT_HOST || '');
    const usuarioBase     = esEnv ? (process.env.VPS_USER || process.env.SSH_DEFAULT_USER || '') : ((input.usuario as string) || process.env.VPS_USER || process.env.SSH_DEFAULT_USER || '');
    const usuario         = comoRoot ? 'root' : (usuarioBase || '');
    const password        = (input.password as string) || process.env.SSH_KEY_PASSPHRASE || process.env.SSH_DEFAULT_PASSWORD || '';
    const comando         = input.comando as string;
    const timeoutMs       = ((input.timeout_segundos as number) || 300) * 1000;

    if (!host || !usuario) {
      return { resultado: JSON.stringify({ error: 'Credenciales SSH incompletas. Asegúrate de que VPS_HOST y VPS_USER estén en el entorno.' }), terminar: false };
    }

    // Detectar uso incorrecto: nunca ejecutar el comando ssh dentro de ejecutar_ssh
    // (la herramienta ya maneja la conexión — intentar ssh dentro cuelga esperando TTY)
    const cmdTrimmed = comando.trim().toLowerCase();
    if (cmdTrimmed.startsWith('ssh ') || cmdTrimmed === 'ssh') {
      return {
        resultado: JSON.stringify({
          error: 'ERROR DE USO: No uses el comando "ssh" dentro de ejecutar_ssh. Esta herramienta YA establece la conexión SSH automáticamente. Pasa directamente el comando que quieres ejecutar en el servidor (ej: "sudo apt update"). El paso de conexión ya está resuelto.',
        }),
        terminar: false,
      };
    }

    // Log del comando ejecutado (sin contraseña)
    await bitacoraInsert(db, agente, `🖥️ SSH [${host}]: ${comando.slice(0, 200)}`, tareaId);

    try {
      const { stdout, stderr, exitCode } = await ejecutarSSH(host, usuario, password, comando, timeoutMs);
      const salida = stdout.slice(0, 2000) + (stderr ? `\n[STDERR] ${stderr.slice(0, 500)}` : '');

      await bitacoraInsert(db, agente, `📤 SSH resultado (exit ${exitCode}):\n${salida}`, tareaId);

      return {
        resultado: JSON.stringify({ exitCode, stdout: stdout.slice(0, 3000), stderr: stderr.slice(0, 500) }),
        terminar: false,
      };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      await bitacoraInsert(db, agente, `❌ SSH error: ${errMsg}`, tareaId);
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
export async function ejecutarEspecialista(tareaId: string, db: DB, prevContexto?: string): Promise<void> {
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
  // Reset paso actual al inicio (pasos del plan se detectarán por log_progreso)
  pasoActualPorTarea.set(tareaId, prevContexto ? (pasoActualPorTarea.get(tareaId) ?? null) : null);
  await Promise.all([
    db.from('tareas').update({ estado: 'en_progreso', iniciado_en: new Date().toISOString() }).eq('id', tareaId),
    db.from('avatares').update({ estado_animacion: 'trabajando' }).eq('agente_nombre', agente),
    bitacoraInsert(db, agente, prevContexto ? `⏯️ Reanudando con ${modelo}: ${descripcion}` : `🤖 Iniciando con ${modelo}: ${descripcion}`, tareaId),
  ]);

  const resumptionSection = prevContexto
    ? `\n## ⏯️ REANUDACIÓN — continúa desde donde te quedaste\n\nFuiste interrumpido. Historial de acciones previas (más reciente primero):\n\n${prevContexto}\n\n> **CRÍTICO**: Analiza el historial. Identifica el último paso completado exitosamente. Comienza desde el SIGUIENTE paso no completado. No repitas pasos ya realizados.\n`
    : '';

  const vpsHost = process.env.VPS_HOST ?? '';
  const vpsUser = process.env.VPS_USER ?? '';
  const vpsSection = vpsHost
    ? `\n## Conexión VPS\n- **Host:** \`${vpsHost}\`  **Usuario:** \`${vpsUser}\`\n- Las credenciales SSH (llave, passphrase, sudo password) se leen automáticamente del entorno — no necesitas pedirlas al usuario ni incluirlas en el plan.\n`
    : '';

  const systemPrompt = `Eres **${agente}**, ${descAgente}.

## Tu tarea actual
**Descripción:** ${descripcion}

## Plan de ejecución
${plan}
${resumptionSection}
---
${vpsSection}
## Jerarquía de comunicación
**NUNCA contactes al usuario directamente.** Solo el PM Global habla con el usuario.
Tu cadena es: tú → PM de área → PM Global → usuario.
- Si tienes resultados para reportar: usa \`notificar_usuario\` para enviárselos al PM Global.
- Si tienes un bloqueante: usa \`reportar_bloqueante\` para escalarlo al PM.
- **Nunca preguntes al usuario por credenciales, datos de acceso o decisiones** — escala al PM Global con \`notificar_usuario\` describiendo qué necesitas.

## Herramientas disponibles
- **log_progreso**: Registra cada paso que ejecutas.
- **ejecutar_ssh_env**: **PREFERIDA** para el VPS principal. Ejecuta un comando sin pasar host/usuario/password — todo desde entorno. Solo necesitas el \`comando\`. Para comandos systemctl en el servidor usa siempre \`--no-pager\` (ej: \`SYSTEMD_PAGER= systemctl --no-pager status nginx\`).
- **ejecutar_ssh**: Para servidores distintos al VPS principal. Requiere \`host\` y \`usuario\`. Puedes omitir \`password\` si la passphrase está en el entorno.
- **actualizar_tarea**: Actualiza el plan o notas de otra tarea existente.
- **notificar_usuario**: Escala resultados o bloqueantes al PM Global. **Obligatorio usarlo** al terminar para reportar al PM Global qué hiciste o qué necesitas.
- **completar_tarea**: Marca la tarea como terminada.
- **reportar_bloqueante**: Solo si algo es genuinamente imposible de resolver (error irrecuperable, permiso de proveedor externo).

## Instrucciones
1. Ejecuta el plan paso a paso.
2. **OBLIGATORIO**: Cada comando en servidor DEBE ejecutarse con \`ejecutar_ssh\`. No describas lo que harías — hazlo.
3. Llama \`log_progreso\` solo DESPUÉS de recibir el resultado real de \`ejecutar_ssh\`, incluyendo el output obtenido.
4. Encadena pasos secuenciales en un solo \`ejecutar_ssh\` con &&.
5. Verifica cada paso: si el exit code no es 0 o el output indica error, investiga antes de continuar.
6. Al terminar todos los pasos con resultados reales verificados: llama \`completar_tarea\`.
7. Responde siempre en español.

## ⛔ PROHIBIDO
- Usar \`log_progreso\` para describir un paso que AÚN NO ejecutaste con \`ejecutar_ssh\`.
- Llamar \`completar_tarea\` sin haber ejecutado cada paso del plan con \`ejecutar_ssh\` y verificado su resultado.
- Asumir que un comando funcionó sin ver el output real.
- Ejecutar \`systemctl\` sin \`--no-pager\` — el pager bloquea el SSH indefinidamente. Usa siempre: \`SYSTEMD_PAGER= systemctl --no-pager status <servicio>\`.

## REGLA CRÍTICA para ejecutar_ssh
**NUNCA pongas \`ssh usuario@host\` como el \`comando\`.**
La herramienta YA establece la conexión con llave privada automáticamente. El parámetro \`comando\` es lo que se ejecuta DENTRO del servidor (ej: \`docker ps\`, \`sudo apt install -y docker.io\`).
Si el plan dice "Conectarse vía SSH", ese paso ya está implícito — pasa directamente al primer comando real.`;

  function esErrorDeRed(e: unknown): boolean {
    const msg = e instanceof Error ? e.message : String(e);
    return msg.includes('fetch failed') || msg.includes('ECONNRESET') ||
           msg.includes('ETIMEDOUT') || msg.includes('ENOTFOUND') ||
           msg.includes('network') || msg.includes('socket');
  }

  // Helper: verifica si la tarea sigue en_progreso (ningún tool terminal fue llamado)
  async function verificarYNotificarSiAtascado(motivo: string) {
    try {
      const { data: tareaFinal } = await db.from('tareas').select('estado').eq('id', tareaId).maybeSingle();
      if (tareaFinal?.estado !== 'en_progreso') return;

      // El PM Global nunca se auto-asigna más tareas — pregunta al usuario directamente
      if (agente === 'pm-global' || agente.startsWith('pm-')) {
        await db.from('tareas').update({
          estado: 'pendiente',
          notas: `⚠️ Requiere orientación del usuario: ${motivo}`,
        }).eq('id', tareaId);
        await handleTool('notificar_usuario', {
          mensaje: `⚠️ **PM Global necesita tu orientación.**\n\n${motivo}\n\nID de tarea: \`${tareaId}\`\n\n¿Cómo deseas proceder? Puedes darme más contexto o instrucciones adicionales.`,
        }, agente, tareaId, db);
      } else {
        // Agente especialista: escala al PM como siempre
        await handleTool('reportar_bloqueante', {
          problema: motivo,
          accion_requerida: 'Revisar la bitácora, ajustar el plan de ejecución y reanudar la tarea',
        }, agente, tareaId, db);
      }
    } catch (e2) {
      console.error(`[especialista:${agente}] verificarYNotificarSiAtascado error:`, e2);
    }
  }

  try {
    if (tieneAnthropic) {
      try {
        await loopClaude(systemPrompt, tareaId, agente, db);
        // Si el loop terminó normalmente pero la tarea sigue en_progreso → agotó iteraciones sin resolver
        await verificarYNotificarSiAtascado('El agente agotó el límite de iteraciones (10) sin completar la tarea ni reportar un bloqueante explícito');
        return;
      } catch (claudeErr: unknown) {
        const msg = claudeErr instanceof Error ? claudeErr.message : String(claudeErr);
        // Fallback si es error de créditos/autenticación y tenemos Gemini
        const esCreditError = msg.includes('credit') || msg.includes('401') || msg.includes('403');
        if (!esCreditError || !tieneGemini) throw claudeErr;

        await bitacoraInsert(db, agente, `⚠️ Anthropic sin créditos — cambiando a gemini-2.5-flash`, tareaId);
      }
    }

    // Gemini con retry automático para errores de red transitorios
    const MAX_REINTENTOS = 3;
    for (let intento = 0; intento < MAX_REINTENTOS; intento++) {
      try {
        await loopGemini(systemPrompt, tareaId, agente, db);
        // Igual que Claude: verificar si quedó atascado
        await verificarYNotificarSiAtascado('El agente agotó el límite de iteraciones (10) con Gemini sin completar la tarea ni reportar un bloqueante explícito');
        return;
      } catch (geminiErr: unknown) {
        if (!esErrorDeRed(geminiErr) || intento === MAX_REINTENTOS - 1) throw geminiErr;
        const delaySeg = (intento + 1) * 5;
        await bitacoraInsert(db, agente, `⚠️ Gemini error de red (intento ${intento + 1}/${MAX_REINTENTOS}), reintentando en ${delaySeg}s…`, tareaId);
        await new Promise(r => setTimeout(r, delaySeg * 1000));
      }
    }

  } catch (e) {
    console.error(`[especialista:${agente}] error:`, e);
    const msg = e instanceof Error ? e.message : String(e);
    await bitacoraInsert(db, agente, `❌ Error en ejecución: ${msg}`, tareaId);
    // Si es un error transitorio, regresar a pendiente para que el usuario pueda reanudar
    if (esErrorDeRed(e) || msg.includes('credit') || msg.includes('overloaded')) {
      await db.from('tareas').update({
        estado: 'pendiente',
        iniciado_en: null,
        notas: `Error transitorio (${new Date().toLocaleTimeString('es-MX')}): ${msg.slice(0, 200)}. Puedes reanudar la tarea.`,
      }).eq('id', tareaId);
    } else {
      await db.from('tareas').update({ notas: `Error: ${msg}` }).eq('id', tareaId);
    }
    await db.from('avatares').update({ estado_animacion: 'idle' }).eq('agente_nombre', agente);
    // Notificar al PM Global sobre el crash para que lo gestione proactivamente
    try {
      await handleTool('notificar_usuario', {
        mensaje: `⚠️ **${agente}** falló con un error inesperado.\n\n**Tarea:** ${tareaId}\n**Error:** ${msg.slice(0, 300)}\n\nLa tarea puede reanudarse una vez revisado el problema. Consulta la bitácora para más detalles.`,
      }, agente, tareaId, db);
    } catch {}
  }
}

export function makeDb() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
