# Avance y TODOs

## Hecho
- Inspección, plan y modelo de datos (docs/PLAN.md)

- Núcleo backend: SQLite, auth por cookie firmada, API de objetivos/posts/leads/aprendizajes; posts exigen objetivo, audiencia, etapa, CTA, métrica, plataforma e idioma; leads se atribuyen por `campaign_code` (test en `test/api.test.js`).

## TODO
- Adaptadores CSV por plataforma + importación
- Módulo de análisis (confianza estadística) y recomendaciones
- Dashboard frontend
- Exportación de informe y export al constructor de carruseles
