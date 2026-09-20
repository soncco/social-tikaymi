# Avance y TODOs

## Hecho
- Inspección, plan y modelo de datos (docs/PLAN.md)

- Núcleo backend: SQLite, auth por cookie firmada, API de objetivos/posts/leads/aprendizajes; posts exigen objetivo, audiencia, etapa, CTA, métrica, plataforma e idioma; leads se atribuyen por `campaign_code` (test en `test/api.test.js`).

- Adaptadores Meta/TikTok/YouTube + importación CSV (`src/adapters`, `src/modules/importer.js`). Retención guardada tal cual por plataforma; sin proxies (se corrigió YouTube: watch time ya no sustituye reproducciones).
- Análisis (`src/modules/analysis.js`): confianza por umbrales, conversión solo con atribución, sin mezclar plataformas, recomendaciones como hipótesis si faltan datos.
- Frontend SPA en `public/` (panel con familias atención/intención/negocio, objetivos, posts, importación, leads, aprendizajes).
- Generador de enlaces UTM + WhatsApp (`POST /api/links`, sin UI aún).
- Exportación: informe Markdown (`GET /api/report.md`) y JSON del constructor (`POST /api/export/carousel`, valida tipo/layout).

## TODO
- Fase 1 pendiente: pantalla de UI para exportar carrusel; flujo de estados editorial (calendario/aprobación) en la UI; clasificación automática de temas.
- Fase 2 (IA): requiere `ANTHROPIC_API_KEY` y **información aprobada de Tikaymi** (servicios, precios, fotos, testimonios verificables). Pregunta abierta para el usuario.
- Fase 3: APIs oficiales, programación/publicación, alertas, A/B, cohortes.
- Riesgo: los encabezados reales de exportaciones de Meta/TikTok/YouTube deben validarse con CSV reales.
