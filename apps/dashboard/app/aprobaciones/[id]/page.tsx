import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import DetalleSolicitud from '@/components/aprobaciones/DetalleSolicitud';
import FormDecision from '@/components/aprobaciones/FormDecision';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DetallePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: solicitud } = await supabase
    .from('solicitudes_aprobacion')
    .select('*, aprobaciones(*)')
    .eq('id', id)
    .single();

  if (!solicitud) notFound();

  const yaDecidio = solicitud.aprobaciones?.some(
    (a: { stakeholder_id: string }) => a.stakeholder_id === user.id
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <a href="/aprobaciones" className="text-sm text-blue-600 hover:underline">
          ← Volver a mis solicitudes
        </a>

        <DetalleSolicitud solicitud={solicitud} />

        {solicitud.estado === 'pendiente' && !yaDecidio && (
          <FormDecision solicitudId={id} />
        )}

        {yaDecidio && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
            Ya enviaste tu decisión para esta solicitud.
          </div>
        )}
      </main>
    </div>
  );
}
