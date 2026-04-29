import Link from 'next/link';

interface Props {
  nombre: string;
}

export default function NavSuperadmin({ nombre }: Props) {
  return (
    <aside className="w-56 min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="px-5 py-6 border-b border-gray-700">
        <p className="text-xs text-gray-400 uppercase tracking-wider">Área de Sistemas</p>
        <p className="text-sm font-semibold mt-1 truncate">{nombre}</p>
        <span className="inline-block mt-1 px-2 py-0.5 bg-yellow-500 text-yellow-900 text-xs rounded-full font-bold">
          Superadmin
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        <Link
          href="/superadmin"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <span>🏠</span> Panel general
        </Link>
        <Link
          href="/superadmin/empresas"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <span>🏢</span> Empresas
        </Link>
        <Link
          href="/superadmin/stakeholders"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <span>👥</span> Stakeholders
        </Link>
      </nav>

      <form action="/auth/signout" method="post" className="px-3 py-4 border-t border-gray-700">
        <button
          type="submit"
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          Cerrar sesión
        </button>
      </form>
    </aside>
  );
}
