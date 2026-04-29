# Skill: perplexity-research

Realiza investigación en internet sobre un tema técnico o de negocio y devuelve un resumen estructurado con fuentes.

## Cuándo usar esta skill

- Investigar librerías, APIs o herramientas antes de adoptarlas.
- Verificar precios, límites o features actuales de un servicio.
- Buscar soluciones a errores o problemas técnicos específicos.
- Obtener contexto de mercado o industria para una decisión.

## Cómo invocarla

```
/perplexity-research [tema o pregunta]
```

Ejemplos:
```
/perplexity-research límites de rate limiting de Supabase Edge Functions 2024
/perplexity-research mejores librerías React para tablas de datos con paginación
/perplexity-research cómo integrar FacturAPI con webhooks en Node.js
```

## Ejecución

1. Recibir el tema o pregunta del usuario o del agente que invoca.
2. Usar la herramienta `WebSearch` con 2-3 queries variadas para cubrir el tema.
3. Sintetizar la información encontrada en un resumen estructurado.
4. Incluir fuentes relevantes al final.

## Formato de respuesta

```
## Resumen: [tema]

### Hallazgos principales
- ...
- ...

### Detalles técnicos relevantes
[Lo más importante para implementar o decidir]

### Advertencias / Limitaciones
[Lo que hay que tener cuidado]

### Fuentes
- [URL 1]
- [URL 2]
```

## Notas

- Priorizar fuentes oficiales (docs, changelogs) sobre blogs de terceros.
- Si la información encontrada es contradictoria, reportarlo explícitamente.
- Indicar la fecha de la información cuando sea relevante (APIs cambian frecuentemente).
