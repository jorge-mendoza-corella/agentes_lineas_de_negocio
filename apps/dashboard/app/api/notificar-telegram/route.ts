import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId   = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no configurados' }, { status: 503 });
  }

  let mensaje: string;
  try {
    const body = await req.json();
    mensaje = typeof body.mensaje === 'string' ? body.mensaje : JSON.stringify(body);
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: mensaje,
      parse_mode: 'HTML',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  return NextResponse.json({ ok: true });
}
