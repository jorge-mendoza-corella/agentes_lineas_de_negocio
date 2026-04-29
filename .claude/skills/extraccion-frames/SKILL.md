# Skill: extraccion-frames

Extrae frames de un video usando ffmpeg. Útil para análisis visual, crear secuencias de imágenes o generar assets a partir de video.

## Cuándo usar esta skill

- Extraer frames para análisis visual o referencia.
- Crear una secuencia de imágenes a partir de un video.
- Obtener un frame específico (thumbnail, momento clave).
- Preparar material visual para presentaciones.

## Cómo invocarla

```
/extraccion-frames [ruta-del-video] [opciones]
```

Ejemplos:
```
/extraccion-frames salida/videos/mi_video.mp4
/extraccion-frames salida/videos/mi_video.mp4 --fps 1
/extraccion-frames salida/videos/mi_video.mp4 --frame-unico 00:00:05
```

## Ejecución

### Paso 1 — Verificar ffmpeg
```bash
ffmpeg -version
```

### Paso 2 — Crear carpeta de salida
```bash
mkdir -p salida/imagenes/frames_[nombre-video]
```

### Paso 3 — Extraer frames

**Opción A: 1 frame por segundo (recomendado para análisis)**
```bash
ffmpeg -i "salida/videos/[video].mp4" \
  -vf "fps=1" \
  -q:v 2 \
  "salida/imagenes/frames_[nombre]/frame_%04d.jpg"
```

**Opción B: Todos los frames (para animaciones)**
```bash
ffmpeg -i "salida/videos/[video].mp4" \
  -q:v 2 \
  "salida/imagenes/frames_[nombre]/frame_%04d.jpg"
```

**Opción C: Frame único en timestamp específico**
```bash
ffmpeg -ss 00:00:05 -i "salida/videos/[video].mp4" \
  -frames:v 1 -q:v 2 \
  "salida/imagenes/frame_captura.jpg"
```

**Opción D: Cada N segundos**
```bash
ffmpeg -i "salida/videos/[video].mp4" \
  -vf "fps=1/5" \
  -q:v 2 \
  "salida/imagenes/frames_[nombre]/frame_%04d.jpg"
```

### Paso 4 — Reportar resultado
Indicar:
- Directorio donde quedaron los frames.
- Número total de frames extraídos.
- Resolución de los frames.

## Notas

- Para análisis visual: `fps=1` es suficiente y genera pocos archivos.
- Para animaciones fluidas: usar todos los frames (`fps` original del video).
- Formato JPG para menor tamaño, PNG si se necesita transparencia.
- Los frames siempre van en subcarpeta de `salida/imagenes/`.
