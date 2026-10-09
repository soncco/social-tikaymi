# Manual de uso — Tikaymi Marketing Intelligence

## Qué hace la aplicación

Tikaymi Marketing Intelligence ayuda a responder tres preguntas:

1. ¿Qué está pasando con nuestro contenido?
2. ¿Qué evidencia tenemos sobre intención o resultados comerciales?
3. ¿Cuál es la siguiente acción útil?

No es principalmente un generador de publicaciones. La generación aparece dentro del flujo de contenido y solo utiliza información autorizada.

### Criterio editorial de Tikaymi

Tikaymi comunica una agencia boutique de viajes personalizados. Deicy Ayala es la travel designer y el punto humano de confianza: planifica itinerarios, resuelve la logística y acompaña al viajero. Las reseñas reales pueden respaldar esa promesa únicamente cuando están disponibles y autorizadas; no se deben fabricar testimonios ni cifras de estrellas.

El planificador debe favorecer contenido que ayude a elegir o preparar un viaje —comparativas, itinerarios, boletos, trenes, altura, equipaje y logística— y evitar piezas enciclopédicas independientes sobre historia, clima, geografía o ubicación. El paquete Cusco–Valle Sagrado–Machu Picchu de 5 días es una prioridad editorial declarada, aunque la oferta abarca todo el Perú. El CTA recomendado es una conversación contextual por WhatsApp con Deicy.

## Primer ingreso

La pantalla **Inicio** muestra el estado de preparación y una única “siguiente mejor acción”. Para una instalación nueva, el orden recomendado es:

1. **Configuración → Objetivo del período:** define el resultado comercial y una meta.
2. **Configuración → Fuentes de datos:** sincroniza Meta o importa un CSV.
3. **Rendimiento:** revisa recomendaciones, comparaciones y los límites de los datos.
4. **Configuración → Estrategia editorial:** confirma producto prioritario, URL, audiencias, persona de contacto y el WhatsApp con código de país. Sin el número, los copies no muestran forma de contacto.
5. **Contenido → Planificar contenido:** elige semana o mes, revisa la razón editorial, fuente web, señales y límites de cada idea, y aprueba las que quieras trabajar.
6. **Contenido → Publicaciones:** clasifica las piezas importadas que aún necesiten contexto.
7. **Configuración → Sitio web:** revisa la copia local de tours, blog y otras páginas; aprueba únicamente las que quieras usar como fuente de redacción.
8. **Consultas → Enlaces y rastreo:** crea códigos o enlaces diferentes para reconocer el origen de cada consulta.
9. **Consultas → Consultas y estados:** registra contactos y actualízalos hasta cotizado, reservado o perdido.
10. **Configuración → Biblioteca aprobada (opcional):** carga testimonios reales, precios o condiciones que no estén en las páginas aprobadas. Las fotos no necesitan cargarse antes: se pegan desde Cloudinary al revisar la pieza. Cada ficha y cada foto tiene **Editar** (tipo, título, contenido, fuente; o descripción y destino de la foto, con miniatura) y una casilla rápida de autorización. La URL de una foto no se edita: agrega la nueva y retira la anterior.
11. **Contenido → Crear con IA:** elige el formato: imagen única, carrusel, reel/video o solo copy. No necesitas una publicación previa. El propósito (producto, informativo o confianza) es independiente del formato.

### Revisar imágenes y carruseles

En **Contenido → Crear con IA**, elige el formato y genera el borrador. Al elegir **Anuncio Meta** aparece **Precio a mostrar (opcional)**: escríbelo solo si Tikaymi lo confirmó (ej. «Desde USD 890 por persona»). Se muestra como etiqueta en la imagen única o en la fila Precio de la ficha del carrusel, y la IA puede citarlo literal en los textos. Vacío equivale a «a consultar». En el anuncio abierto verás el resumen (objetivo, ubicaciones, botón, precio) y una pestaña por variante. «Datos que la IA no encontró» es informativo y no bloquea la aprobación. En **Borradores generados**, despliega la fila de la pieza: el botón **Revisar y descargar PNG** está junto a Aprobar/Rechazar. Dentro del editor carga/revisa el borrador. Si hay **Datos que faltan**, la descarga queda bloqueada: cada dato tiene el botón **La imagen no lo afirma · retirar**, que pide confirmación y guarda la corrección (queda en el historial). Después pulsa **Descargar PNG individual**. Para carruseles, usa **Revisar y exportar carrusel**. Cada plataforma tiene un copy separado.

En `carruseles-claude-design/Tikaymi - Constructor de Carruseles.html`, el primer selector **Formato** permite elegir **Carrusel de varias diapositivas** o **Imagen única · un PNG**. La segunda opción muestra **Abrir editor de imagen única**; es un editor independiente, no un layout ni una diapositiva del carrusel. El enlace del encabezado también lleva a ese editor.

La imagen única exporta un PNG individual y permite pegar la URL de una foto de Cloudinary (`https://res.cloudinary.com/tikaymi/image/upload/…`) o escoger una ya registrada en la Biblioteca. Pegarla y guardar es la autorización humana: la foto queda registrada como autorizada en **Configuración → Biblioteca**. Si allí la desmarcas, deja de poder usarse. Otras direcciones deben registrarse y autorizarse antes en la Biblioteca. Para Stories o anuncios puedes pedir un recorte añadiendo `c_fill,ar_4:5,g_auto/` (o `ar_9:16`) después de `upload/`. El constructor de carruseles acepta las mismas URL en sus campos de foto. Usa las plantillas del constructor de carruseles: producto como portada con foto a sangre, informativo como portada editorial y testimonio como cita. El carrusel usa el constructor existente y permite **Guardar cambios en Lab y revisar**. Ambos comprueban texto, cortes y zonas del pie; las fotos pendientes y los errores impiden la descarga final y la aprobación en Lab. Si el texto no cabe se intenta acortarlo una vez y queda pendiente si todavía falla. No reduzcas la fuente para forzarlo. Tras editar, vuelve a revisar la composición. La aprobación humana permanece obligatoria. La verificación de un PNG real en navegador queda pendiente en esta entrega; ver `SINGLE_IMAGE_SPEC.md`.

## Las cinco áreas

### Inicio

Resume publicaciones analizadas, consultas, cotizaciones y reservas. El estado de preparación explica qué falta, y la siguiente acción lleva directamente a la pantalla apropiada.
Cuando ya hay estadísticas, Inicio propone crear o revisar el plan antes de generar contenido.

### Rendimiento

- **Resumen e insights:** recomendaciones con dato de origen, objetivo, CTA, métrica de éxito, limitaciones y confianza.
- **Comparaciones:** resultados por plataforma, formato, idioma, tema y CTA. Las barras usan el valor normalizado y muestran cobertura cuando existe.
- **Alertas y aprendizaje:** problemas de calidad de datos, cohortes y registro de aprendizajes.

Las métricas de plataformas distintas nunca se suman. Los likes no deciden qué publicación es mejor.

### Contenido

- **Planificar contenido:** prepara 3 ideas semanales u 8 mensuales. La vista previa funciona sin clave de IA: combina estrategia declarada, copia local de la web y métricas relacionadas cuando existen. «Analizar y proponer con IA» requiere el proveedor configurado. Cada idea muestra idioma, motivo editorial, fuente, evidencia, confianza y límites. A la izquierda está la lista de planes guardados con el conteo de ideas aprobadas, por revisar y descartadas; el formulario de nuevo plan queda plegado en «+ Nuevo». Las ideas se muestran como filas compactas filtrables (Activas, Propuestas, Aprobadas, Descartadas, Todas); desde la fila puedes aprobar, descartar, restaurar o crear contenido, y al desplegarla ves evidencia y límites y editas título, fecha, audiencia, objetivo de marketing y CTA. «Guardar ajustes» devuelve la idea a propuesta. El enlace «N borradores» abre Crear con IA filtrado por esa idea. Aprobar una idea no aprueba automáticamente el texto que se genere.

Si la IA no devuelve JSON válido o falta un campo, el plan no se guarda. El mensaje identifica la posición de la idea y el campo o razón detectada. El proceso de Node escribe además un diagnóstico breve en la consola del servidor; no guarda claves, prompts completos ni la respuesta completa del proveedor. Es un registro de ejecución, no un historial persistente: al reiniciar el proceso no se pueden recuperar llamadas anteriores.
- Si hay una copia local del sitio, el plan busca temas de tours y artículos prácticos allí, marca la URL de origen y evita coincidencias fuertes con títulos ya publicados o planeados. Las comparaciones de Humantay, Palcoyo y Vinicunca se contrastan como pares de destinos para no volver a proponer el mismo par; la IA también recibe los títulos recientes y debe conservar el tema/fuente de cada idea. Esto reduce repeticiones, pero no garantiza novedad semántica en cualquier tema.
- **Publicaciones:** lista de piezas y clasificación masiva. Una pieza importada ya se considera `publicado`; puede estar publicada y a la vez pendiente de clasificación.
- En **Clasificación rápida**, marca las publicaciones en la tabla y completa únicamente los campos comunes. Guardar una parte no elimina la etiqueta **Pendiente**: la tabla y el aviso posterior muestran los campos que aún faltan. Por defecto se respetan los valores existentes; activa **Sobrescribir valores ya clasificados** solo para corregirlos deliberadamente.
- **Crear con IA:** puedes partir de una idea aprobada, describir una pieza nueva o usar una publicación existente como referencia opcional. La idea aprobada conserva el idioma de su plan. El copy se genera siempre; guion, prompts o carrusel se pueden añadir. Cada resultado queda en revisión humana. Los formularios de creación están plegados en «＋ Crear contenido nuevo»; debajo, los borradores se agrupan por origen (título de la idea, brief o publicación) y se filtran por estado (por defecto, Activos: sin rechazados), tipo, plataforma, idioma y búsqueda. La generación requiere información autorizada en Biblioteca o una página web aprobada y pertinente.
- **Anuncio Meta:** en **Crear sin plan ni publicación previa**, elige el **Tour** (completa el título y fija el idioma de su página) y el formato **Anuncio Meta: imagen** o **carrusel + textos de anuncio**. También funciona desde una idea aprobada o una publicación de referencia. Se generan la pieza visual y 2–3 variantes de texto para Facebook + Instagram, sin copies orgánicos. Cada variante trae ángulo, texto principal (lo visible son las primeras 125 letras), título (≤40), descripción (≤30), un código de campaña propio (`ADEN001A`, `ADEN001B`…), el mensaje predeterminado de WhatsApp con ese código y el enlace al tour con UTM (`utm_source=meta`, `utm_medium=paid_social`). Cada campo tiene su botón **Copiar**.
  En el Administrador de anuncios: objetivo **Mensajes** con destino WhatsApp, un anuncio por variante dentro del mismo conjunto, la misma imagen exportada y el mensaje predeterminado de cada variante. Cuando llegue una consulta, regístrala en **Consultas** con su código; sin lead atribuido no hay evidencia de qué variante vende.
  La validación rechaza ganchos de más de 125 caracteres, títulos de más de 40, descripciones de más de 30 y cuerpos de más de 600 (sobre 350 solo avisa), «barato»/«low cost»/«mejor precio», urgencia («últimos cupos»), hashtags, URL dentro del texto y cualquier precio que no aparezca literal en las fuentes aprobadas. Si falla, la IA corrige una vez; si persiste, no se guarda y queda en «Revisiones visuales fallidas». Regenerar conserva los códigos. Nada se publica ni se lanza automáticamente.
- **Calendario editorial:** muestra las ideas fechadas del plan más reciente y el flujo de publicaciones borrador → revisión → aprobado → programado → publicado → analizado. La aprobación es humana. Las ideas del plan no son aún publicaciones en redes.

Los atajos Instagram + Facebook y TikTok + YouTube Shorts indican destinos editoriales de una idea. No publican en esas redes ni unen sus métricas. Por ahora, si necesitas registrar publicaciones individuales en cada plataforma, hazlo en **Publicaciones**.

El constructor que vive en `carruseles-claude-design/` permite cargar un archivo JSON/YAML o pegar directamente su contenido con **Pegar JSON / YAML**. El parser adapta archivos antiguos con `titulo`/`texto` y alias conocidos de layouts. La IA recibe el esquema específico del constructor: un itinerario usa una entrada por día, una ficha separa sus datos en `meta`, y una galería usa una lista de fotos.

### Consultas

- **Consultas y estados:** registra fuente, viaje, viajeros, notas y avance comercial.
- **Enlaces y rastreo:** genera UTM y enlaces de WhatsApp con un código de campaña. El mismo código debe registrarse cuando llega el contacto.

Sin consultas atribuidas, la aplicación declara explícitamente que no puede medir conversión.

### Configuración

Agrupa objetivo del período, sincronización/importación, copia local del sitio, biblioteca aprobada y proveedor de IA. Las claves de APIs solo viven en `.env`.

**Datos que faltan.** Si la IA necesitó un dato que no está aprobado (horarios, temporadas, condiciones…), no lo escribe en el copy: aparece en el recuadro **Datos que faltan** de la tarjeta. El copy se puede publicar sin ellos. Para incluirlos, regístralos en **Configuración → Biblioteca** o aprueba la página web que los contiene y usa **Regenerar parte**. Si un borrador antiguo aún muestra `[FALTA DATO: …]` dentro del texto, usa **Editar texto** para escribir el dato verificado o quitar la frase; mientras quede un marcador no se puede aprobar. En la imagen única, los datos que faltan se ven en el editor y se resuelven en **Ajustar textos y resolver pendientes**.

En **Estrategia editorial** puedes ajustar el producto prioritario, su URL, las audiencias y el contacto (nombre y WhatsApp). El copy cierra con el WhatsApp configurado y una línea de hashtags por plataforma. Estos ajustes afectan planes nuevos y prompts nuevos, no reescriben planes guardados. La prioridad comercial no demuestra que una publicación haya convertido; eso requiere consultas atribuidas. Las reglas de voz, decisión de viaje y no inventar testimonios se aplican automáticamente.

En **Sitio web**, pulsa **Actualizar desde Tikaymi.com** para sincronizar el sitemap completo, o **Actualizar esta página** en la ficha concreta que quieras refrescar. La acción individual descarga solo esa URL; no consulta el sitemap. Se muestran el resultado y la fecha. El planificador consulta la copia local, no la web en cada planificación. Español e inglés se guardan por separado. Una página nueva queda pendiente; si una página aprobada cambia, se retira su aprobación hasta que vuelvas a revisarla. Si una URL desaparece del sitemap, queda archivada y ya no se usa, sin borrar el registro. Las páginas con fallo de descarga conservan su copia anterior.

Para autorizar contenido factual en los borradores, abre la ficha, contrástala con la página original y marca **Aprobada para redactar contenido**. Precios, inclusiones, horarios y disponibilidad merecen revisión especial. La IA solo recibe páginas aprobadas relacionadas con la idea, además de la Biblioteca aprobada. La sincronización no crea ni modifica publicaciones de redes sociales.

La pantalla también permite seleccionar páginas visibles y aprobarlas por lote. El botón **Aprobar todos los tours y blogs (ES + EN)** aplica la aprobación a todas las fichas activas de esos dos tipos en ambos idiomas; no incluye eventos, destinos ni páginas institucionales. La aprobación se retira automáticamente si una actualización cambia el contenido.

## Estados y clasificación

El estado editorial y la calidad de clasificación son conceptos diferentes:

- Una publicación sincronizada desde una red social entra como `publicado` porque ya existe en la plataforma.
- Puede conservar campos `sin_clasificar`; aun así participa en el resumen por plataforma.
- Las piezas históricas clasificadas por criterio editorial muestran **Inferida**. En **Editar** se explica el motivo; no equivale al brief original aprobado.
- `mixto` documenta copys antiguos en español e inglés, pero no está permitido al crear una pieza nueva.
- Para compararla por objetivo, audiencia, tema o CTA, completa esos campos mediante clasificación rápida o edición individual.
- Una publicación nueva creada manualmente mediante la API comienza como `borrador`; un borrador generado por IA comienza como `revision` y requiere aprobación humana.

## Instalación y respaldo

Requiere Node.js 20 o superior.

```bash
npm install
cp .env.example .env
npm start
npm test
```

Configura al menos `ADMIN_PASSWORD` y `SESSION_SECRET`. Para generar contenido agrega una de `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` o `DEEPSEEK_API_KEY` y selecciona el proveedor en Configuración.

Los datos viven en `data/tikaymi.db` y SQLite usa archivos WAL/SHM durante la ejecución. Para un respaldo consistente, detén la aplicación antes de copiar el conjunto `data/tikaymi.db`, `data/tikaymi.db-wal` y `data/tikaymi.db-shm`, o usa un procedimiento de backup de SQLite. Consulta [CONECTAR-PLATAFORMAS.md](CONECTAR-PLATAFORMAS.md) para las credenciales de Meta.

## Problemas frecuentes

| Síntoma | Qué revisar |
|---|---|
| El Inicio indica publicaciones pendientes | Ve a Contenido y usa clasificación rápida. |
| No hay conversión | Registra consultas con el mismo código usado en el CTA. |
| Generar responde 422 | Falta información relacionada y autorizada en Sitio web o Biblioteca aprobada. |
| «Recurso no autorizado» al aprobar | La foto no es de `res.cloudinary.com/tikaymi/image/upload/` ni está autorizada en Biblioteca, o fue desmarcada allí. Guarda la pieza tras pegar la URL. |
| Un plan repite un tema | Comprueba que Sitio web esté sincronizado. El filtro evita títulos muy similares, pero conviene revisar el enfoque antes de aprobar. |
| Una página dejó de estar aprobada | Cambió su contenido en la última actualización; vuelve a revisarla. |
| Generar responde 503 | Falta la clave del proveedor activo en `.env`. |
| Un CSV no importa | Revisa plataforma y encabezados; cada adaptador reconoce formatos concretos. |
| Meta dejó de sincronizar | Revisa el aviso de expiración y ejecuta `npm run meta:renew`. |
