import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { buildSystemPrompt } from '@/lib/pm/system-prompt';
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

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'log_bitacora',
    description: 'Registra una acción en la bitácora de actividad. Úsalo para cada decisión o acción importante.',
    input_schema: {
      type: 'object' as const,
      properties: {
        agente:      { type: 'string', description: 'Nombre del agente, ej: pm-global' },
        accion:      { type: 'string', description: 'Descripción de la acción realizada' },
        proyecto_id: { type: 'string', description: 'UUID del proyecto relacionado (opcional)' },
      },
      required: ['agente', 'accion'],
    },
  },
  {
    name: 'crear_tarea',
    description: 'Crea una tarea asignada a un agente especialista del equipo de desarrollo.',
    input_schema: {
      type: 'object' as const,
      properties: {
        requerimiento_id: { type: 'string', description: 'UUID del requerimiento al que pertenece' },
        agente_asignado: {
          type: 'string',
          enum: [
            'dev-pm','dev-analista','dev-backend','dev-bd','dev-frontend','dev-devops',
            'dev-testing','dev-diseno','dev-documentador','dev-seguridad','dev-ciberseguridad',
            'dev-redes','dev-soporte','dev-imagenes','dev-presentaciones','dev-videojuegos',
          ],
          description: 'Agente que ejecutará la tarea',
        },
        descripcion: { type: 'string', description: 'Qué debe hacer exactamente el agente' },
        rama:        { type: 'string', description: 'Rama de Git sugerida (opcional)' },
      },
      required: ['requerimiento_id', 'agente_asignado', 'descripcion'],
    },
  },
  {
    name: 'actualizar_avatar_estado',
    description: 'Actualiza la animación del avatar de un agente en el canvas Sims.',
    input_schema: {
      type: 'object' as const,
      properties: {
        agente_nombre:     { type: 'string', description: 'Ej: pm-global, dev-backend' },
        estado_animacion:  { type: 'string', enum: ['idle','caminando','trabajando','hablando','celebrando'] },
      },
      required: ['agente_nombre', 'estado_animacion'],
    },
  },
  {
    name: 'consultar_proyectos',
    description: 'Obtiene los proyectos activos del sistema para contextualizar la respuesta.',
    input_schema: {
      type: 'object' as const,
      properties: {
        estado: { type: 'string', enum: ['activo','pausado','cerrado'], description: 'Filtrar por estado (opcional)' },
      },
      required: [],
    },
  },
];

async function ejecutarTool(
  nombre: string,
  input: Record<string, unknown>,
  db: ReturnType<typeof serviceClient>
): Promise<string> {
  try {
    switch (nombre) {
      case 'log_bitacora': {
        const { agente, accion, proyecto_id } = input as { agente: string; accion: string; proyecto_id?: string };
        const { error } = await db.from('bitacora_actividad').insert({
          agente, accion, proyecto_id: proyecto_id ?? null,
        });
        return error ? JSON.stringify({ error: error.message }) : JSON.stringify({ ok: true });
      }
      case 'crear_tarea': {
        const { requerimiento_id, agente_asignado, descripcion, rama } = input as {
          requerimiento_id: string; agente_asignado: string; descripcion: string; rama?: string;
        };
        const { data, error } = await db.from('tareas').insert({
          requerimiento_id, agente_asignado, descripcion,
          rama: rama ?? null, estado: 'pendiente',
        }).select('id').single();
        return error ? JSON.stringify({ error: error.message }) : JSON.stringify({ ok: true, id: data?.id });
      }
      case 'actualizar_avatar_estado': {
        const { agente_nombre, estado_animacion } = input as { agente_nombre: string; estado_animacion: string };
        const { error } = await db.from('avatares')
          .update({ estado_animacion })
          .eq('agente_nombre', agente_nombre);
        return error ? JSON.stringify({ error: error.message }) : JSON.stringify({ ok: true });
      }
      case 'consultar_proyectos': {
        const { estado } = input as { estado?: string };
        let q = db.from('proyectos').select('id,nombre,descripcion,estado,creado_en').order('creado_en', { ascending: false }).limit(10);
        if (estado) q = q.eq('estado', estado);
        const { data, error } = await q;
        return error ? JSON.stringify({ error: error.message }) : JSON.stringify({ proyectos: data });
      }
      default:
        return JSON.stringify({ error: `Tool desconocida: ${nombre}` });
    }
  } catch (e) {
    return JSON.stringify({ error: String(e) });
  }
}

export async function POST(req: NextRequest) {
  // Auth
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data: perfil } = await supabase.from('perfiles').select('rol,nombre').eq('id', user.id).single();
  if (!perfil || !['superadmin', 'plataforma_admin'].includes(perfil.rol)) {
    return new Response('Forbidden', { status: 403 });
  }

  let body: { mensaje: string; conversacion_id?: string };
  try { body = await req.json(); } catch { return new Response('Bad Request', { status: 400 }); }
  if (!body.mensaje?.trim()) return new Response('Mensaje requerido', { status: 400 });

  const db = serviceClient();

  // Crear o retomar conversación
  let convId = body.conversacion_id ?? null;
  if (!convId) {
    const { data } = await db.from('conversaciones_pm').insert({
      usuario_id: user.id,
      titulo: body.mensaje.slice(0, 80),
    }).select('id').single();
    convId = data?.id ?? null;
  }
  if (!convId) return new Response('Error creando conversación', { status: 500 });
  const conversacionId = convId;

  // Guardar mensaje del usuario
  await db.from('mensajes_pm').insert({
    conversacion_id: conversacionId,
    rol: 'usuario',
    contenido: body.mensaje,
    metadata: { usuario_nombre: perfil.nombre },
  });

  // Cargar historial
  const { data: historial } = await db.from('mensajes_pm')
    .select('rol,contenido')
    .eq('conversacion_id', conversacionId)
    .order('created_at', { ascending: true })
    .limit(20);

  const mensajes: Anthropic.MessageParam[] = (historial ?? [])
    .filter(m => m.rol === 'usuario' || m.rol === 'agente')
    .map(m => ({ role: m.rol === 'usuario' ? 'user' : 'assistant', content: m.contenido }));

  const encoder = new TextEncoder();
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: object) {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      }

      req.signal.addEventListener('abort', () => controller.close());

      try {
        send({ type: 'init', conversacion_id: conversacionId });

        let textoFinal = '';
        const toolsEjecutados: Array<{ tool: string; input: unknown; result: string }> = [];
        let loop = [...mensajes];
        const MAX = 5;

        for (let i = 0; i < MAX; i++) {
          const s = anthropic.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            system: buildSystemPrompt(perfil.nombre ?? 'Usuario', perfil.rol),
            tools: TOOLS,
            messages: loop,
          });

          let toolActual: { id: string; name: string; inputStr: string } | null = null;
          let stopReason: string | null = null;

          for await (const ev of s) {
            if (ev.type === 'content_block_start' && ev.content_block.type === 'tool_use') {
              toolActual = { id: ev.content_block.id, name: ev.content_block.name, inputStr: '' };
              send({ type: 'tool_start', tool: toolActual.name });
            }
            if (ev.type === 'content_block_delta') {
              if (ev.delta.type === 'text_delta') {
                textoFinal += ev.delta.text;
                send({ type: 'text', delta: ev.delta.text });
              }
              if (ev.delta.type === 'input_json_delta' && toolActual) {
                toolActual.inputStr += ev.delta.partial_json;
              }
            }
            if (ev.type === 'content_block_stop' && toolActual) {
              let toolInput: Record<string, unknown> = {};
              try { toolInput = JSON.parse(toolActual.inputStr); } catch { /* malformado */ }
              const result = await ejecutarTool(toolActual.name, toolInput, db);
              toolsEjecutados.push({ tool: toolActual.name, input: toolInput, result });
              send({ type: 'tool_end', tool: toolActual.name, result: JSON.parse(result) });
              toolActual = null;
            }
            if (ev.type === 'message_delta') stopReason = ev.delta.stop_reason ?? null;
          }

          const final = await s.finalMessage();
          loop = [...loop, { role: 'assistant', content: final.content }];

          const toolBlocks = final.content.filter(b => b.type === 'tool_use');
          if (toolBlocks.length > 0 && stopReason === 'tool_use') {
            const results: Anthropic.ToolResultBlockParam[] = toolBlocks.map(b => {
              if (b.type !== 'tool_use') return null!;
              const exec = toolsEjecutados.findLast(t => t.tool === b.name);
              return { type: 'tool_result', tool_use_id: b.id, content: exec?.result ?? '{"error":"no ejecutado"}' };
            });
            loop = [...loop, { role: 'user', content: results }];
          } else {
            break;
          }
        }

        // Guardar respuesta del agente
        const { data: msg } = await db.from('mensajes_pm').insert({
          conversacion_id: conversacionId,
          rol: 'agente',
          contenido: textoFinal,
          metadata: { tool_calls: toolsEjecutados, modelo: 'claude-sonnet-4-6' },
        }).select('id').single();

        // Actualizar updated_at de la conversación
        await db.from('conversaciones_pm').update({ updated_at: new Date().toISOString() }).eq('id', conversacionId);

        send({ type: 'done', conversacion_id: conversacionId, mensaje_id: msg?.id });
      } catch (e) {
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
