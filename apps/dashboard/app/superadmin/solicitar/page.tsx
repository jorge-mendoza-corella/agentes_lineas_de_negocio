import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ChatPM from '@/components/pm/ChatPM';

interface Props {
  searchParams: Promise<{ conversacion?: string }>;
}

type ConvRow = { id: string; titulo: string | null; updated_at: string; empresa_id: string | null };
type EmpresaRow = { id: string; nombre: string };
type ProyectoRow = { id: string; nombre: string; empresa_id: string | null };
type MensajeRow = { id: string; rol: string; contenido: string; created_at: string };
type ConvDetalle = { empresa_id: string | null; proyecto_id: string | null };

export default async function SolicitarPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const params = await searchParams;
  const convActiva = params.conversacion ?? null;

  const [convRes, empRes, projRes] = await Promise.all([
    supabase
      .from('conversaciones_pm')
      .select('id, titulo, updated_at, empresa_id')
      .eq('usuario_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(30),
    supabase
      .from('empresas')
      .select('id, nombre')
      .eq('activa', true)
      .order('nombre'),
    supabase
      .from('proyectos')
      .select('id, nombre, empresa_id')
      .order('nombre'),
  ]);

  const conversaciones = (convRes.data ?? []) as ConvRow[];
  const empresas = (empRes.data ?? []) as EmpresaRow[];
  const proyectos = (projRes.data ?? []) as ProyectoRow[];

  let mensajesIniciales: MensajeRow[] = [];
  let convActivaData: ConvDetalle = { empresa_id: null, proyecto_id: null };

  if (convActiva) {
    const [msgsRes, convDetRes] = await Promise.all([
      supabase
        .from('mensajes_pm')
        .select('id, rol, contenido, created_at')
        .eq('conversacion_id', convActiva)
        .order('created_at', { ascending: true })
        .limit(50),
      supabase
        .from('conversaciones_pm')
        .select('empresa_id, proyecto_id')
        .eq('id', convActiva)
        .single(),
    ]);
    mensajesIniciales = (msgsRes.data ?? []) as MensajeRow[];
    convActivaData = (convDetRes.data ?? { empresa_id: null, proyecto_id: null }) as ConvDetalle;
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
          {conversaciones.map(conv => {
            const empresaNombre = empresas.find(e => e.id === conv.empresa_id)?.nombre;
            return (
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
                {empresaNombre && (
                  <p className="text-[10px] text-blue-500 mt-0.5 truncate">🏢 {empresaNombre}</p>
                )}
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {new Date(conv.updated_at).toLocaleDateString('es-MX', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </a>
            );
          })}
          {conversaciones.length === 0 && (
            <p className="px-4 py-6 text-xs text-gray-400 text-center">Sin conversaciones aún</p>
          )}
        </div>
      </aside>

      {/* Chat principal */}
      <div className="flex-1 min-w-0">
        <ChatPM
          conversacionIdInicial={convActiva}
          mensajesIniciales={mensajesIniciales}
          empresas={empresas}
          proyectos={proyectos}
          empresaIdInicial={convActivaData.empresa_id}
          proyectoIdInicial={convActivaData.proyecto_id}
        />
      </div>
    </div>
  );
}
