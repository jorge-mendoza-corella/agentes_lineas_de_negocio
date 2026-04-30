import { NextRequest } from 'next/server';
import { ejecutarEspecialista, makeDb } from '@/lib/agent/especialista';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const key = req.headers.get('x-internal-key');
  if (!process.env.INTERNAL_API_KEY || key !== process.env.INTERNAL_API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: { tarea_id?: string };
  try { body = await req.json(); } catch { return new Response('Bad Request', { status: 400 }); }
  if (!body.tarea_id) return new Response('Se requiere tarea_id', { status: 400 });

  const db = makeDb();
  await ejecutarEspecialista(body.tarea_id, db);
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
