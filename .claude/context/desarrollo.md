# Área de Desarrollo — Stack y Contexto

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React, Next.js, TypeScript |
| Backend | Supabase Edge Functions (Deno), Firebase Functions, GCF |
| Base de datos | PostgreSQL (Supabase), PL/pgSQL |
| Autenticación | Supabase Auth |
| Storage | Supabase Storage / Firebase Storage |
| CI/CD | GitHub Actions |
| Hosting Frontend | Google (Firebase Hosting / Cloud Run) |
| Email | Postmark |
| WhatsApp | EvolutionAPI |
| Facturación | FacturAPI (México) |
| Firma digital | Mifiel |
| Automatización | n8n |
| Secretos | Supabase Vault / Google Secret Manager |
| Lenguajes | TypeScript, Python, SQL, PL/pgSQL |
| Presentaciones | Google Slides API / Marp |
| Generación de imágenes | Gemini API (Imagen 4) |
| Videojuegos | GameMaker Studio 2 + OpenClaw MCP + GML |
| Descarga de medios | yt-dlp + ffmpeg |

## Roles del área

| Agente | Rol |
|---|---|
| `dev-pm` | PM del área, coordina y delega |
| `dev-analista` | Requerimientos, casos de uso, historias de usuario |
| `dev-diseno` | UX/UI, wireframes, flujos |
| `dev-backend` | Edge functions, APIs, integraciones |
| `dev-frontend` | React/Next.js |
| `dev-bd` | Esquemas PostgreSQL, PL/pgSQL, diagramas ER |
| `dev-seguridad` | OWASP, RLS, autenticación |
| `dev-testing` | Vitest/Jest/Pytest/Playwright |
| `dev-devops` | GitHub Actions, CI/CD, deploys |
| `dev-presentaciones` | Google Slides / Marp |
| `dev-videojuegos` | GameMaker Studio 2 + GML |
| `dev-imagenes` | Imagen 4 vía Gemini API |

## Flujo de trabajo estándar

1. `dev-analista` → requerimientos
2. `dev-diseno` → flujo/UX
3. `dev-bd` → esquema con diagrama ER
4. `dev-seguridad` → revisión previa
5. `dev-backend` → APIs y lógica
6. `dev-frontend` → UI
7. `dev-testing` → pruebas
8. `dev-devops` → pipeline y deploy
9. `dev-pm` → reporte al usuario

Para solicitudes pequeñas el PM puede saltar pasos, pero debe declarar cuáles y por qué.

## Arquitectura multi-empresa

El sistema es **multi-tenant**: múltiples empresas comparten la misma instancia de Supabase, aisladas por `empresa_id`.

### Tablas del sistema de plataforma

| Tabla | Descripción |
|---|---|
| `empresas` | Registro de empresas cliente (nombre, slug, activa) |
| `empresa_servicios` | Servicios contratados por empresa (desarrollo, finanzas, etc.) |
| `perfiles` | Usuarios de la plataforma (plataforma_admin, empresa_admin, stakeholder, superadmin) |
| `stakeholder_areas` | Áreas asignadas a cada stakeholder |
| `solicitudes_aprobacion` | Solicitudes que requieren aprobación de stakeholders |
| `aprobaciones` | Decisiones de stakeholders sobre solicitudes |

### Roles de usuario

| Rol | Acceso |
|---|---|
| `plataforma_admin` / `superadmin` | Todo — gestiona empresas, usuarios, servicios |
| `empresa_admin` | Solo datos de su empresa |
| `stakeholder` | Solo solicitudes asignadas a sus áreas en su empresa |

### Funciones helper de RLS

```sql
es_superadmin()        -- true si rol es superadmin o plataforma_admin
es_plataforma_admin()  -- true si rol es plataforma_admin o superadmin
mi_empresa_id()        -- devuelve empresa_id del usuario autenticado
```

### Convención obligatoria para tablas nuevas

```sql
-- Toda tabla de datos de empresa debe incluir:
empresa_id uuid NOT NULL REFERENCES empresas(id)

-- Política RLS estándar de lectura:
USING (empresa_id = mi_empresa_id() OR es_plataforma_admin())
```

### Dashboard de gestión

URL base: `apps/dashboard/` (Next.js 15, App Router)

Rutas del superadmin:
- `/superadmin` — panel general con estadísticas
- `/superadmin/empresas` — listado y creación de empresas
- `/superadmin/empresas/[id]` — gestión de servicios y usuarios por empresa
- `/superadmin/stakeholders` — invitar y gestionar stakeholders

Rutas de stakeholders:
- `/aprobaciones` — solicitudes pendientes e historial
- `/aprobaciones/[id]` — detalle y formulario de decisión

---

## Skills relevantes

- `perplexity-research` — investigación técnica en internet
- `descarga-video` — yt-dlp para TikTok/YouTube/Instagram
- `extraccion-frames` — ffmpeg para análisis visual
- `generacion-imagenes` — Imagen 4 vía Gemini API
- `superpowers-brainstorming` — diseñar antes de codificar
- `superpowers-writing-plans` — planes TDD paso a paso

## Estructura de salida multimedia

```
salida/
  imagenes/    ← imágenes generadas, frames extraídos
  videos/      ← videos descargados o generados
  documentos/  ← PDFs, presentaciones exportadas
```
