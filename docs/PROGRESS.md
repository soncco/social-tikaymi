# Estado actual — Tikaymi Marketing Intelligence

Última actualización: 2026-10-05.

## Estado general

El MVP técnico y el rediseño de experiencia están implementados. El backend conserva las reglas del requerimiento original y la interfaz ahora organiza el producto por tareas, no por tablas o endpoints.

La base real contiene 50 publicaciones de Meta con métricas: 25 de Instagram y 25 de Facebook. Tras la migración UX v2, 49 piezas históricas están como `publicado` y una pieza editorial permanece `aprobado`. El análisis reconoce 49 publicaciones de ambas plataformas. Se clasificaron retrospectivamente 44 piezas desde sus textos completos; seis no tenían texto fiable. Ediciones masivas posteriores completaron más campos; actualmente solo esas seis piezas sin texto siguen pendientes, por `Métrica principal`. La clasificación original se documenta en `docs/CLASIFICACION-HISTORICA.md`.

## Implementado

### Copy publicable, contacto y plantillas de imagen única (2026-10-05, segunda entrega)

- El copy ya no lleva `[FALTA DATO: …]` dentro del texto. La IA escribe los faltantes después de `---PENDIENTES---`; el servidor los separa y los guarda en `generated.pending_json` (migración idempotente). Las líneas que solo contienen un marcador se retiran del texto. Un marcador dentro de una frase se conserva y **bloquea la aprobación** del copy (422) hasta corregirlo.
- Borradores generados muestra **Datos que faltan** con el camino para resolverlos, y un botón **Editar texto** para copy, guion y prompts (usa `PUT /generated/:id/edit`; vuelve a revisión y versiona). Regenerar un copy actualiza sus pendientes.
- Hashtags: `sanitizeCopy` borraba el `#` de cualquier línea que empezaba con `#` (lo trataba como encabezado Markdown), por eso `#Cusco` salía como `Cusco`. Ahora solo quita encabezados con espacio (`## Título`). Cada plataforma pide su línea final de hashtags (IG 4–6, FB 2–3, TikTok 3–5, Shorts 2–3).
- Contacto: **Estrategia editorial** admite un WhatsApp opcional con código de país. Si existe, el servidor añade una línea `📲 WhatsApp … · wa.me/…` antes de los hashtags cuando la IA no lo incluyó. Sin número, el copy no muestra ningún número y aparece como dato pendiente. El número nunca lo propone la IA.
- Logística: el copy incluye una línea práctica (cómo llegar, recojo, traslado, salida o duración) solo si la información aprobada la respalda.
- Imagen única: el renderer usa las plantillas del constructor (producto = portada con foto a sangre, informativo = portada editorial, testimonio = cita), con el logo, la cresta, la escala tipográfica y el marcador de foto pendiente del constructor, más `tikaymi.com` en el pie. Las etiquetas siguen el idioma de la pieza. El editor muestra **Datos que faltan** fuera del desplegable.
- `validateRender` ya no marca como cortado el texto display que desborda su línea sin recorte (Cormorant con `line-height` ≤ 1). Sigue detectando texto fuera del lienzo, recortado por un contenedor o encima del logo. Afecta también al constructor de carruseles, que comparte el validador.
- Verificación: `npm test` 123/123. El fixture `test/visual-render.html` se ejecutó en Chromium headless (Playwright): producto, informativo, testimonio y detección de desbordamiento en PASS; se revisaron capturas de las tres variantes. Sigue sin verificarse una descarga PNG real con html2canvas y una foto autorizada con CORS, y una generación con el proveedor real.
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
- Revisar las fichas relevantes en **Configuración → Sitio web** y aprobar solo información vigente para redactar. Cargar en **Biblioteca aprobada** los servicios, precios, testimonios, fotos y videos adicionales.
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
