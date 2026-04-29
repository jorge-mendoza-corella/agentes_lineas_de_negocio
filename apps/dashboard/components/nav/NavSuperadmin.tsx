import Link from 'next/link';
import LogoutButton from './LogoutButton';
import { APP_VERSION } from '@/lib/version';

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

        <div className="pt-3 pb-1 px-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Proyectos</p>
        </div>
        <Link
          href="/superadmin/proyectos"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <span>📋</span> Proyectos
        </Link>
        <Link
          href="/superadmin/sims"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <span>🏢</span> Vista agentes
        </Link>

        <div className="pt-3 pb-1 px-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Agentes IA</p>
        </div>
        <Link
          href="/superadmin/solicitar"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <span>💬</span> Solicitar
        </Link>
      </nav>

      <div className="px-3 py-4 border-t border-gray-700 space-y-2">
        <LogoutButton className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors" />
        <p className="text-center text-[10px] text-gray-600 font-mono select-none">{APP_VERSION}</p>
      </div>
    </aside>
  );
}
