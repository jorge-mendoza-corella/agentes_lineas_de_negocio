# Skill: descarga-video

Descarga videos de TikTok, YouTube, Instagram, Twitter/X y otras plataformas usando yt-dlp.

## Cuándo usar esta skill

- El usuario pide descargar un video de una URL.
- Se necesita un video como fuente para extraer frames o generar contenido.

## Cómo invocarla

```
/descarga-video [URL del video]
```

Ejemplos:
```
/descarga-video https://www.youtube.com/watch?v=xxxxx
/descarga-video https://www.tiktok.com/@usuario/video/xxxxx
```

## Ejecución

### Paso 1 — Verificar que yt-dlp está instalado
```bash
yt-dlp --version
```
Si no está, instalar: `pip install yt-dlp` o `winget install yt-dlp`.

### Paso 2 — Descargar el video
```bash
yt-dlp \
  --output "salida/videos/%(title)s.%(ext)s" \
  --format "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" \
  --merge-output-format mp4 \
  "[URL]"
```

### Paso 3 — Confirmar descarga
Verificar que el archivo existe en `salida/videos/` y reportar:
- Nombre del archivo descargado.
- Tamaño aproximado.
- Duración si está disponible.

## Opciones adicionales

| Opción | Comando |
|---|---|
| Solo audio (MP3) | `--extract-audio --audio-format mp3` |
| Resolución específica | `--format "bestvideo[height<=720]"` |
| Sin marca de agua (TikTok) | Automático con yt-dlp actualizado |
| Subtítulos | `--write-subs --sub-langs es,en` |

## Notas

- Respetar los términos de servicio de cada plataforma.
- Si el video es privado o requiere login, informar al usuario.
- Directorio de salida siempre: `salida/videos/`.
