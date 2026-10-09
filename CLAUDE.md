# Contexto de trabajo para Claude Code

Lee este archivo antes de modificar el proyecto. Después lee, en este orden:

1. `docs/Inicial.MD` — contrato de producto y restricciones.
2. `docs/PLAN.md` — arquitectura técnica y de experiencia vigente.
3. `docs/PROGRESS.md` — implementación real y pendientes.
4. `docs/MANUAL.md` — flujo que ve la persona usuaria.
5. `docs/CLASIFICACION-HISTORICA.md` — criterio aplicado a los posts pasados y límites de evidencia.

## Qué es este producto

Tikaymi Marketing Intelligence es una aplicación interna para una agencia de viajes de Cusco. Relaciona contenido publicado con atención, intención y resultados comerciales. No es un generador genérico de posts.

## Posicionamiento editorial que no se debe perder

Tikaymi es una agencia boutique: la confianza se construye alrededor de **Deicy Ayala**, quien diseña itinerarios a medida, coordina la logística y acompaña al viajero antes y durante el viaje. Las reseñas reales que mencionan a Deicy son prueba social; nunca inventar nombres, estrellas, cantidades ni testimonios. La comunicación debe mostrar el servicio personalizado tipo concierge, no competir por precio.

La prioridad comercial declarada es dar visibilidad al paquete de 5 días Cusco–Valle Sagrado–Machu Picchu, sin limitar la oferta: Tikaymi diseña viajes por todo el Perú. Los day trips pueden funcionar como productos de entrada.

No crear contenido enciclopédico independiente sobre clima, historia, geografía o ubicación. Cada idea debe ayudar a una decisión de viaje o compra: comparar opciones, planificar días, resolver logística, prepararse para la altura/equipaje/boletos o elegir una experiencia. El contexto útil se integra a una página o pieza comercial. El CTA preferido es WhatsApp con un mensaje contextual para que la consulta llegue a Deicy.

La promesa de la interfaz es: **mostrar qué ocurre, explicar qué significa y proponer la siguiente acción útil**.

## Norte y ciclo principal

```text
Conectar datos → Entender resultados → Elegir recomendación
→ Crear contenido → Aprobar → Publicar → Registrar consultas
→ Aprender y repetir
```

Antes de añadir una pantalla o enlace a la navegación, identifica en qué paso de este ciclo vive. La navegación principal solo tiene Inicio, Rendimiento, Contenido, Consultas y Configuración.

## Invariantes de negocio

- Nunca sumar métricas de plataformas distintas.
- `NULL` significa dato no disponible; nunca convertirlo automáticamente en cero.
- Nunca declarar éxito o ganador por likes.
- Sin lead atribuido no existe evidencia de conversión.
- Toda conclusión lleva confianza: datos insuficientes, señal inicial, patrón probable o confirmado.
- La IA de generación solo usa `approved_info.autorizado_publicar=1`, páginas `site_pages.approved=1` pertinentes y recursos reales.
- Todo contenido generado nace en `revision` y requiere aprobación humana.
- Una sola lengua por pieza.
- No inventar precios, disponibilidad, horarios, servicios, reseñas, testimonios ni estadísticas.
- No usar «barato», «low cost», clichés turísticos ni superlativos sin respaldo. La confianza se demuestra con detalles operativos verificados y una voz cálida, experta y concreta.

## Distinción crítica: publicación vs. clasificación

`posts.estado` es el estado editorial. Una publicación descargada de Instagram, Facebook o un CSV de estadísticas ya existe públicamente y debe entrar como `publicado`.

La clasificación se deriva de campos que siguen en `sin_clasificar`. Una pieza puede ser `publicado` y estar pendiente de contexto. Participa de inmediato en análisis por plataforma, pero no en comparaciones que requieren tema, objetivo o CTA.

No reviertas esta decisión. `src/db/index.js` contiene la migración idempotente `migration_ux_v2` para datos históricos.

## UX actual

- `public/index.html`: shell, sidebar y acceso.
- `public/app.css`: sistema visual responsive sin dependencias.
- `public/app.js`: SPA con cinco vistas principales y subvistas.
- Inicio calcula el estado de preparación y elige una siguiente acción.
- Contenido permite clasificación parcial masiva mediante `PUT /api/posts/bulk`.
- `Contenido → Planificar contenido` guarda planes/ideas con evidencia, límites, confianza y fecha. `src/modules/planner.js` ofrece propuesta determinista y refinamiento opcional por IA. La IA solo cambia ángulo/brief; jamás evidencia ni confianza. `POST /plans` es async. Los datos se leen sin sumar métricas entre redes.
- `Configuración → Sitio web` usa `src/modules/site.js`: sincronización MANUAL desde `https://tikaymi.com/sitemap.xml`, copia local en `site_pages`, historial en `site_syncs`. La importación inicial real guardó 176/176 URL el 2026-09-21; todas quedaron sin aprobación. No hagas crawling en cada plan ni marques la web como aprobada automáticamente.
- El planificador usa títulos de páginas locales para diversificar ideas y excluir semejanzas fuertes con títulos previos; `source_url` conserva procedencia. La generación solo incluye páginas con `approved=1` y `active=1` relacionadas con el brief. Si cambian, el sync retira aprobación; si desaparecen del sitemap, se archivan. La heurística de novedad no es semántica completa.
- La aprobación web admite una ficha individual (`PUT /site/approve`) o lote (`PUT /site/approve-batch` con `urls` o filtros `kinds`/`languages`). La base real tiene aprobados todos los tours y blogs activos en ES/EN (106); no asumir que otros tipos están aprobados.
- La estrategia editorial está implementada en `src/modules/editorial-strategy.js` y se edita en Configuración → Estrategia editorial (`GET/PUT /api/editorial-strategy`). El plan prioriza el tour de 5 días, alterna ideas EN/ES, muestra razón editorial y separa la prioridad declarada de métricas realmente relacionadas. La IA del plan conserva idioma, audiencia, CTA, evidencia y plataformas. `content.buildPrompt` aplica la guía de voz, pero solo páginas aprobadas aportan hechos para redactar. Cambios de estrategia no alteran planes ya guardados.
- **Anuncio Meta** (`src/modules/ads.js`, tipo `anuncio_meta`): visual + 2–3 variantes de texto para Facebook + Instagram, sin copies orgánicos. El servidor asigna códigos `AD{IDIOMA}{NNN}{A-C}`, mensaje breve de WhatsApp, saludo y URL con UTM; regenerar conserva los códigos. Un precio nuevo requiere importe, moneda, modalidad, unidad, tour aprobado, condiciones y confirmación humana antes de marcar campaña preparada. El precio antiguo libre se conserva sin inferir unidad ni condiciones. La IA no inventa precios. No lanza campañas.
- **Publicidad Meta, actualización 2026-10-09:** lee `docs/META_ADVERTISING.md` antes de cambiar anuncios. `ads.js` ahora distingue Business Suite simplificado (25/300/80 observados) de Ads Manager; precio nuevo estructurado y CTA de cotización. El precio libre antiguo permanece compatible y puede convertirse en Publicidad con nueva revisión humana. `paid.js` guarda campañas, variantes y métricas pagadas; `leads.js` atribuye códigos de anuncio sin post orgánico. La migración idempotente de `open()` registra anuncios antiguos y agrega campos finales faltantes, devolviéndolos a revisión. `Contenido → Publicidad` es el flujo de preparación manual, CSV pagado y exportación JSON. La sincronización Meta existente sigue siendo de publicaciones orgánicas, no Ads Manager. No afirmar que se lanzaron campañas por usar esta vista.
- Una idea debe estar `aprobada` antes de generar. `POST /generate-package` produce copy obligatorio y guion, prompts o carrusel opcional, con inserción atómica; puede usar `plan_idea_id`, `brief` libre o `post_id`. Cada pieza resultante queda en `revision`. Una idea fechada no equivale a publicación programada.
- La clasificación rápida devuelve `selected`, `updated`, `remaining`, `missing_by_field` y `skipped_existing`. Por defecto solo completa campos `NULL`/vacíos/`sin_clasificar`; `overwrite: true` debe ser una decisión explícita del usuario. No interpretes «sigue pendiente» como fallo de persistencia: revisa los campos faltantes.
- `post_classification_audit.manually_modified_at` indica que los valores actuales pueden diferir de la inferencia original.
- `post_classification_audit` registra que 44 piezas se clasificaron retrospectivamente desde Meta. No presentar objetivos inferidos como el brief histórico de Tikaymi.
- `idioma='mixto'` y `idioma='sin_clasificar'` son válidos solo para describir piezas históricas; las publicaciones nuevas y el contenido generado deben ser `es` o `en`.
- Las métricas del análisis son objetos `{ valor, n_total, n_datos, cobertura }`; la UI debe leer `valor`, no tratar el objeto como número.
- Las funciones técnicas deben mantenerse dentro de su flujo: enlaces en Consultas; sincronización, biblioteca y LLM en Configuración; carrusel dentro de generación.

## Stack y comandos

```bash
npm start       # servidor Express; el puerto puede venir de .env
npm test        # suite node:test
node --check public/app.js
```

No hay bundler, TypeScript ni framework frontend. No introduzcas uno sin una decisión explícita: la simplicidad operativa es intencional.

## Datos locales y secretos

- Base: `data/tikaymi.db`.
- Secretos: `.env`, nunca imprimirlos ni versionarlos.
- Meta real está conectado; `npm run meta:renew` reemplaza únicamente la línea del token sin mostrarlo.
- No borres ni reconstruyas la base para probar. Usa `open(':memory:')` en tests.

Estado conocido al 2026-09-21: 25 publicaciones Instagram + 25 Facebook; 49 históricas analizables; 44 con auditoría inicial; seis sin texto recuperable y aún pendientes de `metrica_principal`; 0 leads; biblioteca aprobada vacía. Hubo ediciones masivas posteriores del usuario; no reviertas esos valores sin su consentimiento. Si aparece una respuesta incompleta en Clasificación rápida, comprueba que el servidor se haya reiniciado y no esté sirviendo el API anterior.

El plan editorial puede ofrecer hipótesis sin biblioteca aprobada. `Crear con IA` responde 422 solo si no hay información autorizada ni páginas web aprobadas relacionadas. Las fotos pueden pegarse desde `https://res.cloudinary.com/tikaymi/image/upload/` en la imagen única o el carrusel; al guardar la edición humana se registran como `assets` autorizados, y una URL desmarcada en Biblioteca sigue bloqueada. La IA no puede usar URL de Cloudinary no registradas. La IA de planificación requiere clave activa; la vista previa estadística no. Los pares IG/FB y TikTok/Shorts son destinos sugeridos, no registros `posts` vinculados ni publicación automática. La ventana histórica aún no es configurable.

## Verificación esperada

Toda modificación de lógica debe incluir o actualizar pruebas. Antes de entregar:

1. Ejecuta `node --check public/app.js` si tocaste frontend.
2. Ejecuta `npm test` (los tests HTTP necesitan permiso para abrir puertos locales en algunos sandboxes).
3. Revisa `docs/PROGRESS.md` y `docs/MANUAL.md` si cambió el comportamiento visible.
4. No declares la UI validada visualmente si solo se verificó por código o API.

Los TODO actuales están en `docs/PROGRESS.md` y no deben presentarse como funciones terminadas.
