-- ============================================================
-- Stakeholders y sistema de aprobaciones
-- ============================================================

-- Perfiles de usuario (extiende auth.users)
CREATE TABLE IF NOT EXISTS perfiles (
  id          uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nombre      text NOT NULL,
  email       text NOT NULL,
  rol         text NOT NULL DEFAULT 'stakeholder'
                CHECK (rol IN ('superadmin', 'stakeholder')),
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL
);

-- Áreas de negocio visibles para cada stakeholder
CREATE TABLE IF NOT EXISTS stakeholder_areas (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  stakeholder_id  uuid REFERENCES perfiles(id) ON DELETE CASCADE NOT NULL,
  area            text NOT NULL,
  created_at      timestamptz DEFAULT now() NOT NULL,
  UNIQUE (stakeholder_id, area)
);

-- Solicitudes de aprobación creadas por pm-global
CREATE TABLE IF NOT EXISTS solicitudes_aprobacion (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo          text NOT NULL,
  descripcion     text NOT NULL,
  area            text NOT NULL,
  plan_detallado  jsonb NOT NULL DEFAULT '{}',
  estado          text NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente', 'en_revision', 'aprobada', 'rechazada', 'cancelada')),
  stakeholder_id  uuid REFERENCES perfiles(id) NOT NULL,
  created_at      timestamptz DEFAULT now() NOT NULL,
  updated_at      timestamptz DEFAULT now() NOT NULL
);

-- Respuestas de los stakeholders
CREATE TABLE IF NOT EXISTS aprobaciones (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  solicitud_id    uuid REFERENCES solicitudes_aprobacion(id) ON DELETE CASCADE NOT NULL,
  stakeholder_id  uuid REFERENCES perfiles(id) NOT NULL,
  decision        text NOT NULL
                    CHECK (decision IN ('aprobada', 'rechazada', 'solicitar_cambios')),
  comentarios     text,
  created_at      timestamptz DEFAULT now() NOT NULL
);

-- ============================================================
-- Trigger: updated_at automático
-- ============================================================

CREATE OR REPLACE FUNCTION actualizar_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_perfiles_updated_at
  BEFORE UPDATE ON perfiles
  FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

CREATE TRIGGER trg_solicitudes_updated_at
  BEFORE UPDATE ON solicitudes_aprobacion
  FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakeholder_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes_aprobacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE aprobaciones ENABLE ROW LEVEL SECURITY;

-- Helper: ¿es el usuario actual superadmin?
CREATE OR REPLACE FUNCTION es_superadmin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'superadmin'
  );
$$;

-- ── perfiles ──────────────────────────────────────────────────
CREATE POLICY "perfiles_select" ON perfiles FOR SELECT
  USING (auth.uid() = id OR es_superadmin());

CREATE POLICY "perfiles_insert" ON perfiles FOR INSERT
  WITH CHECK (es_superadmin());

CREATE POLICY "perfiles_update" ON perfiles FOR UPDATE
  USING (auth.uid() = id OR es_superadmin());

CREATE POLICY "perfiles_delete" ON perfiles FOR DELETE
  USING (es_superadmin());

-- ── stakeholder_areas ─────────────────────────────────────────
CREATE POLICY "stakeholder_areas_select" ON stakeholder_areas FOR SELECT
  USING (stakeholder_id = auth.uid() OR es_superadmin());

CREATE POLICY "stakeholder_areas_insert" ON stakeholder_areas FOR INSERT
  WITH CHECK (es_superadmin());

CREATE POLICY "stakeholder_areas_delete" ON stakeholder_areas FOR DELETE
  USING (es_superadmin());

-- ── solicitudes_aprobacion ────────────────────────────────────
CREATE POLICY "solicitudes_select" ON solicitudes_aprobacion FOR SELECT
  USING (stakeholder_id = auth.uid() OR es_superadmin());

CREATE POLICY "solicitudes_insert" ON solicitudes_aprobacion FOR INSERT
  WITH CHECK (es_superadmin());

CREATE POLICY "solicitudes_update" ON solicitudes_aprobacion FOR UPDATE
  USING (stakeholder_id = auth.uid() OR es_superadmin());

-- ── aprobaciones ──────────────────────────────────────────────
CREATE POLICY "aprobaciones_select" ON aprobaciones FOR SELECT
  USING (stakeholder_id = auth.uid() OR es_superadmin());

CREATE POLICY "aprobaciones_insert" ON aprobaciones FOR INSERT
  WITH CHECK (stakeholder_id = auth.uid());

-- ============================================================
-- Habilitar Realtime para el dashboard
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE solicitudes_aprobacion;
ALTER PUBLICATION supabase_realtime ADD TABLE aprobaciones;
