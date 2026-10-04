# Auditoría técnica del repositorio

Fecha de revisión: 2026-10-03  
Alcance: inspección estática de código, esquema SQLite, documentación, interfaz, constructor de carruseles, variables de entorno y pruebas. No se modificó ningún archivo de código.

## 1. Resumen ejecutivo

Tikaymi Marketing Intelligence es una aplicación interna web para convertir publicaciones y métricas de redes sociales en análisis, planes editoriales, borradores de contenido y seguimiento de consultas comerciales. El backend es Node.js/CommonJS con Express 5 y SQLite (`better-sqlite3`); el frontend es una SPA sin framework ni proceso de build.

El flujo implementado es: conectar/importar datos → analizar por plataforma → proponer un plan → aprobar ideas → generar borradores con IA → aprobar contenido → programar un recordatorio manual → registrar consultas y aprender.

La aplicación no publica automáticamente en redes. TikTok y YouTube Shorts tienen adaptadores CSV, pero no se identificó un conector API de lectura equivalente al de Instagram/Facebook. La generación usa proveedores LLM configurables, pero siempre queda en revisión humana.

## 2. Estructura de carpetas

| Ruta | Contenido confirmado |
|---|---|
| `src/server.js` | Arranque de Express, carga de `.env`, autenticación, middleware JSON/cookies y archivos estáticos. |
| `src/api.js` | Rutas HTTP autenticadas de la aplicación. |
| `src/db/` | Esquema SQLite y migraciones idempotentes. |
| `src/modules/` | Lógica de publicaciones, análisis, planificación, IA, sitio web, atribución, leads, alertas, cohortes, A/B, digest y agenda. |
| `src/adapters/` | Normalización de Meta, TikTok y YouTube Shorts. |
| `public/` | SPA principal (`index.html`, `app.js`, `app.css`) y logo. |
| `carruseles-claude-design/` | Constructor autónomo de carruseles, ejemplos, estilos, JSX compartido y logo. Incluye biblioteca `js-yaml` por CDN. |
| `scripts/` | Renovación del token Meta y clasificación histórica. |
| `test/` | Pruebas unitarias e integración del backend y adaptadores. |
| `docs/` | Requerimientos, plan, progreso, manual, conexión de plataformas y clasificación histórica. |
| `data/` | Base SQLite local, WAL/SHM y copias de respaldo presentes en el entorno. |

No se identificó un pipeline de build frontend, TypeScript, ORM, framework frontend, contenedor, migrador externo ni configuración de despliegue.

## 3. Tecnologías y ejecución

Confirmado en `package.json`:

- Node.js/CommonJS (`"type": "commonjs"`), con scripts `start`, `test` y `meta:renew`.
- Express 5.2, `cookie-parser`, `better-sqlite3`, `cheerio` y `csv-parse`.
- Frontend HTML/CSS/JavaScript vanilla; no hay bundler.
- Pruebas con `node --test`.
- El servidor se inicia con `npm start` y sirve `public/` en `http://localhost:3000` (o `PORT`).

## 4. Modelo y esquema de datos

El esquema se crea en `src/db/index.js` y se abre en modo WAL con claves foráneas activadas. Tablas confirmadas:

- `objectives`: objetivo comercial por período.
- `posts`: plataforma, publicación, idioma, contexto editorial, estado y fecha de programación.
- `metrics`: snapshot normalizado por publicación; las métricas ausentes se guardan como `NULL`.
- `leads`: consultas y avance comercial, con posible vínculo a publicación/código.
- `settings`: proveedor/modelo LLM y estrategia editorial serializada.
- `learnings`: notas manuales.
- `approved_info`: información textual autorizada para IA.
- `assets`: URLs de fotografías/videos disponibles para generación.
- `site_pages`: copia local de páginas de Tikaymi, hash, idioma, tipo, aprobación y estado activo.
- `site_syncs`: auditoría de sincronizaciones del sitio.
- `generated`: borradores IA y estado (`revision`, `aprobado`, `rechazado`), con vínculo opcional a `plan_ideas`.
- `editorial_plans` y `plan_ideas`: planes, brief, plataformas destino, evidencia, limitaciones, confianza, fecha y decisión humana.
- `ab_tests`: pruebas A/B manuales de dos publicaciones de la misma plataforma.
- `post_classification_audit`: procedencia, confianza, motivo y edición manual de clasificación retrospectiva.

Migraciones identificadas: `posts.programado_para`, auditoría manual, vínculo `generated.plan_idea_id`, fecha/fuente de idea, `site_pages.active` y `site_syncs.removed`, además de la migración UX `migration_ux_v2`.

## 5. Rutas y endpoints

### Autenticación

- `POST /api/login`
- `POST /api/logout`
- Todas las demás rutas bajo `/api` pasan por `auth.require`.
- `GET /api/constants` también queda detrás de la autenticación por el orden del middleware.

### Datos y análisis

- `GET/POST /api/objectives`
- `GET/POST/PUT/DELETE /api/posts`, incluyendo `PUT /api/posts/bulk`.
- `GET/POST/PUT /api/leads`
- `GET /api/analysis`
- `GET /api/alerts`, `/api/cohorts`, `/api/learnings`; `POST /api/learnings`.
- `GET/POST /api/abtests`, `GET /api/abtests/:id/evaluate`.
- `GET /api/report.md` y `GET /api/digest.md` devuelven Markdown.

### Importación y plataformas

- `POST /api/import/:plataforma` acepta CSV para `instagram`, `facebook`, `tiktok` y `youtube_shorts`.
- `POST /api/sync/:plataforma` sincroniza por API oficial únicamente `instagram` y `facebook`; es manual y de solo lectura.
- `POST /api/links` genera enlaces UTM/WhatsApp según `src/modules/attribution.js`.

### IA y biblioteca

- `GET/PUT /api/llm` muestra/configura proveedor y modelo; nunca expone claves.
- `GET/POST/PUT/DELETE /api/approved-info`.
- `GET/POST/DELETE /api/assets`.
- `GET /api/generated`, `POST /api/generate`, `POST /api/generate-package`, `PUT /api/generated/:id`.
- `GET/POST /api/plans`, `GET /api/plans/preview`, `GET /api/plans/:id`, `PUT /api/plan-ideas/:id`.

### Sitio web y agenda

- `GET /api/site/status`, `GET /api/site/pages`.
- `POST /api/site/sync` descarga manualmente sitemap y páginas de `https://tikaymi.com`.
- `PUT /api/site/approve` y `PUT /api/site/approve-batch` aprueban/desaprueban páginas activas.
- `GET/PUT /api/editorial-strategy`.
- `GET /api/schedule`, `PUT /api/posts/:id/schedule`, `GET /api/schedule.ics`.

No se identificó un endpoint de publicación automática en Instagram, Facebook, TikTok o YouTube.

## 6. Autenticación y autorización

Confirmado:

- Una sola contraseña administrativa en `ADMIN_PASSWORD`.
- Cookie `session` HTTP-only, `sameSite: lax`, duración de siete días.
- Firma HMAC-SHA256 con `SESSION_SECRET` y comparación temporalmente segura.
- Las claves de IA y Meta no se almacenan en SQLite; el estado de configuración solo indica si existen.
- La aprobación de borradores y páginas requiere una sesión autenticada.

No identificado: usuarios múltiples, roles, permisos por recurso, recuperación de contraseña, 2FA, rotación de sesiones, CSRF explícito, rate limiting, bloqueo por intentos, auditoría de login o gestión de secretos externa.

## 7. Integraciones externas

### Meta (Instagram y Facebook)

`src/adapters/meta.js` usa Graph API para listar publicaciones y consultar insights. Instagram usa `META_ACCESS_TOKEN` y `META_IG_USER_ID`; Facebook obtiene un token de Página desde `META_PAGE_ID`. Incluye estado/expiración de token y renovación de token de larga duración (~60 días) mediante `scripts/meta-renew.js`.

Limitaciones confirmadas en el código: ciertas métricas retiradas o no soportadas quedan en `NULL`; retención y conversaciones no se inventan; Facebook e Instagram se analizan por separado.

### TikTok y YouTube Shorts

Solo se identificaron parsers CSV (`src/adapters/tiktok.js`, `src/adapters/youtube.js`). No se identificó OAuth ni API de lectura implementada para estas plataformas.

### Sitio Tikaymi

`src/modules/site.js` descarga el sitemap, valida HTTPS/dominio, extrae HTML con Cheerio, guarda una copia local con hash y retira aprobación cuando cambia el contenido. La sincronización es manual, limitada a 250 páginas y con hasta seis workers concurrentes. Las páginas archivadas no se borran.

### Proveedores LLM

Se identificaron Anthropic, OpenAI y DeepSeek. El proveedor activo y modelo se guardan en `settings`; la clave se lee del entorno. Se implementan errores de red, respuesta vacía y HTTP 429.

## 8. Módulo de IA

Confirmado:

- Generación de `copy`, `guion`, `prompt_flow`, `carrusel`, `whatsapp` y `ab`.
- Puede partir de una publicación, una idea aprobada o un brief nuevo; la publicación de referencia no es obligatoria si el brief completo es válido.
- `generate-package` hace obligatorio el copy y permite un complemento; guarda atómicamente el paquete.
- El prompt incluye estrategia editorial, información aprobada, páginas web aprobadas relacionadas, recursos, resumen de análisis y restricciones anti-invención.
- El copy se limpia de Markdown y se solicitan emojis.
- Guiones/prompt Flow exigen exactamente 3–5 clips, audio, continuidad, fotos de referencia y uso opcional/no repetitivo de Killa.
- Los resultados nacen en `revision`; la API solo permite `revision`, `aprobado` y `rechazado`.
- El servidor escribe diagnósticos de validación en consola, pero no existe logging persistente de prompts/respuestas.

Parcial:

- La calidad factual depende de que una persona apruebe correctamente páginas, `approved_info` y `assets`; el código no verifica por sí mismo que el contenido autorizado siga vigente fuera del hash del sitio.
- El análisis que se entrega al prompt usa datos disponibles globalmente; no se identificó una ventana histórica configurable por usuario.
- No se identificó una evaluación automática de calidad lingüística, duplicación semántica o cumplimiento de marca después de generar.

## 9. Generador de carruseles

El constructor es un HTML autónomo en `carruseles-claude-design/Tikaymi - Constructor de Carruseles.html`, separado de la SPA principal. Define dos tipos:

- `producto`: `portada`, `portada-foto`, `portada-editorial`, `ficha`, `itinerario`, `foto-sangre`, `split`, `foto-arriba`, `foto-abajo`, `galeria`, `cita`, `antes-despues`, `incluido`, `bueno-saberlo`, `cierre`.
- `informativo`: `portada`, `portada-foto`, `portada-editorial`, `cifras`, `pasos`, `columnas`, `foto-overlay`, `qa-panel`, `cierre`.

El constructor permite crear diapositivas, cambiar layout, reordenar/eliminar, previsualizar, descargar imágenes y guardar/cargar JSON o YAML. Acepta texto pegado y archivos; mantiene compatibilidad con campos antiguos `titulo`/`texto` y alias como `bueno-saber-lo`.

`src/modules/export.js` replica la validación para la IA y produce `{app, version, tipo, exportadoEn, slides}`. Normaliza campos antiguos, valida tipo/layout y limita a siete como tope técnico, mientras el prompt solicita 3–5.

Parcial: el constructor no aparece montado como ruta explícita de Express ni como sección integrada de la SPA; su uso depende de abrir el HTML independiente o de consumir un JSON generado. No se identificó persistencia de proyectos de carrusel en SQLite.

## 10. Formatos de entrada y salida

- CSV de estadísticas: Meta, TikTok Studio y YouTube Studio, con encabezados heurísticos por adaptador.
- JSON HTTP para todos los endpoints de la API.
- JSON/YAML de carruseles, con esquema `tipo` + `slides[].layout` + `slides[].data`.
- `.env` para secretos y configuración de proceso.
- Salidas: JSON de API, Markdown (`report.md`, `digest.md`), iCalendar (`schedule.ics`), imágenes descargadas por el constructor y borradores textuales/JSON almacenados en `generated`.

No identificado: esquema formal versionado para CSV, OpenAPI/Swagger, JSON Schema publicado, validación YAML en backend o formato de exportación/importación de planes completos.

## 11. Sistema de configuración y variables de entorno

`.env.example` documenta:

| Variable | Uso confirmado |
|---|---|
| `PORT` | Puerto HTTP. |
| `ADMIN_PASSWORD` | Contraseña administrativa única. |
| `SESSION_SECRET` | Firma HMAC de sesión. |
| `LLM_PROVIDER` | Proveedor LLM por defecto si no se configura en SQLite. |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `DEEPSEEK_API_KEY` | Claves de proveedores LLM. |
| `ANTHROPIC_MODEL`, `OPENAI_MODEL`, `DEEPSEEK_MODEL` | Modelos opcionales. |
| `META_APP_ID`, `META_APP_SECRET`, `META_ACCESS_TOKEN`, `META_PAGE_ID`, `META_IG_USER_ID` | Integración Meta. |
| `DB_FILE` | Ruta de SQLite, usada por `src/db/index.js` aunque no aparece en `.env.example`. |
| `META_GRAPH_VERSION` | Versión Graph, usada por el adaptador Meta aunque no aparece en `.env.example`. |

La estrategia editorial se configura desde la UI y se serializa en `settings`. `.env` y `data/*.db*` están ignorados por Git.

## 12. Pruebas existentes y verificación

Hay 95 subpruebas en 13 archivos. Cubren análisis estadístico, API, contenido IA, exportación de carrusel, importadores, LLM, Meta, fase 3, planner, sitio, clasificación y UX.

En esta revisión se ejecutó `npm test`: 88 pruebas pasaron y 7 fallaron. Los siete fallos corresponden a pruebas HTTP que intentan abrir un servidor y reciben `listen EPERM: operation not permitted 0.0.0.0` en este entorno restringido; además se generó actividad asíncrona posterior al fin de esos tests. No se observó en esa ejecución un fallo funcional de las pruebas unitarias restantes. Esto requiere repetir la suite en un entorno donde esté permitido abrir puertos antes de considerar el conjunto completamente verificado.

No identificado: cobertura porcentual, CI, pruebas de navegador/E2E, pruebas de carga, pruebas de seguridad, pruebas contra APIs reales con credenciales y fixtures formales del sitio completo.

## 13. Funcionalidades confirmadas en código

- Login administrativo con cookie firmada.
- CRUD de objetivos, publicaciones, leads, aprendizajes, biblioteca y recursos.
- Clasificación masiva progresiva con auditoría de cambios.
- Importación CSV para cuatro identificadores de plataforma.
- Sincronización manual Meta para Instagram/Facebook.
- Análisis por plataforma con `NULL` distinto de cero, confianza y atribución explícita.
- Alertas, cohortes, digest Markdown y pruebas A/B manuales.
- Plan semanal/mensual determinista y refinamiento opcional con IA.
- Estrategia editorial de Tikaymi editable y utilizada por planificador/generación.
- Copia local revisable del sitio, aprobación individual y por lote.
- Generación IA restringida a fuentes aprobadas y aprobación humana obligatoria.
- Constructor externo de carruseles con JSON/YAML y compatibilidad de layouts antiguos.
- Agenda manual e iCalendar; no publicación automática.

## 14. Funcionalidades parcialmente implementadas

- TikTok/YouTube: importación CSV sí; sincronización API no identificada.
- Carruseles: constructor funcional separado; no integrado como módulo persistente de la SPA.
- Plan editorial: usa heurísticas de títulos/similitud y todas las publicaciones analizables; no hay ventana temporal configurable ni semántica completa.
- Clasificación: tema automático limitado a palabras clave; no sugiere de forma general objetivo, audiencia, etapa y CTA.
- IA: proveedores integrados, pero no hay observabilidad persistente ni evaluación automática post-generación.
- Programación: guarda recordatorios y exporta iCal; no ejecuta publicación.
- Seguridad operativa: autenticación funcional para un administrador, sin controles avanzados identificados.
- Pruebas de integración HTTP: presentes, pero no completan en el entorno actual por restricción de sockets.

## 15. Funcionalidades mencionadas pero inexistentes o no identificadas

- Publicación automática en redes sociales.
- Conectores API oficiales de TikTok y YouTube Shorts.
- Usuarios, roles o permisos diferenciados.
- Dashboard de atribución automática desde CRM, WhatsApp o reservas externas.
- Scheduler interno/cron administrado por la aplicación.
- Persistencia de proyectos y edición de carruseles dentro de la SPA principal.
- Registro persistente de prompts, respuestas, costos, tokens o trazas de IA.
- OpenAPI/JSON Schema, CI/CD, despliegue y observabilidad de producción.
- Scraping general de todo el sitio fuera del flujo limitado sitemap→páginas aprobables.

## 16. Riesgos técnicos

1. **Seguridad de sesión:** contraseña única; sin rate limiting, CSRF explícito, 2FA o roles identificados.
2. **Secretos:** `.env` es el mecanismo principal; `scripts/meta-renew.js` reescribe el token en disco. Debe protegerse el host y evitar logs accidentales.
3. **Dependencia de APIs cambiantes:** Meta puede retirar métricas/permisos; el adaptador maneja algunos casos, pero requiere mantenimiento.
4. **Calidad de fuentes:** aprobar una página o dato habilita su uso por IA; una aprobación editorial incorrecta puede producir contenido incorrecto aunque el prompt prohíba inventar.
5. **Heurísticas de novedad:** la comparación de títulos puede no detectar duplicados conceptuales o puede descartar ideas válidas.
6. **Concurrencia/sincronización:** la copia web limita una sincronización global mediante una bandera en memoria; no coordina múltiples procesos.
7. **Datos locales:** SQLite/WAL y respaldos están en el filesystem; no se identificó estrategia automática de backup, migración entre entornos o recuperación ante desastre.
8. **Frontend sin build:** facilita operación, pero concentra bastante lógica en `public/app.js` y no se identificó suite E2E.
9. **Pruebas de red:** la suite HTTP depende de permisos de sockets y las integraciones reales no están verificadas con credenciales productivas.
10. **Escala:** el scraping está limitado a 250 páginas y la consulta de páginas aprobadas/cuerpo textual se realiza directamente desde SQLite; no se identificó paginación completa para todos los listados.

## 17. Decisiones que requieren confirmación

- ¿La aplicación seguirá siendo una herramienta interna de un solo administrador o necesita usuarios/roles?
- ¿Se desea publicación automática en alguna red, o se mantiene deliberadamente el modelo de aprobación/publicación manual?
- ¿Se priorizarán APIs oficiales de TikTok y YouTube o continuará la importación CSV?
- ¿El constructor de carruseles debe integrarse a la SPA y guardar proyectos, o permanecer como herramienta independiente?
- ¿Cuál debe ser la ventana histórica del análisis y del plan: todas las publicaciones o períodos configurables?
- ¿Debe existir auditoría persistente de prompts/respuestas/costos de IA, respetando privacidad?
- ¿Qué estrategia de backups, despliegue y recuperación se requiere para la base SQLite?
- ¿Qué permisos, revisión de Meta y política de tokens se adoptarán antes de cualquier publicación automática?
- ¿Qué campos y fuentes necesitan aprobación obligatoria por idioma para tours/blogs frente a otras páginas?
- ¿Qué criterio de éxito comercial debe usarse cuando no existen leads atribuidos?

## 18. Archivos de referencia inspeccionados

`package.json`, `.env.example`, `.gitignore`, `README.md`, `CLAUDE.md`, `docs/Inicial.MD`, `docs/PLAN.md`, `docs/PROGRESS.md`, `docs/MANUAL.md`, `docs/CONECTAR-PLATAFORMAS.md`, `docs/CLASIFICACION-HISTORICA.md`, `src/server.js`, `src/api.js`, `src/db/index.js`, todos los módulos en `src/modules/`, todos los adaptadores en `src/adapters/`, `public/index.html`, `public/app.js`, `public/app.css`, el constructor y archivos auxiliares en `carruseles-claude-design/`, scripts y todos los archivos de `test/`.
