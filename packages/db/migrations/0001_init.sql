-- ============================================================
-- Migration 0001_init.sql
-- Sistema multi-agente: áreas de negocio, equipo de desarrollo
-- transversal, proyectos, agentes, bitácora y dashboard gamificado.
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- ÁREAS DE NEGOCIO
-- ============================================================
create table public.areas_negocio (
    id uuid primary key default gen_random_uuid(),
    nombre text not null unique,
    descripcion text,
    pm_agente text,
    es_servicio boolean not null default false,
    creado_en timestamptz not null default now(),
    actualizado_en timestamptz not null default now()
);
comment on table public.areas_negocio is
  'Áreas de negocio (finanzas, cobranza, contable, escrituración, marketing) y áreas de servicio (desarrollo).';
comment on column public.areas_negocio.es_servicio is
  'true cuando el área es transversal y sirve a las áreas de negocio (caso desarrollo).';

-- ============================================================
-- STAKEHOLDERS
-- ============================================================
create table public.stakeholders (
    id uuid primary key default gen_random_uuid(),
    nombre text not null,
    rol text,
    email text unique,
    es_principal boolean not null default false,
    creado_en timestamptz not null default now()
);
comment on table public.stakeholders is
  'Personas reales que interactúan con el sistema. El stakeholder principal es el usuario que coordina con pm-global.';

-- ============================================================
-- AGENTES (catálogo, espejo de .claude/agents/*.md)
-- ============================================================
create table public.agentes (
    id uuid primary key default gen_random_uuid(),
    nombre text not null unique,
    rol text not null,
    area_negocio_id uuid references public.areas_negocio(id) on delete set null,
    es_transversal boolean not null default false,
    tags text[] not null default '{}',
    descripcion_breve text,
    creado_en timestamptz not null default now()
);
create index idx_agentes_tags on public.agentes using gin (tags);
create index idx_agentes_area on public.agentes(area_negocio_id);
comment on table public.agentes is
  'Catálogo de agentes. Sincronizado desde .claude/agents/*.md por scripts/sync-agentes.';

-- ============================================================
-- PROYECTOS
-- ============================================================
create table public.proyectos (
    id uuid primary key default gen_random_uuid(),
    area_negocio_id uuid not null references public.areas_negocio(id) on delete restrict,
    nombre text not null,
    descripcion text,
    estado text not null default 'activo'
        check (estado in ('activo','pausado','cerrado')),
    stakeholder_principal_id uuid references public.stakeholders(id) on delete set null,
    repo_url text,
    rama_prefijo text,
    creado_en timestamptz not null default now(),
    actualizado_en timestamptz not null default now(),
    unique (area_negocio_id, nombre)
);
create index idx_proyectos_area on public.proyectos(area_negocio_id);
create index idx_proyectos_estado on public.proyectos(estado);

create table public.proyecto_stakeholders (
    proyecto_id uuid not null references public.proyectos(id) on delete cascade,
    stakeholder_id uuid not null references public.stakeholders(id) on delete cascade,
    rol text not null,
    primary key (proyecto_id, stakeholder_id)
);

create table public.proyecto_stack (
    id uuid primary key default gen_random_uuid(),
    proyecto_id uuid not null references public.proyectos(id) on delete cascade,
    capa text not null,
    tecnologia text not null,
    notas text
);
create index idx_proyecto_stack_proyecto on public.proyecto_stack(proyecto_id);

create table public.proyecto_decisiones (
    id uuid primary key default gen_random_uuid(),
    proyecto_id uuid not null references public.proyectos(id) on delete cascade,
    titulo text not null,
    contexto text,
    decision text not null,
    consecuencias text,
    estado text not null default 'aceptada'
        check (estado in ('propuesta','aceptada','rechazada','reemplazada')),
    creado_en timestamptz not null default now()
);
create index idx_proyecto_decisiones_proyecto on public.proyecto_decisiones(proyecto_id);

-- ============================================================
-- REQUERIMIENTOS Y TAREAS
-- ============================================================
create table public.requerimientos (
    id uuid primary key default gen_random_uuid(),
    proyecto_id uuid not null references public.proyectos(id) on delete cascade,
    titulo text not null,
    descripcion text,
    prioridad text not null default 'media'
        check (prioridad in ('baja','media','alta','critica')),
    estado text not null default 'nuevo'
        check (estado in ('nuevo','en_analisis','aprobado','en_desarrollo','en_pruebas','completado','cancelado')),
    solicitado_por uuid references public.stakeholders(id) on delete set null,
    creado_en timestamptz not null default now(),
    actualizado_en timestamptz not null default now()
);
create index idx_requerimientos_proyecto on public.requerimientos(proyecto_id);
create index idx_requerimientos_estado on public.requerimientos(estado);

create table public.tareas (
    id uuid primary key default gen_random_uuid(),
    requerimiento_id uuid not null references public.requerimientos(id) on delete cascade,
    agente_asignado text not null,
    descripcion text not null,
    estado text not null default 'pendiente'
        check (estado in ('pendiente','en_progreso','en_revision','bloqueada','completada','cancelada')),
    rama text,
    creado_en timestamptz not null default now(),
    iniciado_en timestamptz,
    completado_en timestamptz
);
create index idx_tareas_requerimiento on public.tareas(requerimiento_id);
create index idx_tareas_agente on public.tareas(agente_asignado);
create index idx_tareas_estado on public.tareas(estado);

-- ============================================================
-- BITÁCORA (alimenta dashboard realtime)
-- ============================================================
create table public.bitacora_actividad (
    id uuid primary key default gen_random_uuid(),
    proyecto_id uuid references public.proyectos(id) on delete cascade,
    requerimiento_id uuid references public.requerimientos(id) on delete set null,
    tarea_id uuid references public.tareas(id) on delete set null,
    agente text not null,
    accion text not null,
    payload jsonb,
    creado_en timestamptz not null default now()
);
create index idx_bitacora_proyecto_fecha on public.bitacora_actividad(proyecto_id, creado_en desc);
create index idx_bitacora_agente on public.bitacora_actividad(agente);

-- ============================================================
-- DASHBOARD GAMIFICADO (oficinas + avatares)
-- ============================================================
create table public.oficinas (
    id uuid primary key default gen_random_uuid(),
    area_negocio_id uuid references public.areas_negocio(id) on delete cascade,
    piso int not null,
    nombre text not null,
    posicion_x int,
    posicion_y int,
    ancho int not null default 100,
    alto int not null default 100,
    color_hex text
);
create index idx_oficinas_area on public.oficinas(area_negocio_id);

create table public.avatares (
    id uuid primary key default gen_random_uuid(),
    tipo text not null check (tipo in ('agente','stakeholder')),
    agente_nombre text,
    stakeholder_id uuid references public.stakeholders(id) on delete cascade,
    nombre_mostrar text not null,
    sprite_url text,
    oficina_id uuid references public.oficinas(id) on delete set null,
    posicion_actual_x int,
    posicion_actual_y int,
    estado_animacion text not null default 'idle'
        check (estado_animacion in ('idle','caminando','trabajando','hablando','celebrando')),
    actualizado_en timestamptz not null default now(),
    check (
        (tipo = 'agente' and agente_nombre is not null and stakeholder_id is null) or
        (tipo = 'stakeholder' and stakeholder_id is not null and agente_nombre is null)
    )
);
create index idx_avatares_oficina on public.avatares(oficina_id);

-- ============================================================
-- TRIGGER GENÉRICO PARA actualizado_en
-- ============================================================
create or replace function public.set_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger trg_areas_negocio_act
  before update on public.areas_negocio
  for each row execute function public.set_actualizado_en();
create trigger trg_proyectos_act
  before update on public.proyectos
  for each row execute function public.set_actualizado_en();
create trigger trg_requerimientos_act
  before update on public.requerimientos
  for each row execute function public.set_actualizado_en();
create trigger trg_avatares_act
  before update on public.avatares
  for each row execute function public.set_actualizado_en();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.areas_negocio enable row level security;
alter table public.stakeholders enable row level security;
alter table public.agentes enable row level security;
alter table public.proyectos enable row level security;
alter table public.proyecto_stakeholders enable row level security;
alter table public.proyecto_stack enable row level security;
alter table public.proyecto_decisiones enable row level security;
alter table public.requerimientos enable row level security;
alter table public.tareas enable row level security;
alter table public.bitacora_actividad enable row level security;
alter table public.oficinas enable row level security;
alter table public.avatares enable row level security;

-- Sin políticas todavía: anon y authenticated NO ven nada;
-- service_role bypasea RLS, así que scripts y edge functions con
-- esa key sí pueden leer/escribir. Las políticas finas se agregarán
-- cuando integremos Supabase Auth para los stakeholders.

-- ============================================================
-- REALTIME PUBLICATION
-- ============================================================
alter publication supabase_realtime add table public.tareas;
alter publication supabase_realtime add table public.requerimientos;
alter publication supabase_realtime add table public.bitacora_actividad;
alter publication supabase_realtime add table public.avatares;
alter publication supabase_realtime add table public.agentes;

-- ============================================================
-- SEED INICIAL
-- ============================================================
insert into public.areas_negocio (nombre, descripcion, pm_agente, es_servicio) values
  ('desarrollo',     'Equipo transversal de desarrollo de software',     'dev-pm',           true),
  ('contable',       'Área contable: CFDI, conciliaciones, declaraciones','contable-pm',     false),
  ('finanzas',       'Área de finanzas: flujos, presupuestos, tesorería', 'finanzas-pm',     false),
  ('cobranza',       'Área de cobranza',                                  'cobranza-pm',     false),
  ('escrituracion',  'Área de escrituración: contratos, RPP, notarial',   'escrituracion-pm',false),
  ('marketing',      'Área de marketing: SEO, contenido, campañas',       'marketing-pm',    false);

insert into public.stakeholders (nombre, rol, email, es_principal) values
  ('Jorge Mendoza', 'principal', 'jorge.mendoza@sozu.com', true);

insert into public.agentes (nombre, rol, area_negocio_id, es_transversal, tags, descripcion_breve) values
  ('pm-global',         'PM Global',    null,
    true,  '{}',
    'Project Manager raíz. Rutea solicitudes a PMs de área de negocio o al equipo de desarrollo.'),
  ('dev-pm',            'PM Área',      (select id from public.areas_negocio where nombre = 'desarrollo'),
    true,  '{}',
    'PM del equipo de desarrollo transversal. Único punto de entrada al equipo.'),
  ('dev-analista',      'Especialista', (select id from public.areas_negocio where nombre = 'desarrollo'),
    true,  '{requerimientos,user-stories,casos-de-uso,bdd}',
    'Análisis de requerimientos.'),
  ('dev-diseno',        'Especialista', (select id from public.areas_negocio where nombre = 'desarrollo'),
    true,  '{ux,ui,wireframes,mermaid,accesibilidad}',
    'Diseño UX/UI.'),
  ('dev-frontend',      'Especialista', (select id from public.areas_negocio where nombre = 'desarrollo'),
    true,  '{react,nextjs,astro,typescript,tailwind,seo-tecnico,core-web-vitals,jsonld,metadata-api}',
    'Frontend con expertise en SEO técnico (Next.js + Astro).'),
  ('dev-backend',       'Especialista', (select id from public.areas_negocio where nombre = 'desarrollo'),
    true,  '{deno,supabase-edge-functions,postgrest,nodejs,typescript,rest,graphql}',
    'Backend en Supabase Edge Functions e integraciones de servicios.'),
  ('dev-bd',            'Especialista', (select id from public.areas_negocio where nombre = 'desarrollo'),
    true,  '{postgresql,plpgsql,rls,supabase,sql-optimization,erd}',
    'Base de datos PostgreSQL en Supabase.'),
  ('dev-seguridad',     'Especialista', (select id from public.areas_negocio where nombre = 'desarrollo'),
    true,  '{owasp,rls,supabase-auth,sql-injection,prompt-injection,jwt}',
    'Seguridad de aplicaciones (OWASP, RLS, autenticación).'),
  ('dev-testing',       'Especialista', (select id from public.areas_negocio where nombre = 'desarrollo'),
    true,  '{vitest,jest,pytest,playwright}',
    'QA y testing automatizado.'),
  ('dev-devops',        'Especialista', (select id from public.areas_negocio where nombre = 'desarrollo'),
    true,  '{github-actions,cicd,supabase-cli,firebase,cloud-run}',
    'CI/CD y deploys.'),
  ('dev-presentaciones','Especialista', (select id from public.areas_negocio where nombre = 'desarrollo'),
    true,  '{google-slides,marp,markdown}',
    'Generación de presentaciones (Google Slides / Marp).'),
  ('dev-videojuegos',   'Especialista', (select id from public.areas_negocio where nombre = 'desarrollo'),
    true,  '{gamemaker-studio-2,gml,openclaw-mcp}',
    'Desarrollo de videojuegos en GameMaker Studio 2.'),
  ('dev-imagenes',      'Especialista', (select id from public.areas_negocio where nombre = 'desarrollo'),
    true,  '{imagen-4,gemini-api,image-generation}',
    'Generación de imágenes con Imagen 4 vía Gemini API.'),
  ('marketing-pm',      'PM Área',      (select id from public.areas_negocio where nombre = 'marketing'),
    false, '{}',
    'PM del área de Marketing.'),
  ('marketing-seo',     'Especialista', (select id from public.areas_negocio where nombre = 'marketing'),
    false, '{seo-estrategico,keyword-research,content-strategy,link-building,gsc,ga4}',
    'SEO estratégico: research, contenido, métricas.');

-- Layout inicial del edificio: un piso por área de negocio
insert into public.oficinas (area_negocio_id, piso, nombre, posicion_x, posicion_y, ancho, alto, color_hex)
select
  id,
  row_number() over (order by case nombre
    when 'desarrollo'    then 0
    when 'contable'      then 1
    when 'finanzas'      then 2
    when 'cobranza'      then 3
    when 'escrituracion' then 4
    when 'marketing'     then 5
  end),
  'Piso ' || initcap(nombre),
  0, 0, 1200, 240,
  case nombre
    when 'desarrollo'    then '#dbeafe'
    when 'contable'      then '#dcfce7'
    when 'finanzas'      then '#fef3c7'
    when 'cobranza'      then '#fee2e2'
    when 'escrituracion' then '#ede9fe'
    when 'marketing'     then '#fce7f3'
  end
from public.areas_negocio;

-- Avatar del stakeholder principal (sin oficina fija; "deambula")
insert into public.avatares (tipo, stakeholder_id, nombre_mostrar, oficina_id, posicion_actual_x, posicion_actual_y, estado_animacion)
select 'stakeholder', s.id, s.nombre, null, 100, 100, 'idle'
from public.stakeholders s
where s.es_principal = true;

-- Avatares de los agentes — los colocamos en el piso de su área
insert into public.avatares (tipo, agente_nombre, nombre_mostrar, oficina_id, posicion_actual_x, posicion_actual_y, estado_animacion)
select
  'agente',
  a.nombre,
  a.nombre,
  o.id,
  100 + (row_number() over (partition by a.area_negocio_id order by a.nombre)) * 80,
  120,
  'idle'
from public.agentes a
left join public.oficinas o on o.area_negocio_id = a.area_negocio_id;

-- ============================================================
-- FIN
-- ============================================================
