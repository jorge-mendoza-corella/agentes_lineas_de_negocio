import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { buildSystemPrompt } from '@/lib/pm/system-prompt';
import { ejecutarEspecialista } from '@/lib/agent/especialista';
import type { Database } from '@agentes/db';

export const runtime = 'nodejs';
export const maxDuration = 300;

function serviceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

// ---------------------------------------------------------------------------
// Transcripción de audio con Google Gemini (STT)
// ---------------------------------------------------------------------------
async function transcribirConGemini(audioBase64: string, mimeType: string): Promise<string> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_GEMINI_API_KEY no está configurada');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const result = await model.generateContent([
    'Transcribe exactamente este mensaje de voz en español. Responde únicamente con la transcripción, sin texto adicional ni explicaciones:',
    { inlineData: { data: audioBase64, mimeType: mimeType.split(';')[0] ?? mimeType } },
  ]);
  return result.response.text().trim();
}

// ---------------------------------------------------------------------------
// Herramientas — Claude (primario)
// ---------------------------------------------------------------------------
const CLAUDE_TOOLS: Anthropic.Tool[] = [
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
          description: 'Agente que ejecutará la tarea',
        },
        descripcion:       { type: 'string', description: 'Qué debe hacer exactamente el agente (resumen breve)' },
        plan_ejecucion:    { type: 'string', description: 'Plan detallado: pasos numerados, comandos específicos, configuraciones, criterios de éxito. Sé exhaustivo.' },
        proyecto_id:       { type: 'string', description: 'UUID del proyecto al que pertenece esta tarea (muy importante para que aparezca en la vista de proyecto)' },
        requerimiento_id:  { type: 'string', description: 'UUID del requerimiento (opcional)' },
        rama:              { type: 'string', description: 'Rama de Git sugerida (opcional)' },
      },
      required: ['agente_asignado', 'descripcion', 'plan_ejecucion'],
    },
  },
  {
    name: 'actualizar_avatar_estado',
    description: 'Actualiza la animación del avatar de un agente en el canvas Sims.',
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
    description: 'Obtiene los proyectos activos del sistema para contextualizar la respuesta.',
    input_schema: {
      type: 'object',
      properties: {
        estado: { type: 'string', enum: ['activo','pausado','cerrado'], description: 'Filtrar por estado (opcional)' },
      },
    },
  },
  {
    name: 'consultar_tareas',
    description: 'Consulta las tareas REALES registradas en BD. Úsalo siempre para saber el estado real de lo que está trabajando un agente — nunca inferir.',
    input_schema: {
      type: 'object',
      properties: {
        agente_asignado: { type: 'string', description: 'Filtrar por agente (ej: dev-devops)' },
        estado: { type: 'string', enum: ['pendiente','en_progreso','completada','cancelada'], description: 'Filtrar por estado' },
        limite: { type: 'number', description: 'Máximo de resultados (default 10)' },
      },
    },
  },
  {
    name: 'consultar_bitacora',
    description: 'Lee el log real de actividad de los agentes. Úsalo para saber exactamente qué hizo un agente o el progreso de una tarea.',
    input_schema: {
      type: 'object',
      properties: {
        tarea_id: { type: 'string', description: 'UUID de la tarea para ver su historial de actividad' },
        agente:   { type: 'string', description: 'Filtrar por agente' },
        limite:   { type: 'number', description: 'Máximo de entradas (default 20)' },
      },
    },
  },
  {
    name: 'actualizar_tarea',
    description: 'Actualiza el estado de una tarea y agrega notas de progreso. Úsalo para marcar avances o completar tareas.',
    input_schema: {
      type: 'object',
      properties: {
        tarea_id: { type: 'string', description: 'UUID de la tarea' },
        estado:   { type: 'string', enum: ['pendiente','en_progreso','completada','cancelada'], description: 'Nuevo estado' },
        notas:    { type: 'string', description: 'Nota de progreso o resultado obtenido' },
      },
      required: ['tarea_id', 'estado'],
    },
  },
];

// ---------------------------------------------------------------------------
// Herramientas — Gemini (fallback)
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GEMINI_TOOLS: any[] = [{
  functionDeclarations: [
    {
      name: 'log_bitacora',
      description: 'Registra una acción en la bitácora de actividad. Úsalo para cada decisión o acción importante.',
      parameters: {
        type: 'OBJECT',
        properties: {
          agente:      { type: 'STRING', description: 'Nombre del agente, ej: pm-global' },
          accion:      { type: 'STRING', description: 'Descripción de la acción realizada' },
          proyecto_id: { type: 'STRING', description: 'UUID del proyecto relacionado (opcional)' },
          tarea_id:    { type: 'STRING', description: 'UUID de la tarea relacionada (opcional)' },
        },
        required: ['agente', 'accion'],
      },
    },
    {
      name: 'crear_tarea',
      description: 'Crea una tarea asignada a un agente especialista. SIEMPRE incluye plan_ejecucion con los pasos concretos, comandos y criterios de éxito.',
      parameters: {
        type: 'OBJECT',
        properties: {
          agente_asignado: {
            type: 'STRING',
            enum: [
              'dev-pm','dev-analista','dev-backend','dev-bd','dev-frontend','dev-devops',
              'dev-testing','dev-diseno','dev-documentador','dev-seguridad','dev-ciberseguridad',
              'dev-redes','dev-soporte','dev-imagenes','dev-presentaciones','dev-videojuegos',
            ],
            description: 'Agente que ejecutará la tarea',
          },
          descripcion:      { type: 'STRING', description: 'Qué debe hacer exactamente el agente (resumen breve)' },
          plan_ejecucion:   { type: 'STRING', description: 'Plan detallado: pasos numerados, comandos específicos, configuraciones, criterios de éxito.' },
          proyecto_id:      { type: 'STRING', description: 'UUID del proyecto al que pertenece esta tarea' },
          requerimiento_id: { type: 'STRING', description: 'UUID del requerimiento (opcional)' },
          rama:             { type: 'STRING', description: 'Rama de Git sugerida (opcional)' },
        },
        required: ['agente_asignado', 'descripcion', 'plan_ejecucion'],
      },
    },
    {
      name: 'actualizar_avatar_estado',
      description: 'Actualiza la animación del avatar de un agente en el canvas Sims.',
      parameters: {
        type: 'OBJECT',
        properties: {
          agente_nombre:    { type: 'STRING', description: 'Ej: pm-global, dev-backend' },
          estado_animacion: { type: 'STRING', enum: ['idle','caminando','trabajando','hablando','celebrando'] },
        },
        required: ['agente_nombre', 'estado_animacion'],
      },
    },
    {
      name: 'consultar_proyectos',
      description: 'Obtiene los proyectos activos del sistema para contextualizar la respuesta.',
      parameters: {
        type: 'OBJECT',
        properties: {
          estado: { type: 'STRING', enum: ['activo','pausado','cerrado'], description: 'Filtrar por estado (opcional)' },
        },
      },
    },
    {
      name: 'consultar_tareas',
      description: 'Consulta las tareas REALES en BD. Úsalo siempre para saber el estado real de un agente — nunca inferir.',
      parameters: {
        type: 'OBJECT',
        properties: {
          agente_asignado: { type: 'STRING', description: 'Filtrar por agente (ej: dev-devops)' },
          estado: { type: 'STRING', enum: ['pendiente','en_progreso','completada','cancelada'] },
          limite: { type: 'NUMBER', description: 'Máximo de resultados (default 10)' },
        },
      },
    },
    {
      name: 'consultar_bitacora',
      description: 'Lee el log real de actividad. Úsalo para saber exactamente qué hizo un agente o el progreso de una tarea.',
      parameters: {
        type: 'OBJECT',
        properties: {
          tarea_id: { type: 'STRING', description: 'UUID de la tarea para ver su historial' },
          agente:   { type: 'STRING', description: 'Filtrar por agente' },
          limite:   { type: 'NUMBER', description: 'Máximo de entradas (default 20)' },
        },
      },
    },
    {
      name: 'actualizar_tarea',
      description: 'Actualiza el estado de una tarea y agrega notas de progreso.',
      parameters: {
        type: 'OBJECT',
        properties: {
          tarea_id: { type: 'STRING', description: 'UUID de la tarea' },
          estado:   { type: 'STRING', enum: ['pendiente','en_progreso','completada','cancelada'] },
          notas:    { type: 'STRING', description: 'Nota de progreso o resultado' },
        },
        required: ['tarea_id', 'estado'],
      },
    },
  ],
}];

// ---------------------------------------------------------------------------
// Ejecución de herramientas (compartida)
// ---------------------------------------------------------------------------
async function ejecutarTool(
  nombre: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: Record<string, any>,
  db: ReturnType<typeof serviceClient>
): Promise<string> {
  try {
    switch (nombre) {
      case 'log_bitacora': {
        const { agente, accion, proyecto_id, tarea_id } = input as {
          agente: string; accion: string; proyecto_id?: string; tarea_id?: string;
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (db as any).from('bitacora_actividad').insert({
          agente, accion, proyecto_id: proyecto_id ?? null, tarea_id: tarea_id ?? null,
        });
        return error ? JSON.stringify({ error: error.message }) : JSON.stringify({ ok: true });
      }
      case 'crear_tarea': {
        const { requerimiento_id, agente_asignado, descripcion, rama, plan_ejecucion, proyecto_id } = input as {
          requerimiento_id?: string; agente_asignado: string; descripcion: string;
          rama?: string; plan_ejecucion?: string; proyecto_id?: string;
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb = db as any;
        const { data, error } = await sb.from('tareas').insert({
          requerimiento_id: requerimiento_id ?? null,
          agente_asignado,
          descripcion,
          plan_ejecucion: plan_ejecucion ?? null,
          proyecto_id: proyecto_id ?? null,
          rama: rama ?? null,
          estado: 'pendiente',
        }).select('id').single();
        if (error) return JSON.stringify({ error: error.message });
        // Auto-log en nombre del especialista + moverlo hacia su escritorio
        await Promise.all([
          sb.from('bitacora_actividad').insert({
            agente: agente_asignado,
            accion: `Tarea recibida: ${descripcion}`,
            tarea_id: data?.id ?? null,
          }),
          sb.from('avatares').update({ estado_animacion: 'caminando' }).eq('agente_nombre', agente_asignado),
        ]);
        // Disparar ejecución del especialista en background (sin await — el PM responde al usuario ya)
        if (data?.id) {
          // PM Global camina al área de trabajo mientras entrega la tarea
          await db.from('avatares').update({ estado_animacion: 'caminando' }).eq('agente_nombre', 'pm-global');
          setTimeout(async () => {
            try { await db.from('avatares').update({ estado_animacion: 'trabajando' }).eq('agente_nombre', 'pm-global'); } catch {}
          }, 1800);
          ejecutarEspecialista(data.id, db).catch(e =>
            console.error(`[crear_tarea] especialista ${agente_asignado} error:`, e)
          );
        }
        return JSON.stringify({ ok: true, id: data?.id });
      }
      case 'actualizar_avatar_estado': {
        const { agente_nombre, estado_animacion } = input as { agente_nombre: string; estado_animacion: string };
        const { error } = await db.from('avatares').update({ estado_animacion }).eq('agente_nombre', agente_nombre);
        return error ? JSON.stringify({ error: error.message }) : JSON.stringify({ ok: true });
      }
      case 'consultar_proyectos': {
        const { estado } = input as { estado?: string };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q: any = db.from('proyectos').select('id,nombre,descripcion,estado,creado_en').order('creado_en', { ascending: false }).limit(10);
        if (estado) q = q.eq('estado', estado);
        const { data, error } = await q;
        return error ? JSON.stringify({ error: error.message }) : JSON.stringify({ proyectos: data });
      }
      case 'consultar_tareas': {
        const { agente_asignado, estado, limite } = input as {
          agente_asignado?: string; estado?: string; limite?: number;
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q: any = (db as any)
          .from('tareas')
          .select('id,agente_asignado,descripcion,estado,notas,rama,creado_en')
          .order('creado_en', { ascending: false })
          .limit(limite ?? 10);
        if (agente_asignado) q = q.eq('agente_asignado', agente_asignado);
        if (estado) q = q.eq('estado', estado);
        const { data, error } = await q;
        return error ? JSON.stringify({ error: error.message }) : JSON.stringify({ tareas: data ?? [] });
      }
      case 'consultar_bitacora': {
        const { tarea_id, agente, limite } = input as {
          tarea_id?: string; agente?: string; limite?: number;
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q: any = (db as any)
          .from('bitacora_actividad')
          .select('id,agente,accion,tarea_id,proyecto_id,creado_en')
          .order('creado_en', { ascending: false })
          .limit(limite ?? 20);
        if (tarea_id) q = q.eq('tarea_id', tarea_id);
        if (agente) q = q.eq('agente', agente);
        const { data, error } = await q;
        return error ? JSON.stringify({ error: error.message }) : JSON.stringify({ entradas: data ?? [] });
      }
      case 'actualizar_tarea': {
        const { tarea_id, estado, notas } = input as {
          tarea_id: string; estado: string; notas?: string;
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb2 = db as any;
        // Obtener el agente asignado para loggear y animar en su nombre
        const { data: tareaActual } = await sb2.from('tareas').select('agente_asignado,descripcion').eq('id', tarea_id).single();
        const agente = tareaActual?.agente_asignado as string | undefined;

        const updates: Record<string, unknown> = { estado };
        if (notas !== undefined) updates.notas = notas;
        if (estado === 'en_progreso') updates.iniciado_en = new Date().toISOString();
        if (estado === 'completada' || estado === 'cancelada') updates.completado_en = new Date().toISOString();

        const { error } = await sb2.from('tareas').update(updates).eq('id', tarea_id);
        if (error) return JSON.stringify({ error: error.message });

        // Auto-log y avatar del especialista
        if (agente) {
          const estadoAnim =
            estado === 'en_progreso' ? 'trabajando' :
            estado === 'completada'  ? 'celebrando' : 'idle';
          const accionLog =
            estado === 'en_progreso' ? `Iniciando: ${tareaActual?.descripcion ?? ''}` :
            estado === 'completada'  ? `Completado: ${tareaActual?.descripcion ?? ''}${notas ? ` — ${notas}` : ''}` :
            estado === 'cancelada'   ? `Cancelado: ${tareaActual?.descripcion ?? ''}` :
            `Estado actualizado a ${estado}`;
          await Promise.all([
            sb2.from('bitacora_actividad').insert({ agente, accion: accionLog, tarea_id }),
            sb2.from('avatares').update({ estado_animacion: estadoAnim }).eq('agente_nombre', agente),
          ]);
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

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  console.log('[pm-global] POST received', new Date().toISOString());
  if (!process.env.ANTHROPIC_API_KEY && !process.env.GOOGLE_GEMINI_API_KEY) {
    return new Response(
      JSON.stringify({ type: 'error', message: 'No hay proveedor de IA configurado. Agrega ANTHROPIC_API_KEY o GOOGLE_GEMINI_API_KEY en .env.local' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ type: 'error', message: 'SUPABASE_SERVICE_ROLE_KEY no está configurada en .env.local' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Auth con timeout de 8 s — si Supabase no responde, el cliente recibe 504 en vez de colgar
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let supabase: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let user: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let perfil: any = null;
  try {
    await Promise.race([
      (async () => {
        supabase = await createServerClient();
        const { data: { user: u } } = await supabase.auth.getUser();
        if (u) {
          user = { id: u.id };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data } = await (supabase as any)
            .from('perfiles').select('rol,nombre').eq('id', u.id).single();
          perfil = data as typeof perfil;
        }
      })(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Auth timeout: Supabase no respondió en 8 s')), 8_000)
      ),
    ]);
  } catch (e) {
    console.error('[pm-global] auth error:', e);
    return new Response(
      JSON.stringify({ type: 'error', message: e instanceof Error ? e.message : String(e) }),
      { status: 504, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (!user) return new Response('Unauthorized', { status: 401 });
  console.log('[pm-global] auth ok, user.id=', user.id, 'rol=', perfil?.rol);
  if (!perfil || !['superadmin', 'plataforma_admin'].includes(perfil.rol)) {
    console.error('[pm-global] FORBIDDEN: rol=', perfil?.rol, 'no está en [superadmin, plataforma_admin]');
    return new Response('Forbidden', { status: 403 });
  }

  let body: {
    mensaje?: string;
    conversacion_id?: string;
    audio_base64?: string;
    audio_mime?: string;
    empresa_id?: string;
    proyecto_id?: string;
    adjuntos?: Array<{ tipo: string; nombre: string; mimeType: string; base64: string }>;
  };
  try { body = await req.json(); } catch { return new Response('Bad Request', { status: 400 }); }

  const tieneAudio = !!(body.audio_base64 && body.audio_mime);
  const tieneAdjuntos = Array.isArray(body.adjuntos) && body.adjuntos.length > 0;
  if (!tieneAudio && !body.mensaje?.trim() && !tieneAdjuntos) {
    return new Response('Se requiere mensaje o audio', { status: 400 });
  }

  let db: ReturnType<typeof serviceClient>;
  try { db = serviceClient(); } catch (e) {
    return new Response(JSON.stringify({ type: 'error', message: `Error DB: ${String(e)}` }), { status: 500 });
  }

  // Transcribir audio si aplica
  let mensajeTexto = body.mensaje?.trim() ?? '';
  if (tieneAudio) {
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ type: 'error', message: 'GOOGLE_GEMINI_API_KEY no está configurada (necesaria para transcribir audio)' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    try {
      mensajeTexto = await transcribirConGemini(body.audio_base64!, body.audio_mime!);
    } catch (e) {
      return new Response(
        JSON.stringify({ type: 'error', message: `Error transcribiendo audio: ${e instanceof Error ? e.message : String(e)}` }),
        { status: 500 }
      );
    }
    if (!mensajeTexto) return new Response(JSON.stringify({ type: 'error', message: 'No se pudo transcribir el audio' }), { status: 400 });
  }

  // Datos de adjuntos — definir aquí para usarlos tanto en el guardado como en el stream
  const adjuntosData = body.adjuntos ?? [];

  // Crear o retomar conversación
  const tituloMensaje = mensajeTexto || (tieneAdjuntos ? '[Archivo adjunto]' : '');
  let convId = body.conversacion_id ?? null;
  console.log('[pm-global] step: crear/retomar conversación, convId=', convId ?? 'nueva');
  if (!convId) {
    try {
      const { data, error: errConv } = await db.from('conversaciones_pm').insert({
        usuario_id: user.id,
        titulo: tituloMensaje.slice(0, 80),
        empresa_id: body.empresa_id ?? null,
        proyecto_id: body.proyecto_id ?? null,
      }).select('id').single();
      if (errConv) console.error('[pm-global] crear conversación error:', errConv);
      convId = data?.id ?? null;
    } catch (e) {
      console.error('[pm-global] THROW crear conversación:', e);
      return new Response(JSON.stringify({ type: 'error', message: `Error creando conversación: ${String(e)}` }), { status: 500 });
    }
  }
  if (!convId) return new Response(JSON.stringify({ type: 'error', message: 'Error creando conversación en DB' }), { status: 500 });
  const conversacionId = convId;
  console.log('[pm-global] step: conversación ok, id=', conversacionId);

  // Auto-animar PM Global al recibir la solicitud (no depende de que el AI lo recuerde)
  try {
    await db.from('avatares').update({ estado_animacion: 'trabajando' }).eq('agente_nombre', 'pm-global');
  } catch (e) {
    console.warn('[pm-global] avatares update warn (non-fatal):', e);
  }

  // Guardar mensaje con referencia a adjuntos cuando no hay texto
  const contenidoGuardado = mensajeTexto
    || (adjuntosData.length > 0
      ? adjuntosData.map((a: { nombre: string }) => `[${a.nombre}]`).join(' ')
      : '');

  console.log('[pm-global] step: guardando mensaje usuario...');
  try {
    const { error: errMsg } = await db.from('mensajes_pm').insert({
      conversacion_id: conversacionId,
      rol: 'usuario',
      contenido: contenidoGuardado,
      metadata: {
        usuario_nombre: perfil.nombre,
        ...(tieneAudio ? { origen: 'audio', audio_mime: body.audio_mime } : {}),
        ...(adjuntosData.length > 0 ? { adjuntos: adjuntosData.map((a: { nombre: string; mimeType: string }) => ({ nombre: a.nombre, mimeType: a.mimeType })) } : {}),
      },
    });
    if (errMsg) console.error('[pm-global] guardar mensaje error:', errMsg);
  } catch (e) {
    console.error('[pm-global] THROW guardar mensaje:', e);
  }

  console.log('[pm-global] step: cargando historial...');
  const { data: historial, error: errHistorial } = await db.from('mensajes_pm')
    .select('rol,contenido')
    .eq('conversacion_id', conversacionId)
    .order('created_at', { ascending: true })
    .limit(20);
  if (errHistorial) console.error('[pm-global] historial error:', errHistorial);

  // Historial en formato Anthropic — filtrar contenidos vacíos para evitar errores de API
  const historialAnthropic: Anthropic.MessageParam[] = (historial ?? [])
    .filter(m => (m.rol === 'usuario' || m.rol === 'agente') && m.contenido?.trim())
    .slice(0, -1)
    .map(m => ({
      role: m.rol === 'usuario' ? 'user' as const : 'assistant' as const,
      content: m.contenido,
    }));

  // Resolver nombres de empresa y proyecto para el system prompt
  let empresaNombre: string | undefined;
  let proyectoNombre: string | undefined;
  if (body.empresa_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: emp } = await (db as any).from('empresas').select('nombre').eq('id', body.empresa_id).single();
    empresaNombre = emp?.nombre;
  }
  if (body.proyecto_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: proy } = await (db as any).from('proyectos').select('nombre').eq('id', body.proyecto_id).single();
    proyectoNombre = proy?.nombre;
  }

  const encoder = new TextEncoder();
  console.log('[pm-global] step: buildSystemPrompt...');
  const systemPrompt = buildSystemPrompt(perfil.nombre ?? 'Usuario', perfil.rol, {
    empresaNombre,
    empresaId: body.empresa_id,
    proyectoNombre,
    proyectoId: body.proyecto_id,
  });
  const MAX = 15;
  console.log('[pm-global] step: creando ReadableStream...');

  const stream = new ReadableStream({
    async start(controller) {
      console.log('[pm-global] stream start', new Date().toISOString());
      function send(obj: object) {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      }

      req.signal.addEventListener('abort', () => controller.close());

      let modeloUsado = process.env.ANTHROPIC_API_KEY ? 'claude-sonnet-4-6' : 'gemini-2.5-flash';
      let textoFinal = '';
      const toolsEjecutados: Array<{ tool: string; input: unknown; result: string }> = [];

      try {
        send({ type: 'init', conversacion_id: conversacionId, modelo: modeloUsado });
        if (tieneAudio) send({ type: 'transcript', texto: mensajeTexto });

        // Construir contenido multimodal (texto + adjuntos)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let claudeUserContent: any = mensajeTexto;
        if (adjuntosData.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const parts: any[] = [];
          if (mensajeTexto) parts.push({ type: 'text', text: mensajeTexto });
          for (const adj of adjuntosData) {
            if (adj.mimeType.startsWith('image/')) {
              const mediaType = (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(adj.mimeType)
                ? adj.mimeType : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
              parts.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: adj.base64 } });
            } else {
              parts.push({ type: 'text', text: `[Archivo adjunto: ${adj.nombre} (${adj.mimeType})]` });
            }
          }
          // Claude requiere al menos un text block cuando hay imágenes sin texto
          if (parts.length > 0 && !parts.some((p: any) => p.type === 'text')) {
            parts.unshift({ type: 'text', text: 'Analiza esta imagen en el contexto de mi solicitud.' });
          }
          if (parts.length > 0) claudeUserContent = parts;
        }

        let usoClaude = false;

        // ── Intento primario: Claude Sonnet ──────────────────────────────────
        if (process.env.ANTHROPIC_API_KEY) {
          const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
          const messages: Anthropic.MessageParam[] = [
            ...historialAnthropic,
            { role: 'user', content: claudeUserContent },
          ];
          let textoEnviadoPorClaude = false;

          try {
            let agotoIteraciones = false;
            for (let i = 0; i < MAX; i++) {
              const claudeStream = anthropic.messages.stream({
                model: 'claude-sonnet-4-6',
                max_tokens: 8096,
                system: systemPrompt,
                messages,
                tools: CLAUDE_TOOLS,
              });

              for await (const event of claudeStream) {
                if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
                  send({ type: 'tool_start', tool: event.content_block.name });
                }
                if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                  textoFinal += event.delta.text;
                  textoEnviadoPorClaude = true;
                  send({ type: 'text', delta: event.delta.text });
                }
              }

              const finalMsg = await claudeStream.finalMessage();
              const toolUses = finalMsg.content.filter(
                (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
              );

              if (toolUses.length === 0) break;

              messages.push({ role: 'assistant', content: finalMsg.content });
              const toolResults: Anthropic.ToolResultBlockParam[] = [];
              for (const tu of toolUses) {
                const result = await ejecutarTool(tu.name, tu.input as Record<string, unknown>, db);
                toolsEjecutados.push({ tool: tu.name, input: tu.input, result });
                send({ type: 'tool_end', tool: tu.name, result: JSON.parse(result) });
                toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: result });
              }
              messages.push({ role: 'user', content: toolResults });
              if (i === MAX - 1) agotoIteraciones = true;
            }

            // Si llegamos al límite sin emitir texto final, forzar un cierre con resumen.
            // Reintentamos UNA vez sin tools para que Claude obligatoriamente emita texto.
            if (agotoIteraciones && !textoEnviadoPorClaude) {
              console.warn('[pm-global] agotó iteraciones sin emitir texto — forzando cierre');
              messages.push({
                role: 'user',
                content: 'Has alcanzado el límite de iteraciones de tools. NO uses más tools. Resume al usuario en español qué tareas creaste, qué consultaste y qué decisiones tomaste hasta ahora. Si quedó algo pendiente, dilo claramente. Responde SOLO con texto.',
              });
              const cierre = await anthropic.messages.create({
                model: 'claude-sonnet-4-6',
                max_tokens: 2048,
                system: systemPrompt,
                messages,
                // Sin tools: forzamos texto
              });
              for (const block of cierre.content) {
                if (block.type === 'text') {
                  textoFinal += block.text;
                  send({ type: 'text', delta: block.text });
                  textoEnviadoPorClaude = true;
                }
              }
            }
            usoClaude = true;
          } catch (claudeErr) {
            // Fallback a Gemini solo si no se envió texto (sin mezclar respuestas parciales)
            if (!textoEnviadoPorClaude && process.env.GOOGLE_GEMINI_API_KEY) {
              console.warn('[pm-global] Claude falló, activando fallback Gemini:', claudeErr);
              modeloUsado = 'gemini-2.5-flash';
              textoFinal = '';
              toolsEjecutados.length = 0;
              send({ type: 'model_switch', modelo: modeloUsado });
            } else {
              throw claudeErr;
            }
          }
        }

        // ── Fallback / primario si no hay Anthropic key: Gemini Flash ────────
        if (!usoClaude && process.env.GOOGLE_GEMINI_API_KEY) {
          const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
          const geminiModel = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            tools: GEMINI_TOOLS,
            systemInstruction: systemPrompt,
          });

          const historialGemini = historialAnthropic.map(m => ({
            role: m.role === 'user' ? 'user' as const : 'model' as const,
            parts: [{ text: m.content as string }],
          }));

          const chat = geminiModel.startChat({ history: historialGemini });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let currentMessage: any = mensajeTexto;
          if (adjuntosData.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const geminiParts: any[] = [];
            if (mensajeTexto) geminiParts.push({ text: mensajeTexto });
            for (const adj of adjuntosData) {
              if (adj.mimeType.startsWith('image/') || adj.mimeType === 'application/pdf') {
                geminiParts.push({ inlineData: { data: adj.base64, mimeType: adj.mimeType } });
              }
            }
            // Gemini requiere al menos un text part
            if (geminiParts.length > 0 && !geminiParts.some((p: any) => p.text)) {
              geminiParts.unshift({ text: 'Analiza esta imagen en el contexto de mi solicitud.' });
            }
            if (geminiParts.length > 0) currentMessage = geminiParts;
          }

          for (let i = 0; i < MAX; i++) {
            const result = await chat.sendMessageStream(currentMessage);

            for await (const chunk of result.stream) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const parts: any[] = chunk.candidates?.[0]?.content?.parts ?? [];
              for (const part of parts) {
                if (typeof part.text === 'string' && part.text) {
                  textoFinal += part.text;
                  send({ type: 'text', delta: part.text });
                }
              }
            }

            const finalResponse = await result.response;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const functionCalls: any[] = (finalResponse as any).functionCalls?.() ?? [];
            if (functionCalls.length === 0) break;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const functionResponses: any[] = [];
            for (const fc of functionCalls) {
              send({ type: 'tool_start', tool: fc.name });
              const toolResult = await ejecutarTool(fc.name, fc.args ?? {}, db);
              toolsEjecutados.push({ tool: fc.name, input: fc.args, result: toolResult });
              send({ type: 'tool_end', tool: fc.name, result: JSON.parse(toolResult) });
              functionResponses.push({ functionResponse: { name: fc.name, response: JSON.parse(toolResult) } });
            }
            currentMessage = functionResponses;
          }
        }

        const { data: msg } = await db.from('mensajes_pm').insert({
          conversacion_id: conversacionId,
          rol: 'agente',
          contenido: textoFinal,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          metadata: { tool_calls: toolsEjecutados, modelo: modeloUsado } as any,
        }).select('id').single();

        await db.from('conversaciones_pm').update({ updated_at: new Date().toISOString() }).eq('id', conversacionId);

        send({ type: 'done', conversacion_id: conversacionId, mensaje_id: msg?.id, modelo: modeloUsado });
        // PM Global regresa al lounge al terminar
        setTimeout(async () => {
          try { await db.from('avatares').update({ estado_animacion: 'idle' }).eq('agente_nombre', 'pm-global'); } catch {}
        }, 2500);
      } catch (e) {
        console.error('[pm-global] stream error:', e);
        send({ type: 'error', message: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
