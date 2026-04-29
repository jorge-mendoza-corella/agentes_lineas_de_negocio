export type Identificable = { id: string };

export type EstadoProyecto = 'activo' | 'pausado' | 'cerrado';

export type EstadoRequerimiento =
  | 'nuevo'
  | 'en_analisis'
  | 'aprobado'
  | 'en_desarrollo'
  | 'en_pruebas'
  | 'completado'
  | 'cancelado';

export type EstadoTarea =
  | 'pendiente'
  | 'en_progreso'
  | 'en_revision'
  | 'bloqueada'
  | 'completada'
  | 'cancelada';

export type Prioridad = 'baja' | 'media' | 'alta' | 'critica';

export type EstadoAnimacion =
  | 'idle'
  | 'caminando'
  | 'trabajando'
  | 'hablando'
  | 'celebrando';

// Multi-empresa
export type ServicioEmpresa =
  | 'desarrollo'
  | 'finanzas'
  | 'contabilidad'
  | 'marketing'
  | 'cobranza'
  | 'escrituracion'
  | 'postventa'
  | 'rrhh';

export interface Empresa extends Identificable {
  nombre: string;
  slug: string;
  descripcion: string | null;
  activa: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmpresaServicio extends Identificable {
  empresa_id: string;
  servicio: ServicioEmpresa;
  activo: boolean;
  created_at: string;
}

// Stakeholders y aprobaciones
export type RolUsuario = 'plataforma_admin' | 'empresa_admin' | 'stakeholder' | 'superadmin';

export type EstadoSolicitud =
  | 'pendiente'
  | 'en_revision'
  | 'aprobada'
  | 'rechazada'
  | 'cancelada';

export type DecisionAprobacion =
  | 'aprobada'
  | 'rechazada'
  | 'solicitar_cambios';

export interface Perfil extends Identificable {
  nombre: string;
  email: string;
  rol: RolUsuario;
  empresa_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SolicitudAprobacion extends Identificable {
  titulo: string;
  descripcion: string;
  area: string;
  plan_detallado: Record<string, unknown>;
  estado: EstadoSolicitud;
  stakeholder_id: string;
  empresa_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Aprobacion extends Identificable {
  solicitud_id: string;
  stakeholder_id: string;
  decision: DecisionAprobacion;
  comentarios: string | null;
  created_at: string;
}
