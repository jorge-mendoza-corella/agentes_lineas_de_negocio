-- Tema 1 (UX): asociar entradas de bitácora con su paso del plan_ejecucion
-- Tema 2 (Watchdog): permitir marcar la última alerta de tareas atascadas
-- ──────────────────────────────────────────────────────────────────────────

-- 1) Columna paso_index en bitacora_actividad
ALTER TABLE bitacora_actividad
  ADD COLUMN IF NOT EXISTS paso_index INTEGER;

CREATE INDEX IF NOT EXISTS idx_bitacora_tarea_paso
  ON bitacora_actividad(tarea_id, paso_index);

COMMENT ON COLUMN bitacora_actividad.paso_index IS
  'Índice 1-based del paso del plan_ejecucion al que pertenece esta entrada. NULL para entradas previas a la migración o que no corresponden a un paso específico.';

-- 2) Columna watchdog_alertado_en en tareas — evita spamear al usuario
ALTER TABLE tareas
  ADD COLUMN IF NOT EXISTS watchdog_alertado_en TIMESTAMPTZ;

COMMENT ON COLUMN tareas.watchdog_alertado_en IS
  'Última vez que el watchdog notificó al usuario que esta tarea estaba atascada. Se usa para evitar notificaciones repetidas en menos de 1h.';
