import LogoutButton from './LogoutButton';

interface Props {
  nombre: string;
}

export default function NavStakeholder({ nombre }: Props) {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Área de Sistemas</p>
          <p className="text-xs text-gray-500">Portal de aprobaciones</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">{nombre}</span>
          <LogoutButton className="text-xs text-gray-400 hover:text-gray-700 transition-colors" />
        </div>
      </div>
    </header>
  );
}
