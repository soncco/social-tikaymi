# Revisión de documentación

Fecha: 2026-10-03  
Alcance: documentos Markdown de `docs/` comparados con el código actual del repositorio. No se modificó código de la aplicación.

## Resultado

La documentación principal es coherente con la implementación después de corregir afirmaciones técnicas, separar claramente las integraciones futuras y marcar explícitamente cuestiones no verificables desde el repositorio.

### Correcciones aplicadas

| Archivo | Problema | Corrección |
|---|---|---|
| `docs/CONECTAR-PLATAFORMAS.md` | Decía que las nuevas publicaciones sincronizadas por Meta entraban como `sin_clasificar`/`borrador`. | Ahora indica `estado='publicado'` con campos de clasificación `sin_clasificar`, que es lo que hacen `src/modules/sync.js` e `src/modules/importer.js`. |
| `docs/CONECTAR-PLATAFORMAS.md` | Presentaba TikTok/YouTube API como si fueran parte del sistema actual. | Sus secciones ahora están marcadas como preparación futura; se aclara que actualmente solo existen los parsers CSV. |
| `docs/PROGRESS.md` | Afirmaba “88/88 pruebas correctas”. | Se reemplazó por el resultado verificable de la revisión: 95 subpruebas, 88 pasadas y 7 fallos de apertura de puerto `EPERM` en este entorno. |
| `docs/MANUAL.md` | Decía que respaldar únicamente `data/tikaymi.db` era suficiente. | Ahora advierte sobre WAL/SHM y recomienda detener la aplicación o usar un backup consistente de SQLite. |
| `docs/CONECTAR-PLATAFORMAS.md` | Presentaba observaciones externas de compatibilidad de métricas Graph API como si fueran garantías del código. | Ahora se identifican como registro externo y se deja pendiente su verificación por versión. |
| `docs/DECISIONS_LOG.md` | No registraba esta corrección documental. | Se añadió una decisión fechada el 2026-10-03 con los cambios y sus pendientes. |

## Comprobaciones realizadas

### Afirmaciones técnicas

- Los nombres citados (`src/modules/content.js`, `src/modules/planner.js`, `src/modules/site.js`, `src/modules/editorial-strategy.js`, `src/modules/export.js`, `src/adapters/meta.js`, `src/adapters/tiktok.js`, `src/adapters/youtube.js`) existen.
- Las rutas de la API descritas en `PROJECT_AUDIT.md` corresponden a `src/api.js`.
- Los estados, tablas y migraciones descritos corresponden a `src/db/index.js`.
- La autenticación descrita corresponde a `src/server.js` y `src/modules/auth.js`.
- Las reglas de separación de plataformas, `NULL`, leads y likes corresponden a `analysis.js` y `abtests.js`.

### Constructor de carruseles

- Los dos tipos (`producto`, `informativo`) coinciden con el `LAYOUTS` del HTML.
- Los layouts y campos documentados coinciden con `defaultDataFor`, `buildFieldsFor` y los renderers.
- El esquema `app/version/tipo/exportadoEn/slides` coincide con `serializeCarousel()` y `carouselExport()`.
- La compatibilidad con `titulo`/`texto` y los aliases de `bueno-saberlo` coincide con `normalizeImportedData()` y `parseCarouselText()`.
- La distinción entre recomendación editorial de 3–5, tope backend de 7 y creación manual de hasta 20 quedó documentada como diferencia real.
- No se documentó una persistencia o integración SPA que no exista.

### Reels frente a carruseles

Las reglas están separadas en `CONTENT_RULES.md`, `VIDEO_SCRIPT_RULES.md` y `CAROUSEL_GENERATOR_SPEC.md`. Los clips de 10 segundos, audio, Killa y estructura A–F aparecen solo en la documentación de video/contenido; los layouts, diapositivas y JSON/YAML aparecen en la documentación de carruseles.

### Objetivos y métricas

`MARKETING_OBJECTIVES.md` diferencia objetivo de negocio, marketing, contenido, formato, CTA, métrica principal y secundarias. También aclara que producto/informativo/testimonial son enfoques de contenido y que likes/reproducciones no son conversiones.

### Decisiones obsoletas o no confirmadas

Las decisiones que el código no implementa están marcadas como pendientes en `DECISIONS_LOG.md`, incluyendo publicación automática, APIs de TikTok/YouTube, integración del constructor en la SPA, roles multiusuario y logging persistente de IA. La documentación histórica de progreso y clasificación conserva sus fechas/snapshots en vez de presentarlos como estado actual sin contexto.

### Claves, tokens y privacidad

- No se encontraron valores de claves, tokens o contraseñas en los documentos revisados.
- Solo aparecen nombres de variables de entorno y placeholders (`APP_ID`, `TOKEN`, etc.) necesarios para la guía operativa.
- No se incorporó el contenido de `.env` ni valores de la base de datos a ningún documento.
- La guía mantiene la instrucción de no enviar secretos por chat.

## Puntos que permanecen pendientes de verificar

- Los detalles de permisos y caducidad descritos en `CONECTAR-PLATAFORMAS.md` para Meta, TikTok y Google dependen de documentación externa y cambios de cada proveedor; no pueden demostrarse solo con este repositorio.
- Las frases de `CONECTAR-PLATAFORMAS.md` sobre métricas “verificadas” externamente no son reproducibles mediante las pruebas locales; deben tratarse como notas externas, no como garantía del código.
- La cifra y clasificación de la base real en `PROGRESS.md` es un snapshot fechado; debe volver a comprobarse contra `data/tikaymi.db` después de cambios de datos.
- La suite HTTP debe repetirse en un entorno con permiso para abrir sockets antes de cerrar la verificación de integración.
- La calidad visual, lingüística y factual de las respuestas de proveedores LLM requiere revisión humana; no está demostrada por pruebas sintéticas.

## Estado final

Documentación corregida únicamente. No se modificaron archivos de código ni componentes existentes.
