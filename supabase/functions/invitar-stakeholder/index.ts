import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const POSTMARK_TOKEN = Deno.env.get('POSTMARK_SERVER_TOKEN')!;
const APP_URL = Deno.env.get('DASHBOARD_URL')!;

Deno.serve(async (req: Request) => {
  try {
    const { nombre, email, areas } = await req.json() as {
      nombre: string;
      email: string;
      areas: string[];
    };

    if (!nombre || !email || !areas?.length) {
      return new Response(JSON.stringify({ error: 'nombre, email y areas son requeridos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Invitar usuario via Supabase Auth Admin
    const { data: invitacion, error: errorInvite } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${APP_URL}/auth/callback`,
      data: { nombre },
    });

    if (errorInvite) throw errorInvite;

    const userId = invitacion.user.id;

    // Crear perfil
    const { error: errorPerfil } = await admin.from('perfiles').upsert({
      id: userId,
      nombre,
      email,
      rol: 'stakeholder',
    });

    if (errorPerfil) throw errorPerfil;

    // Asignar áreas
    const areasRows = areas.map((area: string) => ({ stakeholder_id: userId, area }));
    const { error: errorAreas } = await admin.from('stakeholder_areas').insert(areasRows);
    if (errorAreas) throw errorAreas;

    // Enviar email de bienvenida con Postmark
    await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': POSTMARK_TOKEN,
      },
      body: JSON.stringify({
        From: 'sistemas@empresa.com',
        To: email,
        Subject: 'Acceso al portal de aprobaciones — Área de Sistemas',
        HtmlBody: `
          <h2>Hola ${nombre},</h2>
          <p>Se te ha dado acceso al portal de aprobaciones del Área de Sistemas.</p>
          <p>Podrás revisar y aprobar solicitudes de las áreas: <strong>${areas.join(', ')}</strong>.</p>
          <p>Revisa tu email para encontrar el enlace de acceso enviado por Supabase.</p>
        `,
        TextBody: `Hola ${nombre}, tienes acceso al portal de aprobaciones. Áreas: ${areas.join(', ')}.`,
      }),
    });

    return new Response(JSON.stringify({ ok: true, userId }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[invitar-stakeholder]', err);
    return new Response(JSON.stringify({ error: 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
