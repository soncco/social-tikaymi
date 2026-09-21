# Estado actual — Tikaymi Marketing Intelligence

Última actualización: 2026-09-21.

## Estado general

El MVP técnico y el rediseño de experiencia están implementados. El backend conserva las reglas del requerimiento original y la interfaz ahora organiza el producto por tareas, no por tablas o endpoints.

La base real contiene 50 publicaciones de Meta con métricas: 25 de Instagram y 25 de Facebook. Tras la migración UX v2, 49 piezas históricas están como `publicado` y una pieza editorial permanece `aprobado`. El análisis reconoce 49 publicaciones de ambas plataformas. Se clasificaron retrospectivamente 44 piezas desde sus textos completos; seis no tenían texto fiable. Ediciones masivas posteriores completaron más campos; actualmente solo esas seis piezas sin texto siguen pendientes, por `Métrica principal`. La clasificación original se documenta en `docs/CLASIFICACION-HISTORICA.md`.

## Implementado

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
- El plan editorial consulta esa copia local, da prioridad a artículos prácticos y tours y filtra títulos muy similares a publicaciones/planes previos. Muestra la URL fuente. Es una heurística de novedad, no una comprobación semántica completa.
- Respaldo antes de la importación: `data/tikaymi-before-site-cache-2026-09-21.db`. `cheerio` se incorporó para analizar XML/HTML.

### Verificación

- `node --check public/app.js`: correcto.
- Suite completa `npm test`: 88/88 pruebas correctas tras integrar la estrategia; incluye sitemap seguro, sincronización idempotente, API autenticada, retiro de aprobación, archivado de URL, uso local en planes y aislamiento de páginas no aprobadas.
- Pruebas nuevas para estado de publicaciones importadas, clasificación parcial masiva y validaciones.
- Base real abierta con la migración: 49 publicaciones analizables, 2 plataformas y 6 recomendaciones.

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
