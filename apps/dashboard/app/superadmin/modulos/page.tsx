import { createClient } from '@/lib/supabase/server';
import GestionModulos from '@/components/superadmin/GestionModulos';

type ModuloRow = {
  id: string;
  nombre: string;
  descripcion: string | null;
  icono: string | null;
  activo: boolean;
  orden: number;
};

type ModuloServicioRow = {
  modulo_id: string;
  servicio_id: string;
  servicios: { id: string; nombre: string; icono: string | null } | null;
};

type ServicioRow = { id: string; nombre: string; icono: string | null };

export default async function ModulosPage() {
  const supabase = await createClient();

  const [modulosRes, moduloServiciosRes, serviciosRes] = await Promise.all([
    supabase
      .from('catalogo_modulos')
      .select('id, nombre, descripcion, icono, activo, orden')
      .order('orden'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('modulo_servicios')
      .select('modulo_id, servicio_id, servicios(id, nombre, icono)'),
    supabase.from('servicios').select('id, nombre, icono').order('nombre'),
  ]);

  const modulos = (modulosRes.data ?? []) as ModuloRow[];
  const moduloServicios = (moduloServiciosRes.data ?? []) as ModuloServicioRow[];
  const todosServicios = (serviciosRes.data ?? []) as ServicioRow[];

  const modulosConServicios = modulos.map(m => ({
    ...m,
    servicios: moduloServicios
      .filter(ms => ms.modulo_id === m.id && ms.servicios)
      .map(ms => ms.servicios!),
  }));

  return (
    <GestionModulos
      modulos={modulosConServicios}
      todosServicios={todosServicios}
    />
  );
}
