# Plan de implementación — Tikaymi Marketing Intelligence & Content Lab

Base: `docs/Inicial.MD`. Este archivo registra decisiones, avance y TODOs.

## Inspección previa
- Repo existente (ahora en `carruseles-claude-design/`): solo maquetas HTML/JSX estáticas (`Tikaymi - Carrusel *.html`, `shared.jsx`, `styles.css`) y `Tikaymi - Constructor de Carruseles.html` (app autónoma, sin build).
- **Constructor de carruseles**: se reutiliza tal cual (no se toca ni se duplica). Formato de intercambio:
  ```json
  { "app":"tikaymi-constructor-carruseles", "version":1, "tipo":"producto|informativo",
    "exportadoEn":"ISO", "slides":[{"layout":"<id>","data":{...}}] }
  ```
  Layouts `producto`: portada, portada-foto, portada-editorial, ficha, itinerario, foto-sangre, split, foto-arriba, foto-abajo, galeria, cita, antes-despues, incluido, bueno-saberlo, cierre.
  Layouts `informativo`: portada, portada-foto, portada-editorial, cifras, pasos, columnas, foto-overlay, qa-panel, cierre.
  El constructor completa con defaults los campos faltantes, valida `tipo` y `layout`.

## Stack (simple)
Node 20 + Express + better-sqlite3 (un archivo `.db`) + frontend HTML/JS vanilla sin build. Auth: contraseña única por variable de entorno + cookie firmada. Tests con `node --test`.

## Arquitectura modular (`src/`)
- `db/` esquema y acceso · `modules/auth` · `modules/objectives` · `modules/posts` · `modules/metrics` (import CSV)
- `adapters/` un adaptador por plataforma (meta, tiktok, youtube) que normaliza a un modelo común sin mezclar métricas
- `modules/leads` + `modules/attribution` (UTM, códigos de campaña, keywords WhatsApp)
- `modules/analysis` (confianza estadística, recomendaciones) · `modules/export` (informes, carruseles)

## Modelo de datos
objectives(id, periodo, objetivo_negocio, meta) ·
posts(id, plataforma, external_id, titulo, fecha, formato, idioma, tema, objetivo_negocio, objetivo_marketing, objetivo_contenido, audiencia, etapa_embudo, cta, metrica_principal, campaign_code, estado) ·
metrics(post_id, captured_at, reach, impressions, plays, retention, completed_plays, likes, comments, shares, saves, profile_visits, clicks, conversations) — NULL = dato no disponible ·
leads(id, post_id?, campaign_code, fuente, estado, fecha_viaje, viajeros, notas, created_at) ·
learnings(id, fecha, texto, post_id?).
Consultas calificadas/cotizaciones/reservas se derivan del estado de los leads (no se duplican).

## MVP (Fase 1)
Auth · objetivos · posts con objetivo obligatorio · importación CSV por adaptador · leads + atribución · dashboard (atención / intención / negocio) · análisis con nivel de confianza · recomendaciones básicas · informe exportable.

## Riesgos técnicos
- Cada plataforma define retención/alcance distinto → adaptadores separados, nunca sumar entre plataformas.
- Pocos datos → confianza explícita; sin conversión no se atribuye.
- APIs oficiales requieren aprobación de apps (Meta/TikTok) → Fase 3; CSV primero. Actualización: la **lectura** de Instagram por API ya funciona en modo Desarrollo sin App Review (solo cuentas con rol en la app); la aprobación sólo hace falta para publicar o para cuentas de terceros.
- Fotos del constructor exigen URLs con CORS.

## Avance
(ver `docs/PROGRESS.md`)
