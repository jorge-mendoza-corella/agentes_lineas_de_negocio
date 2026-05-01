import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { Client as SshClient } from 'ssh2';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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

    if (fs.existsSync(keyPath)) {
      connectOpts.privateKey = fs.readFileSync(keyPath);
      if (passphrase) connectOpts.passphrase = passphrase;
    } else {
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
    description: 'Ejecuta un comando en un servidor remoto vía SSH usando llave privada (configurada en el servidor). El campo password es la passphrase de la llave privada, pero si ya está en el entorno no es necesario. Úsalo para instalar paquetes, configurar servicios, editar archivos y cualquier operación en el VPS. Siempre usa -y en comandos apt.',
    input_schema: {
      type: 'object',
      properties: {
        host:             { type: 'string', description: 'IP o hostname del servidor (ej: 45.232.252.100)' },
        usuario:          { type: 'string', description: 'Usuario SSH (ej: srvsozu). Para ejecutar como root usa "root".' },
        password:         { type: 'string', description: 'Passphrase de la llave privada SSH (dejar vacío si está en el entorno)' },
        comando:          { type: 'string', description: 'Comando shell a ejecutar en el servidor. Usa && para encadenar pasos. Si usuario es root, NO uses sudo.' },
        timeout_segundos: { type: 'number', description: 'Timeout en segundos. Default 300. Para apt install / docker pull usa 600 o más.' },
        como_root:        { type: 'boolean', description: 'Si true, conecta como usuario root (evita sudo completamente). Úsalo cuando sudo falle o para comandos de sistema.' },
      },
      required: ['host', 'usuario', 'comando'],
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
    description: 'Envía un mensaje directo al superadmin en su chat del PM. Úsalo SIEMPRE al finalizar tu análisis para comunicar al usuario el resultado: qué pasó, qué hiciste y qué necesita saber o hacer.',
    input_schema: {
      type: 'object',
      properties: {
        mensaje: { type: 'string', description: 'Mensaje claro y conciso para el usuario. Incluye contexto, problema, acción tomada y próximos pasos si aplica.' },
      },
      required: ['mensaje'],
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
          host:             { type: 'STRING', description: 'IP del servidor' },
          usuario:          { type: 'STRING', description: 'Usuario SSH. Para root usa "root".' },
          password:         { type: 'STRING', description: 'Contraseña SSH' },
          comando:          { type: 'STRING', description: 'Comando shell a ejecutar. Si usuario es root, NO uses sudo.' },
          timeout_segundos: { type: 'NUMBER', description: 'Timeout en segundos. Default 300. Para apt install / docker pull usa 600.' },
          como_root:        { type: 'BOOLEAN', description: 'Si true, conecta como root (evita sudo). Úsalo cuando sudo falle.' },
        },
        required: ['host', 'usuario', 'password', 'comando'],
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
      description: 'Envía un mensaje directo al superadmin en el chat del PM. Úsalo SIEMPRE al terminar para comunicar resultado.',
      parameters: {
        type: 'OBJECT',
        properties: {
          mensaje: { type: 'STRING', description: 'Mensaje para el usuario: qué pasó, acción tomada, qué necesita hacer.' },
        },
        required: ['mensaje'],
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
        db.from('bitacora_actividad').insert({
          agente: pmResponsable,
          accion: `🎉 ${agente} completó su tarea.\n• Tarea: ${descTarea}\n• Resumen: ${resumenCorto}\n→ Puedes informar al stakeholder.`,
          tarea_id: tareaId,
        }),
        db.from('avatares').update({ estado_animacion: 'hablando' }).eq('agente_nombre', pmResponsable),
      ]);
      setTimeout(() => {
        db.from('avatares').update({ estado_animacion: 'idle' }).eq('agente_nombre', pmResponsable)
          .then(() => {}).catch(() => {});
      }, 6000);
    } catch {}

    return { resultado: JSON.stringify({ ok: true }), terminar: true };
  }

  if (nombre === 'reportar_bloqueante') {
    const nota = `🚧 BLOQUEANTE: ${input.problema}\n👉 Acción requerida: ${input.accion_requerida}`;
    await Promise.all([
      db.from('tareas').update({ estado: 'pendiente', notas: nota }).eq('id', tareaId),
      db.from('avatares').update({ estado_animacion: 'idle' }).eq('agente_nombre', agente),
      db.from('bitacora_actividad').insert({ agente, accion: `🚧 Bloqueante: ${input.problema} — ${input.accion_requerida}`, tarea_id: tareaId }),
    ]);
    // Auto-disparar al PM para que analice y gestione el bloqueante
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

## Tu misión
1. Usa \`log_progreso\` para documentar tu análisis del bloqueante.
2. Evalúa si el bloqueante es resoluble actualizando el plan (ej: credenciales SSH incorrectas → actualizarlas, comando que falló → corregir la sintaxis, pasos faltantes → agregarlos).
3. Si es resoluble: usa \`actualizar_tarea\` con tarea_id="${tareaId}" para actualizar el \`plan_ejecucion\` o las \`notas\` con instrucciones corregidas. El agente será re-ejecutado por el superadmin con el plan actualizado.
4. Si requiere intervención humana: documenta exactamente qué se necesita en \`log_progreso\`.
5. **OBLIGATORIO**: Llama a \`notificar_usuario\` con un mensaje claro que explique al superadmin: qué agente se bloqueó, cuál es el problema, qué hiciste para resolverlo (o qué necesita hacer el usuario). El usuario NO ve la bitácora — solo ve este mensaje.
6. Termina llamando a \`completar_tarea\` con un resumen de tu análisis y acción tomada.`;

      const insertResult = await db.from('tareas').insert({
        agente_asignado: pmResponsable,
        descripcion: `Gestionar bloqueante de ${agente}: ${(input.problema as string).slice(0, 100)}`,
        plan_ejecucion: planPM,
        estado: 'pendiente',
        ...(tareaInfo?.requerimiento_id ? { requerimiento_id: tareaInfo.requerimiento_id } : {}),
      }).select('id').single();

      const pmTaskId = (insertResult as { data: { id: string } | null }).data?.id;
      if (pmTaskId) {
        await db.from('bitacora_actividad').insert({
          agente: pmResponsable,
          accion: `🚨 ${agente} reportó un bloqueante — iniciando análisis automático.\n• Problema: ${input.problema}\n• Requiere: ${input.accion_requerida}`,
          tarea_id: pmTaskId,
        });
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

      // Buscar conversación más reciente del usuario
      const { data: conv } = await db.from('conversaciones_pm')
        .select('id').eq('usuario_id', adminId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle() as { data: { id: string } | null };

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

      await db.from('bitacora_actividad').insert({
        agente,
        accion: `📬 Mensaje enviado al usuario: ${mensaje.slice(0, 100)}`,
        tarea_id: tareaId,
      });
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
    await db.from('bitacora_actividad').insert({
      agente,
      accion: `📝 Tarea ${input.tarea_id} actualizada (${camposActualizados})`,
      tarea_id: tareaId,
    });
    return { resultado: JSON.stringify({ ok: true, actualizados: camposActualizados }), terminar: false };
  }

  if (nombre === 'ejecutar_ssh') {
    const comoRoot        = !!(input.como_root as boolean);
    const host            = (input.host     as string) || process.env.SSH_DEFAULT_HOST;
    const usuarioBase     = (input.usuario  as string) || process.env.SSH_DEFAULT_USER;
    const usuario         = comoRoot ? 'root' : (usuarioBase || '');
    const password        = (input.password as string) || process.env.SSH_DEFAULT_PASSWORD;
    const comando         = input.comando as string;
    const timeoutMs       = ((input.timeout_segundos as number) || 300) * 1000;

    if (!host || !usuario || !password) {
      return { resultado: JSON.stringify({ error: 'Credenciales SSH incompletas. Proporciona host, usuario y password.' }), terminar: false };
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
    await db.from('bitacora_actividad').insert({
      agente,
      accion: `🖥️ SSH [${host}]: ${comando.slice(0, 200)}`,
      tarea_id: tareaId,
    });

    try {
      const { stdout, stderr, exitCode } = await ejecutarSSH(host, usuario, password, comando, timeoutMs);
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
  await Promise.all([
    db.from('tareas').update({ estado: 'en_progreso', iniciado_en: new Date().toISOString() }).eq('id', tareaId),
    db.from('avatares').update({ estado_animacion: 'trabajando' }).eq('agente_nombre', agente),
    db.from('bitacora_actividad').insert({
      agente,
      accion: prevContexto ? `⏯️ Reanudando con ${modelo}: ${descripcion}` : `🤖 Iniciando con ${modelo}: ${descripcion}`,
      tarea_id: tareaId,
    }),
  ]);

  const resumptionSection = prevContexto
    ? `\n## ⏯️ REANUDACIÓN — continúa desde donde te quedaste\n\nFuiste interrumpido. Historial de acciones previas (más reciente primero):\n\n${prevContexto}\n\n> **CRÍTICO**: Analiza el historial. Identifica el último paso completado exitosamente. Comienza desde el SIGUIENTE paso no completado. No repitas pasos ya realizados.\n`
    : '';

  const systemPrompt = `Eres **${agente}**, ${descAgente}.

## Tu tarea actual
**Descripción:** ${descripcion}

## Plan de ejecución
${plan}
${resumptionSection}
---

## Herramientas disponibles
- **log_progreso**: Registra cada paso que ejecutas.
- **ejecutar_ssh**: Ejecuta comandos reales en servidores remotos vía SSH. Si el plan incluye credenciales SSH (usuario, contraseña, IP), úsalas directamente en esta herramienta. Puedes encadenar comandos con &&. Para comandos lentos (apt install, docker pull, docker-compose up) usa \`timeout_segundos: 600\` o más.
- **actualizar_tarea**: Actualiza el plan o notas de otra tarea existente (úsala como PM para corregir el plan de una tarea bloqueada).
- **notificar_usuario**: Envía un mensaje directo al superadmin en el chat. **Obligatorio usarlo** antes de llamar \`completar_tarea\` cuando tengas información relevante para el usuario.
- **completar_tarea**: Marca la tarea como terminada.
- **reportar_bloqueante**: Solo si algo es genuinamente imposible de resolver (credenciales incorrectas, permiso del proveedor, etc.).

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

## REGLA CRÍTICA para ejecutar_ssh
**NUNCA pongas \`ssh usuario@host\` como el \`comando\`.**
La herramienta YA establece la conexión con llave privada automáticamente. El parámetro \`comando\` es lo que se ejecuta DENTRO del servidor (ej: \`docker ps\`, \`sudo apt install -y docker.io\`).
Si el plan dice "Conectarse vía SSH", ese paso ya está implícito — pasa directamente al primer comando real.`;

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
