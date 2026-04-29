import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ChatPM from '@/components/pm/ChatPM';

interface Props {
  searchParams: Promise<{ conversacion?: string }>;
}

export default async function SolicitarPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const params = await searchParams;
  const convActiva = params.conversacion ?? null;

  const { data: conversaciones } = await supabase
    .from('conversaciones_pm')
    .select('id, titulo, created_at, updated_at')
    .eq('usuario_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(30);

  let mensajesIniciales: Array<{ id: string; rol: string; contenido: string; created_at: string }> = [];
  if (convActiva) {
    const { data } = await supabase
      .from('mensajes_pm')
      .select('id, rol, contenido, created_at')
      .eq('conversacion_id', convActiva)
      .order('created_at', { ascending: true })
      .limit(50);
    mensajesIniciales = data ?? [];
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex gap-4">
      {/* Sidebar conversaciones */}
      <aside className="w-60 flex-shrink-0 bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Conversaciones</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          <a
            href="/superadmin/solicitar"
            className="flex items-center gap-2 px-4 py-3 text-sm text-blue-600 hover:bg-blue-50 transition-colors font-medium border-b border-gray-50"
          >
            <span className="text-lg">+</span> Nueva
          </a>
          {(conversaciones ?? []).map(conv => (
            <a
              key={conv.id}
              href={`/superadmin/solicitar?conversacion=${conv.id}`}
              className={`block px-4 py-3 text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 ${
                conv.id === convActiva ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
              }`}
            >
              <p className={`font-medium truncate ${conv.id === convActiva ? 'text-blue-700' : 'text-gray-800'}`}>
                {conv.titulo ?? 'Sin título'}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {new Date(conv.updated_at).toLocaleDateString('es-MX', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </a>
          ))}
          {(conversaciones ?? []).length === 0 && (
            <p className="px-4 py-6 text-xs text-gray-400 text-center">Sin conversaciones aún</p>
          )}
        </div>
      </aside>

      {/* Chat principal */}
      <div className="flex-1 min-w-0">
        <ChatPM
          conversacionIdInicial={convActiva}
          mensajesIniciales={mensajesIniciales}
        />
      </div>
    </div>
  );
}
