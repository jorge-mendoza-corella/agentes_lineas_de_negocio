---
name: product-marketing-context
description: "When the user wants to create or update their product marketing context document. Also use when the user mentions 'product context,' 'marketing context,' 'positioning,' 'target audience,' 'ICP,' or wants to avoid repeating foundational information across marketing tasks. Use at the start of any marketing work — creates `.agents/product-marketing-context.md` that all other marketing skills reference."
metadata:
  version: 1.1.0
---

# Product Marketing Context

Crea y mantiene un documento de contexto de marketing del producto. Captura posicionamiento y mensajes fundamentales que las demás skills de marketing referencian.

El documento se guarda en `.agents/product-marketing-context.md`.

## Workflow

### Paso 1: Verificar si existe contexto

Primero verifica si `.agents/product-marketing-context.md` ya existe.

**Si existe:** Léelo, resume qué está capturado, pregunta qué secciones actualizar.

**Si no existe, ofrece dos opciones:**
1. **Auto-draft del codebase** (recomendado): estudia README, landing pages, package.json y crea un borrador. El usuario corrige y llena huecos.
2. **Desde cero**: recorre cada sección conversacionalmente, una a la vez.

### Paso 2: Recopilar información

**Secciones a capturar:**

1. **Resumen del producto** — descripción de una línea, qué hace, categoría, modelo de negocio
2. **Audiencia objetivo** — tipo de empresa, roles de decisión, caso de uso principal, jobs-to-be-done
3. **Personas** (B2B) — Usuario, Champion, Decision Maker, Comprador Financiero, Influencer Técnico
4. **Problemas y dolores** — desafío principal, por qué las soluciones actuales fallan, costo del problema
5. **Panorama competitivo** — competidores directos, secundarios, indirectos; en qué fallan
6. **Diferenciación** — qué te distingue, por qué es mejor, por qué te eligen
7. **Objeciones y anti-personas** — top 3 objeciones + cómo responderlas; quién NO es buen fit
8. **Dinámica de cambio** — Push (qué los aleja del status quo), Pull (qué los atrae a ti), Habit (qué los retiene), Anxiety (qué les preocupa del cambio)
9. **Lenguaje del cliente** — frases textuales de cómo describen el problema y la solución
10. **Voz de marca** — tono, estilo, personalidad (3-5 adjetivos)
11. **Pruebas sociales** — métricas clave, clientes notables, testimonios, temas de valor
12. **Objetivos** — meta de negocio principal, acción de conversión clave

### Paso 3: Crear el documento

Guardar en `.agents/product-marketing-context.md` con estructura organizada por sección.

### Paso 4: Confirmar y guardar

Mostrar el documento completo, pedir ajustes, guardarlo.
Informar: "Las demás skills de marketing usarán este contexto automáticamente."
