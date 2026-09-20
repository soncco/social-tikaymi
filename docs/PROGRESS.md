# Avance y TODOs

## Hecho
- Inspección, plan y modelo de datos (docs/PLAN.md)

- Núcleo backend: SQLite, auth por cookie firmada, API de objetivos/posts/leads/aprendizajes; posts exigen objetivo, audiencia, etapa, CTA, métrica, plataforma e idioma; leads se atribuyen por `campaign_code` (test en `test/api.test.js`).

- Adaptadores Meta/TikTok/YouTube + importación CSV (`src/adapters`, `src/modules/importer.js`). Retención guardada tal cual por plataforma; sin proxies (se corrigió YouTube: watch time ya no sustituye reproducciones).
- Análisis (`src/modules/analysis.js`): confianza por umbrales, conversión solo con atribución, sin mezclar plataformas, recomendaciones como hipótesis si faltan datos.
- Frontend SPA en `public/` (panel con familias atención/intención/negocio, objetivos, posts, importación, leads, aprendizajes).
- Generador de enlaces UTM + WhatsApp (`POST /api/links`, sin UI aún).
- Exportación: informe Markdown (`GET /api/report.md`) y JSON del constructor (`POST /api/export/carousel`, valida tipo/layout).

- UI: Calendario editorial (aprobación humana con confirmación), Enlaces (UTM/WhatsApp), Carrusel (descarga JSON para el constructor).
- Fase 2: `src/modules/content.js` + tablas `approved_info`, `assets`, `generated`. Genera copys, guiones, prompts Flow, carruseles, WhatsApp y A/B usando SOLO info aprobada; rechaza posts sin objetivo (400), sin info aprobada (422), sin clave (503); todo nace en `revision`.
- Fase 3 parcial: clasificación de temas por palabras clave (`themes.js`; null si no hay coincidencia), alertas (`GET /api/alerts`), cohortes semanales (`GET /api/cohorts`). Corregido bug de normalización de «ñ».

## TODO (bloqueado o pendiente)
- **Necesita datos del usuario**: cargar información aprobada de Tikaymi (servicios, precios, testimonios, fotos) vía `/api/approved-info` y `/api/assets`, y definir `ANTHROPIC_API_KEY` en `.env`. Sin ello la generación responde 422/503 (por diseño). La generación con IA real no se ha probado contra la API (solo con fetch simulado).
- UI aún sin pantallas para: información aprobada/biblioteca de fotos, generación y revisión de contenido, alertas y cohortes (las APIs existen).
- Fase 3 no iniciada: APIs oficiales de Meta/TikTok/YouTube (requieren aprobación de apps y credenciales), programación/publicación automática, actualización automática de estadísticas, análisis A/B automático, recomendaciones periódicas.
- Validar adaptadores con CSV reales de cada plataforma.
- Pruebas manuales en navegador de toda la UI (solo se verificó sintaxis y endpoints).
