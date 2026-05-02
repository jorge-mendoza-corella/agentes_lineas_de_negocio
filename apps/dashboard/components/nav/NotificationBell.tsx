'use client';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface ConvNoLeida {
  id: string;
  titulo: string | null;
  updated_at: string;
}

export default function NotificationBell({ userId }: { userId: string }) {
  const [noLeidas, setNoLeidas] = useState<ConvNoLeida[]>([]);
  const [abierto, setAbierto] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  async function cargarNoLeidas() {
    const supabase = createClient();
    const { data } = await (supabase as any)
      .from('conversaciones_pm')
      .select('id, titulo, updated_at, leido_en, created_at')
      .eq('usuario_id', userId)
      .order('updated_at', { ascending: false });

    const noL = (data ?? []).filter((c: any) => {
      if (!c.leido_en) return c.updated_at !== c.created_at;
      return new Date(c.updated_at) > new Date(c.leido_en);
    });
    setNoLeidas(noL.map((c: any) => ({ id: c.id, titulo: c.titulo, updated_at: c.updated_at })));
  }

  useEffect(() => {
    cargarNoLeidas();
    const supabase = createClient();
    const channel = supabase
      .channel(`bell-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes_pm' }, () => cargarNoLeidas())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversaciones_pm' }, () => cargarNoLeidas())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, []);

  async function irAConversacion(convId: string) {
    const supabase = createClient();
    await (supabase as any)
      .from('conversaciones_pm')
      .update({ leido_en: new Date().toISOString() })
      .eq('id', convId)
      .eq('usuario_id', userId);
    setAbierto(false);
    setNoLeidas(prev => prev.filter(c => c.id !== convId));
    router.push(`/superadmin/solicitar?conversacion=${convId}`);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setAbierto(v => !v)}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        title="Notificaciones del PM"
      >
        <span className="text-base leading-none">🔔</span>
        {noLeidas.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {noLeidas.length > 9 ? '9+' : noLeidas.length}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute left-0 top-full mt-2 w-72 bg-gray-800 rounded-xl border border-gray-700 shadow-2xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-300">Mensajes del PM</p>
            {noLeidas.length > 0 && (
              <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-medium">
                {noLeidas.length} sin leer
              </span>
            )}
          </div>

          {noLeidas.length === 0 ? (
            <p className="px-4 py-5 text-xs text-gray-500 text-center">Sin mensajes nuevos</p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {noLeidas.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => irAConversacion(conv.id)}
                  className="w-full text-left px-3 py-2.5 hover:bg-gray-700 transition-colors border-b border-gray-700/50 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm flex-shrink-0">💬</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate font-medium">
                        {conv.titulo ?? 'Sin título'}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {new Date(conv.updated_at).toLocaleString('es-MX', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <span className="w-2 h-2 bg-blue-400 rounded-full flex-shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-gray-700">
            <button
              onClick={() => { setAbierto(false); router.push('/superadmin/solicitar'); }}
              className="w-full text-center text-xs text-blue-400 hover:text-blue-300 py-2 transition-colors"
            >
              Ver todas las conversaciones →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
