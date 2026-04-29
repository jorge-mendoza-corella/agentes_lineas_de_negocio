# Skill: humanizar

Reescribe texto generado por IA eliminando los patrones que delatan su origen artificial. Produce texto natural, claro y sin relleno.

Adaptado de: https://github.com/blader/humanizer

## Cuándo usar esta skill

- Redactar emails, propuestas o comunicados que suenen naturales.
- Limpiar respuestas de IA antes de enviarlas a clientes.
- Adaptar documentación técnica a un tono más humano.
- Preparar copias de marketing o ventas.

## Cómo invocarla

```
/humanizar [texto a reescribir]
```

O pegar el texto después de invocar el comando.

## Patrones que elimina

| Patrón IA | Alternativa humana |
|---|---|
| "En el dinámico mundo de..." | Directo al punto |
| "Es importante destacar que..." | Omitir, o ir al hecho |
| "En conclusión, podemos observar..." | Simplemente concluir |
| Guiones em (—) en exceso | Comas o puntos |
| "Robusto", "apalancado", "sinergia" | Palabras concretas |
| Listas de 3 puntos siempre | Varía la estructura |
| "Ciertamente", "Sin duda" | Eliminar |
| Frases que empiezan con "Recuerda que" | Reescribir directamente |

## Proceso de ejecución

1. Leer el texto completo.
2. Identificar todos los patrones artificiales.
3. Reescribir manteniendo el significado original.
4. Verificar que el tono sea apropiado para la audiencia.
5. Entregar solo el texto reescrito, sin explicaciones adicionales.

## Reglas de oro

- **No agregar**, solo reescribir. Menos palabras es mejor.
- Mantener el significado técnico intacto.
- Si el usuario dio una muestra de su voz ("escribe como yo"), usar ese tono.
- Si el texto ya suena natural, decirlo y no cambiar nada.
