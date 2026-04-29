# Skills disponibles

## Skills activas (listas para usar con /comando)

### Generales
| Skill | Comando | Descripción |
|---|---|---|
| `perplexity-research` | `/perplexity-research` | Investigación en internet con fuentes |
| `descarga-video` | `/descarga-video` | Descarga videos con yt-dlp |
| `extraccion-frames` | `/extraccion-frames` | Extrae frames de video con ffmpeg |
| `generacion-imagenes` | `/generacion-imagenes` | Genera imágenes con Imagen 4 (Gemini) |
| `humanizar` | `/humanizar` | Reescribe texto IA para sonar natural |

### Superpowers — Metodología de desarrollo
| Skill | Comando | Descripción |
|---|---|---|
| `superpowers-using-superpowers` | `/using-superpowers` | Cómo usar las skills (leer al iniciar) |
| `superpowers-brainstorming` | `/brainstorming` | Diseñar antes de implementar (OBLIGATORIO) |
| `superpowers-writing-plans` | `/writing-plans` | Crear plan de implementación detallado |
| `superpowers-executing-plans` | `/executing-plans` | Ejecutar plan con checkpoints |
| `superpowers-subagent-dev` | `/subagent-driven-development` | Ejecutar con subagentes + revisión en 2 etapas |
| `superpowers-tdd` | `/test-driven-development` | TDD: test primero, siempre |
| `superpowers-debugging` | `/systematic-debugging` | Debug sistemático: causa raíz primero |
| `superpowers-parallel-agents` | `/dispatching-parallel-agents` | Despachar múltiples agentes en paralelo |
| `superpowers-finishing-branch` | `/finishing-a-development-branch` | Finalizar rama: merge, PR o descarte |

### Marketing
| Skill | Comando | Descripción |
|---|---|---|
| `marketing-contexto` | `/product-marketing-context` | Crear/actualizar contexto de marketing del producto |
| `marketing-copywriting` | `/copywriting` | Escribir copy de conversión para páginas |
| `marketing-cro` | `/page-cro` | Optimización de conversión de páginas |
| `marketing-email-sequence` | `/email-sequence` | Diseñar secuencias de email automatizadas |
| `marketing-content-strategy` | `/content-strategy` | Planificar estrategia de contenido |

## Skills instaladas via plugin (automáticas, sin /comando)

### claude-mem — Memoria persistente entre sesiones
- **Estado:** ✅ Instalado globalmente en `~/.claude/plugins/marketplaces/thedotmack`
- **Cómo funciona:** Automático. Hooks activos en cada sesión.
- **Buscar en memoria:** `/mem-search`
- **Ver memorias:** http://localhost:37777 (cuando el worker esté activo)
- **Iniciar worker:** `npx claude-mem start`

## Skills que requieren instalación manual adicional

### ui-ux-pro-max — 161 reglas de UI/UX automáticas
```bash
npm install -g uipro-cli
uipro init --ai claude
```
Repo: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill

### everything-claude-code — Colección de 156 skills
```bash
npm install ecc-universal
npx ecc install
```
Repo: https://github.com/affaan-m/everything-claude-code

## MCP Servers configurados

### n8n-mcp — Integración n8n
- **Config:** `.mcp.json` en la raíz del proyecto
- **Activar:** Agregar `N8N_API_URL` y `N8N_API_KEY` en `.env.local`
- Repo: https://github.com/czlonkowski/n8n-mcp
