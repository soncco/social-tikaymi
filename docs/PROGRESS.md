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
- Fase 3b (sin APIs externas, `test/phase3b.test.js`):
  - Pruebas A/B manuales: tabla `ab_tests`, `src/modules/abtests.js`, `POST/GET /api/abtests` y `GET /api/abtests/:id/evaluate`. Misma plataforma obligatoria, una sola variable (idioma|cta|formato|hook), decide por consultas atribuidas y si no hay, por intención (saves/shares/profile_visits/clicks/conversations); los me gusta nunca entran. Sin datos en ambos lados → `datos_insuficientes` con motivo; diferencia <20% → empate; con n=2 el techo es `patron_probable`. La conclusión se persiste en `ab_tests.conclusion`.
  - Recomendaciones periódicas: `src/modules/digest.js` (`weeklyDigest`) combina `analyze()+alerts()+cohorts()` en Markdown con las recomendaciones agrupadas por nivel de confianza; `GET /api/digest.md`. Sin scheduler: se invoca desde un cron externo (ejemplo documentado en el módulo).
  - Programación **manual** (no publica nada): columna `posts.programado_para` vía migración segura `ALTER TABLE` en `open()`, `PUT /api/posts/:id/schedule` (sólo desde estado `aprobado`, pasa a `programado`; 409 en otro estado), `GET /api/schedule` y `GET /api/schedule.ics` (iCal con recordatorio a -30 min).
  - `src/adapters/README.md`: contrato de los futuros conectores oficiales (`fetchStats`/`publish`, credenciales sólo por env, límites y rate limits). No implementado a propósito.

- UI completa: información aprobada/fotos, generación y revisión, alertas, cohortes, clasificación de temas.
- Fase 3b: pruebas A/B (`abtests.js`, sin likes, misma plataforma), resumen periódico (`GET /api/digest.md`, invocable desde cron), programación manual con iCal (`/api/schedule.ics`), contrato de conectores oficiales en `src/adapters/README.md`.
- Prueba de humo por API (objetivo → post → lead atribuido → importación → temas → info aprobada → generación → análisis/alertas/cohortes/informe/digest): OK. Encontró un fallo real (adaptador Meta no aceptaba `Title`/`Publish time`), corregido y con test.

## TODO (requiere al usuario o credenciales externas)
- **Datos del usuario**: cargar información aprobada de Tikaymi (servicios, precios, testimonios, fotos) en la pestaña "Info aprobada" y definir `ANTHROPIC_API_KEY` en `.env`. Sin eso la generación responde 422/503 por diseño. La llamada real a la API de Anthropic no se ha probado (solo con fetch simulado).
- **Pruebas en navegador**: la extensión de Chrome no estaba conectada; la UI solo se verificó con `node --check` y llamadas a los endpoints. Falta una revisión visual manual.
- **CSV reales**: validar los adaptadores Meta/TikTok/YouTube con exportaciones reales.
- **Conectores oficiales** (Meta/TikTok/YouTube): implementar `fetchStats`/`publish` según `src/adapters/README.md`; requiere aprobación de apps y credenciales de cada plataforma. Incluye actualización automática de estadísticas y publicación automática.
