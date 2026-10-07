# Estado actual — Tikaymi Marketing Intelligence

Última actualización: 2026-10-05.

## Estado general

El MVP técnico y el rediseño de experiencia están implementados. El backend conserva las reglas del requerimiento original y la interfaz ahora organiza el producto por tareas, no por tablas o endpoints.

La base real contiene 50 publicaciones de Meta con métricas: 25 de Instagram y 25 de Facebook. Tras la migración UX v2, 49 piezas históricas están como `publicado` y una pieza editorial permanece `aprobado`. El análisis reconoce 49 publicaciones de ambas plataformas. Se clasificaron retrospectivamente 44 piezas desde sus textos completos; seis no tenían texto fiable. Ediciones masivas posteriores completaron más campos; actualmente solo esas seis piezas sin texto siguen pendientes, por `Métrica principal`. La clasificación original se documenta en `docs/CLASIFICACION-HISTORICA.md`.

## Implementado

### Anuncio Meta desde un tour (2026-10-06)

- Nuevo tipo `anuncio_meta` (`src/modules/ads.js`) y formato **Anuncio Meta** en Crear con IA: `generatePackage({ extra:'anuncio_meta', ad_visual:'imagen_unica'|'carrusel' })` genera la pieza visual y, derivados de ella, 2–3 textos de anuncio. No se generan copies orgánicos. Plataforma del visual: Instagram o Facebook (TikTok/Shorts se sustituyen por Instagram); la fila del anuncio guarda `plataforma=NULL` y el JSON declara `ubicaciones: facebook + instagram`.
- La IA redacta ángulo, gancho (≤125), cuerpo (aviso sobre 350, bloquea sobre 600; caso real de 373 caracteres bloqueaba el paquete), título (≤40) y descripción (≤30). El servidor añade `codigo_base` (`AD{IDIOMA}{NNN}`, siguiente libre), `campaign_code` por variante (`…A/B/C`), botón, mensaje predeterminado de WhatsApp con el código y URL del tour con `utm_source=meta&utm_medium=paid_social&utm_campaign=<base>&utm_content=<variante>`.
- Tour de destino: `source_url` del brief si es un tour aprobado; si no, el tour aprobado más relacionado en el idioma; sin tour queda como dato pendiente. `packageBrief` conserva ahora `source_url` para regenerar.
- Validación determinista: límites, variantes con ganchos distintos, sin «barato/low cost/cheap/mejor precio», sin urgencia, hashtags ni URL en el texto, y toda cifra con moneda debe aparecer en las fuentes aprobadas (comparación de dígitos: es una heurística, no prueba que el precio siga vigente). Una corrección automática; luego `failed_visual_reviews`. La aprobación bloquea `[FALTA DATO]` en los textos.
- Regenerar un anuncio conserva `codigo_base` para no romper la atribución de leads ya registrados.
- UI: selector de tours aprobados en el brief, vista legible por variante con contador y **Copiar** por campo, edición del JSON con **Editar texto** y filtro por tipo.
- Pendiente: medidas 9:16 para Stories/Reels (la imagen única exporta 1080 × 1350), separar resultados pagados de orgánicos al importar métricas de anuncios, y lectura de Ads Manager.
- Verificación: `npm test` 130/130 (`test/ads.test.js` con proveedor ficticio). No se probó con el proveedor de IA real ni se revisó la pantalla en navegador.

### Fotos desde Cloudinary sin cargar Biblioteca (2026-10-06)

- La imagen única y el constructor de carruseles aceptan URL pegadas de `https://res.cloudinary.com/tikaymi/image/upload/…` sin registrarlas antes. `/image/fetch/` (reenvía URL externas), otras cuentas y `http:` se rechazan (`public/visual-contract.js`: `isCloudinaryPhoto`, `photoAllowed`).
- Al guardar la edición humana (`PUT /generated/:id/edit`), `revisions.edit` registra esas URL en `assets` como foto autorizada con descripción `Cloudinary · pegada en borrador #N` y devuelve `fotos_registradas`. Una URL ya existente no se modifica: desmarcarla en Biblioteca la bloquea aunque se vuelva a pegar.
- La aprobación sigue exigiendo una foto registrada y autorizada; la validación de lo que produce la IA no acepta URL de Cloudinary no registradas, así la IA no puede inventarlas.
- La Biblioteca queda opcional para fotos; sigue siendo la única fuente de testimonios y de datos que no estén en páginas aprobadas. Generar texto ya no depende de ella si hay páginas web aprobadas relacionadas.
- Verificación: `npm test` 125/125, con pruebas para imagen única, carrusel, cuentas ajenas, `fetch` y fotos retiradas. Se comprobó con `curl` que `res.cloudinary.com/tikaymi` responde con `access-control-allow-origin: *`. No se probó en navegador la exportación PNG con una foto real de Cloudinary.

### Copy publicable, contacto y plantillas de imagen única (2026-10-05, segunda entrega)

- El copy ya no lleva `[FALTA DATO: …]` dentro del texto. La IA escribe los faltantes después de `---PENDIENTES---`; el servidor los separa y los guarda en `generated.pending_json` (migración idempotente). Las líneas que solo contienen un marcador se retiran del texto. Un marcador dentro de una frase se conserva y **bloquea la aprobación** del copy (422) hasta corregirlo.
- UX de listados (2026-10-07): Planificar contenido usa lista lateral de planes (`GET /plans` devuelve `ideas_total/aprobadas/propuestas/descartadas` vía `planner.list`) y filas de idea compactas con filtro por estado y acciones rápidas. Borradores generados agrupa por origen con `origen` y `origen_titulo` (`content.list`, join con idea/publicación/paquete), chips de estado con conteo y filtros de tipo/plataforma/idioma que se conservan tras cada acción. No validado visualmente en navegador.
- Borradores generados muestra **Datos que faltan** con el camino para resolverlos, y un botón **Editar texto** para copy, guion y prompts (usa `PUT /generated/:id/edit`; vuelve a revisión y versiona). Regenerar un copy actualiza sus pendientes.
- Hashtags: `sanitizeCopy` borraba el `#` de cualquier línea que empezaba con `#` (lo trataba como encabezado Markdown), por eso `#Cusco` salía como `Cusco`. Ahora solo quita encabezados con espacio (`## Título`). Cada plataforma pide su línea final de hashtags (IG 4–6, FB 2–3, TikTok 3–5, Shorts 2–3).
- Contacto: **Estrategia editorial** admite un WhatsApp opcional con código de país. Si existe, el servidor añade una línea `📲 WhatsApp … · wa.me/…` antes de los hashtags cuando la IA no lo incluyó. Sin número, el copy no muestra ningún número y aparece como dato pendiente. El número nunca lo propone la IA.
- Logística: el copy incluye una línea práctica (cómo llegar, recojo, traslado, salida o duración) solo si la información aprobada la respalda.
- Imagen única: el renderer usa las plantillas del constructor (producto = portada con foto a sangre, informativo = portada editorial, testimonio = cita), con el logo, la cresta, la escala tipográfica y el marcador de foto pendiente del constructor, más `tikaymi.com` en el pie. Las etiquetas siguen el idioma de la pieza. El editor muestra **Datos que faltan** fuera del desplegable.
- `validateRender` ya no marca como cortado el texto display que desborda su línea sin recorte (Cormorant con `line-height` ≤ 1). Sigue detectando texto fuera del lienzo, recortado por un contenedor o encima del logo. Afecta también al constructor de carruseles, que comparte el validador.
- Verificación: `npm test` 123/123. El fixture `test/visual-render.html` se ejecutó en Chromium headless (Playwright): producto, informativo, testimonio y detección de desbordamiento en PASS; se revisaron capturas de las tres variantes. Sigue sin verificarse una descarga PNG real con html2canvas y una foto autorizada con CORS, y una generación con el proveedor real.
- La línea verde decorativa («cresta») ahora reproduce la montaña del logo (pico menor, pico mayor y su pliegue), a 190 × 76 px y trazo 6, en el constructor, la imagen única y los tres carruseles de referencia. Antes era un zigzag de 200 × 26 px que no se reconocía.
- Datos existentes: los copies #13 y #14 se generaron antes del cambio y conservan los marcadores en el texto; #14 ya estaba aprobado. No se modificaron.

### Imagen única y composición móvil (2026-10-05)

- Crear con IA permite imagen única, carrusel, reel/video o solo copy. Imagen única tiene contrato propio y tres variantes: producto, informativo y testimonio; produce un PNG individual.
- Los recursos visuales requieren autorización explícita en Biblioteca. Los registros anteriores no se autorizan por migración.
- Límites compartidos por layout en `public/visual-contract.js`; validación previa, una corrección acotada y registro de revisiones fallidas. Cada copy recibe una sola plataforma y sus instrucciones.
- `generated.plataforma` conserva el destino de cada salida nueva. Los históricos quedan con `NULL` si no se conoce su destino; no se infiere. La interfaz identifica la red de cada copy y la regeneración la conserva.
- Revisión adicional: `generate()` y `resolvePost()` trabajan con una copia del brief recibido. Generar copies multired no modifica la plataforma principal ni los destinos del paquete; reparar imagen única conserva `platform_override`. La regresión se reprodujo antes de la corrección.
- El renderer de imagen única permite elegir una foto autorizada; el constructor existente permite guardar cambios en Lab. Las ediciones vuelven a revisión. Las sugerencias exploratorias de formato consultan estadísticas filtradas y no cambian la elección humana.
- Revisión del render en navegador: detecta desbordamiento/corte y cruces con zonas protegidas. Aprobar una pieza visual requiere un reporte vigente del contenido exacto. Un marcador fotográfico bloquea la salida final.
- Especificación y uso: `docs/SINGLE_IMAGE_SPEC.md`. Pruebas de backend con proveedores ficticios; exportación depende de CORS y html2canvas.
- Verificación de esta entrega, incluida revisión adicional: 34/34 pruebas relacionadas y 119/119 en `npm test` fuera del sandbox (las pruebas HTTP abren puertos temporales). Sintaxis backend/frontend/scripts HTML y `git diff --check`: correctos. La prueba visual real quedó pendiente por errores gráficos/timeout del navegador; no se verificó una descarga PNG real ni el proveedor real. No se abrió la base de producción ni se modificaron claves o configuración sensible.

### Núcleo y datos

- SQLite, cookie firmada y API de objetivos, publicaciones, leads y aprendizajes.
- Adaptadores separados para Meta, TikTok y YouTube; CSV en las tres familias.
- Sincronización real de Instagram y Facebook, solo lectura, con control de frecuencia y expiración de token.
- Atribución por código de campaña, UTM y palabra clave de WhatsApp.
- Análisis que separa atención, intención y negocio; respeta `NULL`, plataforma y confianza.
- Alertas, cohortes, digest semanal, pruebas A/B e iCal para programación manual.
- Generación mediante Anthropic, OpenAI o DeepSeek, restringida a información autorizada y con aprobación humana.

### Rediseño UX v2

- Navegación reducida de doce pestañas a cinco áreas: Inicio, Rendimiento, Contenido, Consultas y Configuración.
- Inicio con explicación del producto, indicadores, estado de preparación y siguiente mejor acción.
- Rendimiento con valores de métricas correctamente extraídos desde `{ valor, cobertura, ... }`.
- Publicaciones sincronizadas o importadas entran como `publicado`; la clasificación pendiente ya no las convierte en borradores.
- Migración idempotente `migration_ux_v2` corrige registros históricos externos con métricas sin tocar borradores humanos.
- Clasificación masiva y progresiva mediante `PUT /api/posts/bulk`.
- Generación, calendario y publicaciones reunidos en Contenido.
- Leads y enlaces rastreables reunidos en Consultas.
- Objetivo, datos, biblioteca e IA reunidos en Configuración.
- Edición manual de JSON eliminada del flujo principal; carruseles aprobados se descargan desde su borrador generado.
- Diseño responsive con sidebar de escritorio y menú móvil.
- Lenguaje orientado a tareas y estados, con detalles técnicos relegados a configuración.
- Clasificación editorial retrospectiva de 44 publicaciones, con auditoría por pieza (`post_classification_audit`) y respaldo SQLite previo.
- Doce piezas bilingües etiquetadas `mixto`; seis publicaciones sin texto con idioma `sin_clasificar`, para no contaminar comparaciones de idiomas.
- La UI identifica las clasificaciones inferidas y muestra su justificación al editar.
- Clasificación rápida: ahora informa cuántas seleccionadas se modificaron, cuáles siguen pendientes y exactamente qué campos faltan. Por defecto solo completa valores vacíos; sobrescribir valores existentes requiere marcar una opción explícita. Las ediciones posteriores quedan señaladas en la auditoría.
- Compatibilidad: la UI recalcula el resultado del guardado desde los datos recién leídos y detecta un servidor antiguo para desactivar la clasificación masiva hasta reiniciarlo. Evita avisos falsos como `undefined` y sobrescrituras de la versión anterior.

### Plan editorial y generación

- La estrategia editorial del manual de Tikaymi ya está activa en `src/modules/editorial-strategy.js` y visible en **Configuración → Estrategia editorial**. El plan usa la prioridad declarada del tour de 5 días, alterna inglés principal y español secundario, enfoca preguntas de decisión/logística y redacta CTA contextual hacia Deicy. La configuración permite ajustar producto, URL, audiencias y contacto sin tocar código; las reglas de voz y de no inventar prueba social permanecen fijas.
- Las ideas muestran una razón editorial y separan explícitamente tres cosas: prioridad comercial declarada, tema hallado en la copia local del sitio y métricas de una publicación solo cuando el título está claramente relacionado. Sin coincidencia se indica hipótesis, no rendimiento probado. La idea del producto prioritario ya no toma prestada una página web no relacionada.
- El plan con IA recibe la misma guía editorial y únicamente texto web aprobado y relacionado; no puede reemplazar la audiencia, el CTA, el idioma, las plataformas ni la evidencia calculados. La generación de copy también recibe las reglas editoriales y conserva el idioma de la idea aprobada.
- El prompt de carruseles documenta el contrato real del constructor: variantes de portada, ficha con `meta`, itinerario con un objeto por día, galería de 2–3 fotos, testimonio, antes/después, incluido, bueno-saberlo, cierre y layouts informativos (`cifras`, `pasos`, `columnas`, `qa-panel`). Exige campos específicos por layout y URLs de imágenes solo desde Recursos disponibles.
- `guion` y `prompt_flow` incorporan el módulo de guiones para videos cortos: clips Flow de 10 s, 3–5 clips, audio no silencioso, tabla/prompts A–F, asignación de fotografías y Killa opcional con estructuras variables. No se inventa la identidad, voz o apariencia de Killa ni se usa siempre en apertura/cierre.
- Los fallos de validación del plan con IA ahora indican idea y causa concreta y escriben un diagnóstico seguro en la consola del servidor; no hay logging persistente de prompts o respuestas.
- **Planificar contenido** ofrece 3 ideas para una semana u 8 para un mes, con fecha editable. Usa señales de intención de publicaciones reales dentro de una misma plataforma y muestra evidencia, confianza y límites; sin datos de TikTok/YouTube propone hipótesis explícitas.
- Inicio ahora dirige a crear/revisar el plan cuando ya hay datos, antes de saltar directamente a generar piezas aisladas.
- Hay una propuesta determinista que funciona sin clave, y un botón opcional de IA que recibe evidencia acotada e información aprobada. La IA solo puede modificar ángulo y brief; evidencia, destinos, límites y confianza permanecen calculados por el sistema. Respuesta inválida no guarda un plan.
- Los planes e ideas se guardan en `editorial_plans` y `plan_ideas`. La persona edita/aprueba/descarta ideas antes de generar. Calendario muestra ideas fechadas del plan más reciente; no son publicaciones programadas.
- **Crear con IA** admite idea aprobada, brief nuevo sin post previo o post de referencia opcional. Todo paquete contiene copy y puede añadir guion, prompts de video o carrusel; si falla un complemento, no se guarda un paquete parcial. El contenido siempre nace en revisión y requiere biblioteca aprobada.
- Una idea puede indicar Instagram + Facebook o TikTok + YouTube Shorts; todavía no crea automáticamente un `posts` por plataforma ni publica en redes. La medición sigue separada por red.

### Copia local del sitio web

- `Configuración → Sitio web` muestra las fichas descargadas y un botón **Actualizar desde Tikaymi.com**. La actualización es manual: el planificador y la generación leen SQLite, no consultan la web en cada uso.
- Se importó el sitemap público el 2026-09-21: 176 URL encontradas, 176 descargadas, 0 fallidas; 88 páginas en español y 88 en inglés. La extracción guarda título, descripción, texto relevante, URL, tipo, hash y fecha.
- Las 176 fichas quedaron inicialmente **sin aprobación**. El usuario puede revisar y aprobar cada una para generación. Si el texto cambia, se retira la aprobación; si la URL sale del sitemap, se archiva sin borrar el registro. Un fallo de descarga preserva la copia anterior.
- Se agregó aprobación por lote para URLs seleccionadas y para filtros de tipo/idioma. En la base real se aprobaron 106 fichas activas: todos los tours y blogs en español e inglés; eventos, destinos e institucionales permanecen sin aprobar para revisión posterior.
- El plan editorial consulta esa copia local, da prioridad a artículos prácticos y tours y filtra títulos muy similares a publicaciones/planes previos. Muestra la URL fuente. Es una heurística de novedad, no una comprobación semántica completa.
- Respaldo antes de la importación: `data/tikaymi-before-site-cache-2026-09-21.db`. `cheerio` se incorporó para analizar XML/HTML.

### Verificación

- `node --check public/app.js`: correcto.
- **Snapshot histórico de verificación:** una ejecución anterior registró 88 pruebas correctas. En la revisión del 2026-10-03, `npm test` ejecutó 95 subpruebas: 88 pasaron y 7 fallaron al intentar abrir un puerto (`listen EPERM`) en el entorno restringido. Repetir en un entorno con sockets permitidos antes de afirmar que la suite está completamente correcta.
- Pruebas nuevas para estado de publicaciones importadas, clasificación parcial masiva y validaciones.
- Base real abierta con la migración: 49 publicaciones analizables, 2 plataformas y 6 recomendaciones.

### Revisión técnica 2026-10-04

- `generatePackage()` conserva los filtros del plan (`editorial_plans.filtros_json`) al construir el resumen analítico del prompt.
- La regeneración usa indexación humana: `slide:1` es la primera diapositiva. Las ideas sin `post_id` reenvían `plan_idea_id` para resolver su brief.
- La importación CSV y la sincronización Meta crean snapshots de métricas solo cuando cambia el JSON observado; las repeticiones no duplican snapshots.
- La clasificación histórica distingue contexto mínimo de análisis (resultado comercial, audiencia e idioma) de metadata editorial avanzada. La pantalla ya no bloquea por CTA, etapa, propósito, objetivo de marketing o métrica; esos campos siguen disponibles como enriquecimiento opcional.
- Un paquete con varios destinos genera una salida de copy por plataforma y las guarda como filas `generated` relacionadas con el mismo paquete.
- DeepSeek con modelos de razonamiento que devuelven `content` vacío ahora tiene una única recuperación con presupuesto ampliado; nunca se guarda `reasoning_content` como copy o JSON.
- La API y la vista de borradores exponen versiones, feedback, partes de guion, regeneración, aprobaciones, ejemplos editoriales, snapshots y publicaciones vinculadas. La regeneración solicita explícitamente `slide:N`, `clip:N` o pieza completa.
- En esta revisión `npm test` ejecuta 105 pruebas: 98 pasan y 7 fallan exclusivamente al abrir servidores HTTP (`listen EPERM`) en el entorno restringido. Los tests unitarios de contenido, planner, análisis, importación/snapshots y revisiones pasan. `node --check` pasa para backend y frontend.

## Pendientes del usuario o de servicios externos

- Revisar las seis piezas `Sin título` pendientes de **Contenido → Publicaciones**. Les falta `Métrica principal` y Meta no devolvió texto para inferirla; no conviene rellenarla por suposición. El detalle del criterio inicial está en `docs/CLASIFICACION-HISTORICA.md`.
- Registrar leads reales con código de campaña; actualmente no hay datos de conversión.
- Revisar las fichas relevantes en **Configuración → Sitio web** y aprobar solo información vigente para redactar. Cargar en **Biblioteca aprobada** testimonios reales y datos que no estén en la web; las fotos se pegan desde Cloudinary al revisar cada pieza.
- Confirmar una clave de IA válida y probar una generación real; las integraciones se probaron con `fetch` simulado.
- Validar los adaptadores TikTok y YouTube con exportaciones reales.
- Renovar el token Meta antes del 2026-12-20 o migrar a usuario del sistema.

## Pendientes de producto

- Sesión de prueba visual y de comprensión en navegadores reales; hasta ahora se verificaron sintaxis, API, datos y responsive por código.
- Clasificación asistida de objetivo, audiencia, etapa y CTA. La sugerencia actual solo identifica algunos destinos por título.
- Filtros de período y una vista de detalle por publicación.
- Elegir la ventana histórica de análisis del plan (hoy usa todas las publicaciones analizables), materializar una idea aprobada como publicaciones vinculadas por plataforma y conectar los borradores aprobados con fechas programadas.
- Mejorar la detección semántica de temas repetidos y ofrecer exclusiones/editorialización por tipo de página. El filtro actual compara títulos normalizados.
- Conectores oficiales de lectura para TikTok/YouTube.
- Publicación oficial en redes, condicionada a permisos y App Review.

## No hacer sin una decisión explícita

- No volver a mostrar cada módulo técnico como pestaña principal.
- No marcar contenido histórico como borrador por estar sin clasificar.
- No generar contenido desde una recomendación sin objetivo, audiencia, CTA, métrica, plataforma e idioma.
- No afirmar conversión hasta tener leads atribuidos.
- No mezclar métricas de plataformas ni usar likes como indicador de negocio.
