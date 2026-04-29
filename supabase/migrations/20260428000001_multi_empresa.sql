-- Migración: arquitectura multi-empresa (multi-tenant)
-- Agrega tablas de empresas, servicios contratados y actualiza perfiles

-- ───────────────────────────────────────────────
-- Tabla: empresas
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS empresas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  slug        text NOT NULL UNIQUE,
  descripcion text,
  activa      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER empresas_updated_at
  BEFORE UPDATE ON empresas
  FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

-- ───────────────────────────────────────────────
-- Tabla: empresa_servicios
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS empresa_servicios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  servicio    text NOT NULL CHECK (servicio IN (
                'desarrollo','finanzas','contabilidad','marketing',
                'cobranza','escrituracion','postventa','rrhh'
              )),
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, servicio)
);

-- ───────────────────────────────────────────────
-- Modificar perfiles: agregar empresa_id
-- ───────────────────────────────────────────────
ALTER TABLE perfiles
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id);

-- Actualizar constraint de rol para incluir nuevos roles
ALTER TABLE perfiles DROP CONSTRAINT IF EXISTS perfiles_rol_check;
ALTER TABLE perfiles ADD CONSTRAINT perfiles_rol_check
  CHECK (rol IN ('plataforma_admin','empresa_admin','stakeholder','superadmin'));

-- ───────────────────────────────────────────────
-- Modificar solicitudes_aprobacion: agregar empresa_id
-- ───────────────────────────────────────────────
ALTER TABLE solicitudes_aprobacion
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id);

-- ───────────────────────────────────────────────
-- Funciones helper de RLS
-- ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION es_plataforma_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM perfiles
    WHERE id = auth.uid()
      AND rol IN ('plataforma_admin', 'superadmin')
  );
$$;

CREATE OR REPLACE FUNCTION mi_empresa_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM perfiles WHERE id = auth.uid();
$$;

-- ───────────────────────────────────────────────
-- RLS: empresas
-- ───────────────────────────────────────────────
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plataforma_admin gestiona empresas"
  ON empresas FOR ALL
  USING (es_plataforma_admin())
  WITH CHECK (es_plataforma_admin());

CREATE POLICY "usuarios ven su empresa"
  ON empresas FOR SELECT
  USING (id = mi_empresa_id());

-- ───────────────────────────────────────────────
-- RLS: empresa_servicios
-- ───────────────────────────────────────────────
ALTER TABLE empresa_servicios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plataforma_admin gestiona servicios"
  ON empresa_servicios FOR ALL
  USING (es_plataforma_admin())
  WITH CHECK (es_plataforma_admin());

CREATE POLICY "usuarios ven servicios de su empresa"
  ON empresa_servicios FOR SELECT
  USING (empresa_id = mi_empresa_id());

-- ───────────────────────────────────────────────
-- RLS: perfiles — reconstruir con aislamiento por empresa
-- ───────────────────────────────────────────────
DROP POLICY IF EXISTS "superadmin ve todos los perfiles" ON perfiles;
DROP POLICY IF EXISTS "usuarios ven su propio perfil" ON perfiles;
DROP POLICY IF EXISTS "superadmin gestiona perfiles" ON perfiles;

CREATE POLICY "plataforma_admin ve todos los perfiles"
  ON perfiles FOR SELECT
  USING (es_plataforma_admin());

CREATE POLICY "usuarios ven perfiles de su empresa"
  ON perfiles FOR SELECT
  USING (empresa_id = mi_empresa_id());

CREATE POLICY "usuarios ven su propio perfil"
  ON perfiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "plataforma_admin gestiona perfiles"
  ON perfiles FOR ALL
  USING (es_plataforma_admin())
  WITH CHECK (es_plataforma_admin());

CREATE POLICY "usuarios actualizan su propio perfil"
  ON perfiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ───────────────────────────────────────────────
-- RLS: solicitudes_aprobacion — reconstruir con empresa_id
-- ───────────────────────────────────────────────
DROP POLICY IF EXISTS "superadmin ve todas las solicitudes" ON solicitudes_aprobacion;
DROP POLICY IF EXISTS "stakeholder ve sus solicitudes" ON solicitudes_aprobacion;
DROP POLICY IF EXISTS "superadmin gestiona solicitudes" ON solicitudes_aprobacion;

CREATE POLICY "plataforma_admin ve todas las solicitudes"
  ON solicitudes_aprobacion FOR SELECT
  USING (es_plataforma_admin());

CREATE POLICY "empresa_admin ve solicitudes de su empresa"
  ON solicitudes_aprobacion FOR SELECT
  USING (empresa_id = mi_empresa_id());

CREATE POLICY "stakeholder ve sus solicitudes asignadas"
  ON solicitudes_aprobacion FOR SELECT
  USING (stakeholder_id = auth.uid());

CREATE POLICY "plataforma_admin gestiona solicitudes"
  ON solicitudes_aprobacion FOR ALL
  USING (es_plataforma_admin())
  WITH CHECK (es_plataforma_admin());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE empresas;
ALTER PUBLICATION supabase_realtime ADD TABLE empresa_servicios;
