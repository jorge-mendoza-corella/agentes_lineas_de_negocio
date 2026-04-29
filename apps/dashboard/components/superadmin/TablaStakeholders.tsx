interface Stakeholder {
  id: string;
  nombre: string;
  email: string;
  created_at: string;
  stakeholder_areas: { area: string }[];
}

interface Props {
  stakeholders: Stakeholder[];
}

export default function TablaStakeholders({ stakeholders }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">
          Stakeholders activos ({stakeholders.length})
        </h2>
      </div>
      <div className="divide-y divide-gray-100">
        {stakeholders.map((s) => (
          <div key={s.id} className="px-6 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">{s.nombre}</p>
              <p className="text-xs text-gray-400">{s.email}</p>
            </div>
            <div className="flex flex-wrap gap-1 justify-end">
              {s.stakeholder_areas.map(({ area }) => (
                <span key={area} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                  {area}
                </span>
              ))}
            </div>
          </div>
        ))}
        {stakeholders.length === 0 && (
          <div className="text-center py-10 text-sm text-gray-400">
            No hay stakeholders todavía. Invita uno arriba.
          </div>
        )}
      </div>
    </div>
  );
}
