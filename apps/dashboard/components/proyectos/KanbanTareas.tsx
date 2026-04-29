'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

type Estado = 'pendiente'|'en_progreso'|'en_revision'|'bloqueada'|'completada'|'cancelada';

interface Tarea {
  id: string; descripcion: string; estado: Estado;
  agente_asignado: string; rama: string | null;
  iniciado_en: string | null; completado_en: string | null;
}
interface Requerimiento {
  id: string; titulo: string; prioridad: string; estado: string;
  tareas: Tarea[];
}

interface Props { requerimientos: Requerimiento[]; proyectoId: string }

const COLUMNAS: { key: Estado; label: string; color: string }[] = [
  { key: 'pendiente',   label: 'Pendiente',   color: 'bg-gray-50 border-gray-200' },
  { key: 'en_progreso', label: 'En progreso', color: 'bg-blue-50 border-blue-200' },
  { key: 'en_revision', label: 'En revisión', color: 'bg-yellow-50 border-yellow-200' },
  { key: 'bloqueada',   label: 'Bloqueada',   color: 'bg-red-50 border-red-200' },
  { key: 'completada',  label: 'Completada',  color: 'bg-green-50 border-green-200' },
];

const PRIORIDAD_COLOR: Record<string, string> = {
  baja: 'bg-gray-100 text-gray-500',
  media: 'bg-blue-100 text-blue-600',
  alta: 'bg-orange-100 text-orange-600',
  critica: 'bg-red-100 text-red-600',
};

const AGENTE_EMOJI: Record<string, string> = {
  'dev-analista':'🔍','dev-backend':'⚙️','dev-bd':'🗄️','dev-ciberseguridad':'🛡️',
  'dev-devops':'🚀','dev-diseno':'🎨','dev-documentador':'📝','dev-frontend':'🖥️',
  'dev-imagenes':'🖼️','dev-pm':'👨‍💼','dev-presentaciones':'📊','dev-redes':'🌐',
  'dev-seguridad':'🔒','dev-soporte':'🛟','dev-testing':'🧪','dev-videojuegos':'🎮',
  'pm-global':'🎯','marketing-pm':'📣','marketing-seo':'🔎',
};

export default function KanbanTareas({ requerimientos, proyectoId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [actualizando, setActualizando] = useState<string | null>(null);

  const todasTareas = requerimientos.flatMap(r =>
    r.tareas.map(t => ({ ...t, requerimiento: r }))
  );

  async function moverTarea(tareaId: string, nuevoEstado: Estado) {
    setActualizando(tareaId);
    const updates: Record<string, unknown> = { estado: nuevoEstado };
    if (nuevoEstado === 'en_progreso') updates.iniciado_en = new Date().toISOString();
    if (nuevoEstado === 'completada') updates.completado_en = new Date().toISOString();
    await supabase.from('tareas').update(updates).eq('id', tareaId);
    setActualizando(null);
    router.refresh();
  }

  if (requerimientos.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-sm text-gray-400">
        No hay requerimientos todavía. Agrega el primero arriba.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {COLUMNAS.map(col => {
          const tareas = todasTareas.filter(t => t.estado === col.key);
          return (
            <div key={col.key} className={`w-64 rounded-2xl border ${col.color} p-3 flex flex-col gap-2`}>
              <div className="flex items-center justify-between mb-1 px-1">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  {col.label}
                </span>
                <span className="text-xs text-gray-400 font-medium">{tareas.length}</span>
              </div>
              {tareas.map(t => (
                <div
                  key={t.id}
                  className={`bg-white rounded-xl border border-gray-200 p-3 shadow-sm space-y-2 ${
                    actualizando === t.id ? 'opacity-50' : ''
                  }`}
                >
                  <p className="text-xs text-gray-400 font-medium truncate">
                    {t.requerimiento.titulo}
                  </p>
                  <p className="text-sm font-medium text-gray-800 leading-snug">{t.descripcion}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm" title={t.agente_asignado}>
                      {AGENTE_EMOJI[t.agente_asignado] ?? '🤖'} <span className="text-xs text-gray-500">{t.agente_asignado}</span>
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${PRIORIDAD_COLOR[t.requerimiento.prioridad]}`}>
                      {t.requerimiento.prioridad}
                    </span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {COLUMNAS.filter(c => c.key !== t.estado).map(c => (
                      <button
                        key={c.key}
                        onClick={() => moverTarea(t.id, c.key)}
                        disabled={actualizando === t.id}
                        className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-40"
                      >
                        → {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
