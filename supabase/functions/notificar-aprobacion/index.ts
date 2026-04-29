import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const POSTMARK_TOKEN = Deno.env.get('POSTMARK_SERVER_TOKEN')!;
const APP_URL = Deno.env.get('DASHBOARD_URL')!;

// Invocada como Database Webhook cuando se inserta en solicitudes_aprobacion
Deno.serve(async (req: Request) => {
  try {
    const payload = await req.json();
    const solicitud = payload.record as {
      id: string;
      titulo: string;
      descripcion: string;
      area: string;
      stakeholder_id: string;
    };

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, email')
      .eq('id', solicitud.stakeholder_id)
      .single();

    if (!perfil?.email) {
      console.error('[notificar-aprobacion] No se encontró el perfil del stakeholder');
      return new Response('ok', { status: 200 });
    }

    const enlace = `${APP_URL}/aprobaciones/${solicitud.id}`;

    await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': POSTMARK_TOKEN,
      },
      body: JSON.stringify({
        From: 'sistemas@empresa.com',
        To: perfil.email,
        Subject: `Nueva solicitud pendiente: ${solicitud.titulo}`,
        HtmlBody: `
          <h2>Hola ${perfil.nombre},</h2>
          <p>Tienes una nueva solicitud de aprobación pendiente:</p>
          <h3>${solicitud.titulo}</h3>
          <p><strong>Área:</strong> ${solicitud.area}</p>
          <p>${solicitud.descripcion}</p>
          <p><a href="${enlace}" style="background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">
            Ver y decidir →
          </a></p>
        `,
        TextBody: `Nueva solicitud: ${solicitud.titulo}. Accede en: ${enlace}`,
      }),
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[notificar-aprobacion]', err);
    return new Response(JSON.stringify({ error: 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
