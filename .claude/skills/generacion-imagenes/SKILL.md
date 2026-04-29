# Skill: generacion-imagenes

Genera imágenes de alta calidad usando Imagen 4 vía la API de Gemini. Guarda los resultados en `salida/imagenes/`.

## Cuándo usar esta skill

- El usuario pide crear una imagen, ilustración o asset visual.
- Se necesitan imágenes para una presentación o videojuego.
- Se quieren variaciones visuales de un personaje, escena o concepto.

## Cómo invocarla

```
/generacion-imagenes [descripción de la imagen]
```

Ejemplos:
```
/generacion-imagenes Un agente de bienes raíces mostrando un departamento moderno, estilo ilustración profesional
/generacion-imagenes Logo minimalista para empresa constructora, colores azul y gris
/generacion-imagenes Personaje cartoon de un robot asistente amigable para videojuego 2D
```

## Ejecución

### Paso 1 — Construir el prompt optimizado

Estructura: `[sujeto] + [acción/pose] + [entorno] + [estilo] + [iluminación] + [calidad]`

Añadir siempre al final: `"high quality, detailed, professional"`

### Paso 2 — Llamar a la Gemini API

```python
import google.generativeai as genai
import base64
import os
from datetime import datetime

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

imagen_client = genai.ImageGenerationModel("imagen-4.0-generate-001")

response = imagen_client.generate_images(
    prompt="[prompt construido]",
    number_of_images=1,
    aspect_ratio="1:1",  # opciones: "1:1", "16:9", "9:16", "4:3", "3:4"
    safety_filter_level="block_some",
    person_generation="allow_adult",
)

# Guardar imagen
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
nombre_archivo = f"salida/imagenes/imagen_{timestamp}.png"

for i, imagen in enumerate(response.generated_images):
    img_bytes = base64.b64decode(imagen.image.image_bytes)
    with open(nombre_archivo, "wb") as f:
        f.write(img_bytes)

print(f"Imagen guardada en: {nombre_archivo}")
```

### Paso 3 — Verificar y reportar

- Confirmar que el archivo existe en `salida/imagenes/`.
- Reportar la ruta al usuario o al agente que invocó la skill.
- Si el resultado no es satisfactorio, iterar el prompt con más detalle.

## Parámetros de aspect_ratio

| Valor | Uso recomendado |
|---|---|
| `1:1` | Avatares, iconos, posts cuadrados |
| `16:9` | Slides, wallpapers, portadas de video |
| `9:16` | Stories, TikTok, vertical mobile |
| `4:3` | Presentaciones tradicionales |
| `3:4` | Retratos, fotos de perfil verticales |

## Secreto requerido

- `GEMINI_API_KEY` — debe estar en `.env.local` (desarrollo) o en Google Secret Manager (producción).

## Notas

- Imagen 4 es el modelo más capaz; no bajar a versiones anteriores sin justificación.
- Si la imagen contiene personas reales identificables, consultar al usuario antes de generar.
- Máximo 4 imágenes por llamada (`number_of_images=4`).
