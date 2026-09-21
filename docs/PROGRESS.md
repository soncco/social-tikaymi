# Estado actual — Tikaymi Marketing Intelligence

Última actualización: 2026-09-21.

## Estado general

El MVP técnico y el rediseño de experiencia están implementados. El backend conserva las reglas del requerimiento original y la interfaz ahora organiza el producto por tareas, no por tablas o endpoints.

La base real contiene 50 publicaciones de Meta con métricas: 25 de Instagram y 25 de Facebook. Tras la migración UX v2, 49 piezas históricas están como `publicado` y una pieza editorial permanece `aprobado`. El análisis reconoce 49 publicaciones de ambas plataformas. Se clasificaron retrospectivamente 44 piezas desde sus textos completos; quedan seis sin texto fiable y tres sin CTA explícito. La clasificación se documenta en `docs/CLASIFICACION-HISTORICA.md`.

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

### Verificación

- `node --check public/app.js`: correcto.
- Suite completa: 74/74 pruebas correctas (2026-09-21).
- Pruebas nuevas para estado de publicaciones importadas, clasificación parcial masiva y validaciones.
- Base real abierta con la migración: 49 publicaciones analizables, 2 plataformas y 6 recomendaciones.

## Pendientes del usuario o de servicios externos

- Revisar las nueve piezas pendientes de **Contenido → Publicaciones**: seis carecen de texto recuperable y tres no tienen CTA explícito. El detalle está en `docs/CLASIFICACION-HISTORICA.md`.
- Registrar leads reales con código de campaña; actualmente no hay datos de conversión.
- Cargar servicios, precios, testimonios, fotos y videos en **Configuración → Biblioteca aprobada**.
- Confirmar una clave de IA válida y probar una generación real; las integraciones se probaron con `fetch` simulado.
- Validar los adaptadores TikTok y YouTube con exportaciones reales.
- Renovar el token Meta antes del 2026-12-20 o migrar a usuario del sistema.

## Pendientes de producto

- Sesión de prueba visual y de comprensión en navegadores reales; hasta ahora se verificaron sintaxis, API, datos y responsive por código.
- Clasificación asistida de objetivo, audiencia, etapa y CTA. La sugerencia actual solo identifica algunos destinos por título.
- Filtros de período y una vista de detalle por publicación.
- Conectores oficiales de lectura para TikTok/YouTube.
- Publicación oficial en redes, condicionada a permisos y App Review.

## No hacer sin una decisión explícita

- No volver a mostrar cada módulo técnico como pestaña principal.
- No marcar contenido histórico como borrador por estar sin clasificar.
- No generar contenido desde una recomendación sin objetivo, audiencia, CTA, métrica, plataforma e idioma.
- No afirmar conversión hasta tener leads atribuidos.
- No mezclar métricas de plataformas ni usar likes como indicador de negocio.
