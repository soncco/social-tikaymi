# Plan y arquitectura — Tikaymi Marketing Intelligence

Base funcional: `docs/Inicial.MD`. Estado ejecutado: `docs/PROGRESS.md`. Instrucciones para agentes: `CLAUDE.md`.

## Norte del producto

La aplicación no es un generador genérico de publicaciones. Su función es convertir datos reales de contenido en decisiones que puedan producir consultas, cotizaciones y reservas. La IA interviene después de entender el objetivo y el contexto disponible.

El posicionamiento editorial de Tikaymi es boutique y personalizado: Deicy Ayala es la persona que diseña el viaje, conecta la logística y acompaña al pasajero. Las reseñas reales pueden demostrar esa confianza, pero solo se usan con fuente verificable. El contenido debe llevar a una decisión de viaje/compra y conversación por WhatsApp; no se debe llenar el calendario con artículos enciclopédicos de clima, historia o ubicación sin intención comercial.

El ciclo principal es:

```text
Conectar datos → Entender resultados → Planificar semana/mes
→ Aprobar ideas → Crear contenido → Aprobar borradores → Publicar → Registrar consultas
→ Aprender y repetir
```

## Arquitectura de experiencia

La navegación principal tiene cinco áreas:

| Área | Responsabilidad |
|---|---|
| Inicio | Estado, preparación y siguiente mejor acción. |
| Rendimiento | Insights, comparaciones, alertas, cohortes y aprendizajes. |
| Contenido | Publicaciones, clasificación, generación y calendario editorial. |
| Consultas | Leads, estados comerciales, enlaces y atribución. |
| Configuración | Objetivo, fuentes de datos, biblioteca aprobada e IA. |

Funciones técnicas como UTM, importación, modelos LLM y exportación de carrusel no deben competir en la navegación principal. Aparecen dentro del flujo que las necesita.

## Decisiones de UX obligatorias

- Inicio siempre debe explicar qué hacer a continuación.
- “Publicado” y “clasificado” son dimensiones independientes.
- El contenido importado desde estadísticas entra como `publicado`.
- Las publicaciones incompletas se pueden clasificar progresivamente y en grupo.
- Los nombres de implementación (`campaign_code`, LLM, JSON) se traducen a lenguaje de trabajo.
- Toda recomendación muestra evidencia, objetivo, CTA, métrica, limitación y confianza.
- Las ideas del plan conservan evidencia/limitaciones calculadas por el sistema incluso cuando la IA propone el ángulo; no confundir un plan con una publicación o con aprobación del copy.
- La aprobación de contenido sigue siendo humana.
- El diseño debe funcionar en escritorio y móvil sin build frontend.

## Stack

Node.js 20, Express 5, better-sqlite3, cookie firmada y frontend HTML/CSS/JS vanilla. No existe pipeline de build. Tests con `node --test`.

## Arquitectura técnica

- `src/db/`: esquema y migraciones idempotentes.
- `src/adapters/`: normalización independiente por plataforma.
- `src/modules/sync.js` e `importer.js`: entrada de publicaciones y métricas.
- `src/modules/analysis.js`: confianza, rankings y recomendaciones.
- `src/modules/content.js` y `llm.js`: generación restringida a información aprobada.
- `src/modules/attribution.js`: UTM, WhatsApp y códigos.
- `src/modules/abtests.js`, `alerts.js`, `cohorts.js`, `digest.js`: análisis complementario.
- `src/modules/planner.js`: propuesta semanal/mensual por señales de una plataforma a la vez; refinamiento opcional con IA y validación del JSON.
- `src/modules/site.js`: sincronización manual y limitada del sitemap y páginas públicas de Tikaymi.com; copia local con hash, idioma, origen y aprobación editorial.
- `src/modules/editorial-strategy.js`: prioridades comerciales y audiencias editables, reglas de voz fijas; guía activa para planificador y generación.
- `public/`: SPA accesible sin framework.

## Modelo de datos relevante

- `objectives`: objetivo comercial por período.
- `posts`: publicación, contexto de marketing y estado editorial.
- `metrics`: snapshot normalizado; `NULL` significa dato no disponible, nunca cero.
- `leads`: consulta y avance comercial; `post_id` permite atribución.
- `approved_info` y `assets`: fuente de verdad para generación.
- `generated`: contenido generado; siempre nace en revisión.
- `learnings` y `ab_tests`: conocimiento acumulado y experimentos.
- `post_classification_audit`: procedencia y motivo de la clasificación retrospectiva. No convierte una inferencia en un dato observado.
- `editorial_plans` y `plan_ideas`: planes guardados e ideas con fecha, brief, evidencia, límites, confianza y decisión humana. `generated.plan_idea_id` enlaza borradores con ideas aprobadas.
- `site_pages` y `site_syncs`: copia revisable del sitio y auditoría de cada actualización. Cambios retiran aprobación; URLs retiradas se archivan. Ninguna sincronización web modifica `posts`.

No crear una columna de “estado de clasificación”. Se deriva de los campos obligatorios que todavía contienen `sin_clasificar`. Esto evita mezclarla con `posts.estado`.

## Reglas estadísticas que no se deben romper

- Nunca sumar métricas entre plataformas diferentes.
- Nunca convertir `NULL` en cero.
- Nunca declarar ganador por likes.
- No atribuir una consulta sin evidencia.
- Con pocos datos, presentar hipótesis y no conclusiones definitivas.
- Analizar contenido histórico publicado aunque todavía falten metadatos; excluirlo solo de los agrupamientos que requieren esos metadatos.
- Un plan puede proponer hipótesis para TikTok/YouTube Shorts, pero sin datos de esas redes no atribuirles el rendimiento de Meta.
- Las reglas editoriales del manual de contenido de `tikaymi2` son estrategia declarada, no métricas observadas: priorizar el paquete de 5 días como producto visible, adaptar idioma/audiencia, resolver decisiones de planificación y mantener a Deicy como figura de confianza sin inventar prueba social.
- En el plan nuevo se alternan propuestas EN/ES, se reserva un espacio para el producto prioritario, se exige procedencia de la página web local y solo se citan métricas de una publicación claramente relacionada. El plan con IA solo modifica el ángulo y propósito, no audiencia, idioma, CTA, fuente ni evidencia. El copy recibe la guía editorial, pero sus afirmaciones factuales siguen limitadas a fuentes aprobadas.
- Los títulos de la copia local pueden orientar el plan sin aprobación, pero la IA de generación solo puede usar páginas aprobadas y pertinentes al tema. No confundir «sitio público» con «afirmación vigente aprobada».
- Separar idiomas históricos `mixto`/`sin_clasificar` del análisis comparativo `es`/`en`; la generación nueva sigue siendo monolingüe.

## Próximas etapas

### Etapa 1 — paquete coherente y salidas ejecutables (implementada 2026-10-03)

- `content_packages` guarda una revisión versionada con brief, contenido principal, salidas derivadas, fuentes, recursos, pendientes, validaciones y metadatos de proveedor/modelo/reglas.
- `generatePackage()` decide primero el contenido principal y deriva copy/prompts posteriores; los borradores históricos de `generated` se conservan.
- La selección de contexto se limita a información, páginas y recursos aprobados relacionados con la publicación.
- Carruseles nuevos se validan con el esquema real del constructor (3–5 diapositivas, layouts/campos válidos); las importaciones antiguas siguen pasando por la compatibilidad de `export.js`.
- Mejora 2026-10-05: imagen única tiene contrato/exportación independiente; los límites de texto por layout y la revisión geométrica se comparten con el constructor existente. Fotos/testimonios requieren autorización y las piezas visuales un reporte vigente antes de aprobación. Destino de cada copy persistido en `generated.plataforma`. Ver `SINGLE_IMAGE_SPEC.md` para flujo y límites; queda pendiente la prueba visual real en navegador y con proveedor real.
- Guiones y `prompt_flow` validan 3–5 clips, voz/diálogo por clip y duración estimada. Se permite una sola reparación acotada; no hay reintentos ilimitados.
- El proveedor registra presupuesto, modelo, motivo de parada, uso y truncamiento en la respuesta de ejecución; no se persisten claves ni datos personales.

### Etapa 2 — análisis contextualizado (implementada 2026-10-03)

- `analyze()` acepta filtros por período, fechas, plataforma, objetivo, formato, idioma y tema.
- Los rankings globales no eligen ganadores cuando mezclan plataformas; se exponen resultados por plataforma.
- La confianza comercial requiere al menos tres leads atribuidos para llamarse patrón confirmado.
- El planificador conserva evidencia, limitaciones y declara hipótesis cuando faltan comparables o cobertura.
- Los filtros usados para crear un plan se guardan en `editorial_plans.filtros_json` y se reutilizan en el resumen analítico que recibe la generación.

### Etapa 3 — correcciones y seguimiento (implementación inicial 2026-10-04)

- `generated_revisions` conserva versiones y motivo de cada edición; editar devuelve automáticamente el contenido a `revision`.
- `generated_feedback` registra qué segmento falló y por qué.
- Existen endpoints para listar versiones, registrar feedback y editar un borrador. La regeneración acotada usa el segmento y motivo como instrucciones, pero devuelve la pieza completa para revisión.
- `lead_status_history` conserva las transiciones de estado sin perder el estado anterior.
- `approval_events` registra el estado y revisor informado al aprobar/rechazar un borrador.

Implementado adicionalmente: `POST /generated/:id/regenerate` reemplaza solo `slide:N` en carruseles estructurados o `clip:N` en guiones con partes detectables, y conserva el resto; `generated_parts` expone los campos verificables por clip; `metric_snapshots` y sus endpoints conservan copias inmutables de métricas.

Los borradores aprobados pueden registrarse como ejemplos editoriales (`editorial_examples`) para usarlos como referencia futura sin convertir una corrección puntual en regla global.

`generated_publications` vincula una salida aprobada con la publicación real por plataforma; sus métricas y leads quedan consultables mediante `post_id` sin atribuir resultados automáticamente.

Un paquete con varios destinos genera y guarda una salida de copy por cada plataforma, enlazada al mismo paquete y al mismo brief.

Pendiente: automatizar la captura de resultados posteriores y comparar versiones con snapshots en una vista analítica dedicada.

1. Validación visual y de comprensión con una persona usuaria real; probar generación real con el proveedor configurado.
2. Mejorar clasificación asistida para sugerir no solo tema, sino objetivo, audiencia, etapa y CTA.
3. Añadir filtros de período y detalle individual de publicación.
4. Integrar TikTok y YouTube mediante API oficial cuando existan credenciales.
5. Añadir publicación oficial únicamente después de App Review y manteniendo aprobación humana.
