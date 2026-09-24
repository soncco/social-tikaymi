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
4. **Configuración → Estrategia editorial:** confirma producto prioritario, URL, audiencias y persona de contacto.
5. **Contenido → Planificar contenido:** elige semana o mes, revisa la razón editorial, fuente web, señales y límites de cada idea, y aprueba las que quieras trabajar.
6. **Contenido → Publicaciones:** clasifica las piezas importadas que aún necesiten contexto.
7. **Configuración → Sitio web:** revisa la copia local de tours, blog y otras páginas; aprueba únicamente las que quieras usar como fuente de redacción.
8. **Consultas → Enlaces y rastreo:** crea códigos o enlaces diferentes para reconocer el origen de cada consulta.
9. **Consultas → Consultas y estados:** registra contactos y actualízalos hasta cotizado, reservado o perdido.
10. **Configuración → Biblioteca aprobada:** carga servicios, precios, testimonios, fotos y videos reales que no estén cubiertos por páginas aprobadas.
11. **Contenido → Crear con IA:** genera el copy y, si quieres, un guion, prompts de video o un carrusel. No necesitas una publicación previa.

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

- **Planificar contenido:** prepara 3 ideas semanales u 8 mensuales. La vista previa funciona sin clave de IA: combina estrategia declarada, copia local de la web y métricas relacionadas cuando existen. «Analizar y proponer con IA» requiere el proveedor configurado. Cada idea muestra idioma, motivo editorial, fuente, evidencia, confianza y límites. Puedes editar título, fecha, audiencia, objetivo de marketing y CTA; luego aprobar o descartar. Aprobar una idea no aprueba automáticamente el texto que se genere.

Si la IA no devuelve JSON válido o falta un campo, el plan no se guarda. El mensaje identifica la posición de la idea y el campo o razón detectada. El proceso de Node escribe además un diagnóstico breve en la consola del servidor; no guarda claves, prompts completos ni la respuesta completa del proveedor. Es un registro de ejecución, no un historial persistente: al reiniciar el proceso no se pueden recuperar llamadas anteriores.
- Si hay una copia local del sitio, el plan busca temas de tours y artículos prácticos allí, marca la URL de origen y evita coincidencias fuertes con títulos ya publicados o planeados. Es un filtro de novedad por títulos, no una garantía de que nunca se repita un enfoque semántico.
- **Publicaciones:** lista de piezas y clasificación masiva. Una pieza importada ya se considera `publicado`; puede estar publicada y a la vez pendiente de clasificación.
- En **Clasificación rápida**, marca las publicaciones en la tabla y completa únicamente los campos comunes. Guardar una parte no elimina la etiqueta **Pendiente**: la tabla y el aviso posterior muestran los campos que aún faltan. Por defecto se respetan los valores existentes; activa **Sobrescribir valores ya clasificados** solo para corregirlos deliberadamente.
- **Crear con IA:** puedes partir de una idea aprobada, describir una pieza nueva o usar una publicación existente como referencia opcional. La idea aprobada conserva el idioma de su plan. El copy se genera siempre; guion, prompts o carrusel se pueden añadir. Cada resultado queda en revisión humana. La generación requiere información autorizada en Biblioteca o una página web aprobada y pertinente.
- **Calendario editorial:** muestra las ideas fechadas del plan más reciente y el flujo de publicaciones borrador → revisión → aprobado → programado → publicado → analizado. La aprobación es humana. Las ideas del plan no son aún publicaciones en redes.

Los atajos Instagram + Facebook y TikTok + YouTube Shorts indican destinos editoriales de una idea. No publican en esas redes ni unen sus métricas. Por ahora, si necesitas registrar publicaciones individuales en cada plataforma, hazlo en **Publicaciones**.

El constructor que vive en `carruseles-claude-design/` permite cargar un archivo JSON/YAML o pegar directamente su contenido con **Pegar JSON / YAML**. El parser adapta archivos antiguos con `titulo`/`texto` y alias conocidos de layouts. La IA recibe el esquema específico del constructor: un itinerario usa una entrada por día, una ficha separa sus datos en `meta`, y una galería usa una lista de fotos.

### Consultas

- **Consultas y estados:** registra fuente, viaje, viajeros, notas y avance comercial.
- **Enlaces y rastreo:** genera UTM y enlaces de WhatsApp con un código de campaña. El mismo código debe registrarse cuando llega el contacto.

Sin consultas atribuidas, la aplicación declara explícitamente que no puede medir conversión.

### Configuración

Agrupa objetivo del período, sincronización/importación, copia local del sitio, biblioteca aprobada y proveedor de IA. Las claves de APIs solo viven en `.env`.

En **Estrategia editorial** puedes ajustar el producto prioritario, su URL, las audiencias y el contacto. Estos ajustes afectan planes nuevos y prompts nuevos, no reescriben planes guardados. La prioridad comercial no demuestra que una publicación haya convertido; eso requiere consultas atribuidas. Las reglas de voz, decisión de viaje y no inventar testimonios se aplican automáticamente.

En **Sitio web**, pulsa **Actualizar desde Tikaymi.com** cuando cambies la web. Se leen el sitemap y las páginas indicadas, se guardan localmente y se muestran el resultado y la fecha. El planificador consulta esa copia, no la web en cada planificación. Español e inglés se guardan por separado. Una página nueva queda pendiente; si una página aprobada cambia, se retira su aprobación hasta que vuelvas a revisarla. Si una URL desaparece del sitemap, queda archivada y ya no se usa, sin borrar el registro. Las páginas con fallo de descarga conservan su copia anterior.

Para autorizar contenido factual en los borradores, abre la ficha, contrástala con la página original y marca **Aprobada para redactar contenido**. Precios, inclusiones, horarios y disponibilidad merecen revisión especial. La IA solo recibe páginas aprobadas relacionadas con la idea, además de la Biblioteca aprobada. La sincronización no crea ni modifica publicaciones de redes sociales.

La pantalla también permite seleccionar páginas visibles y aprobarlas por lote. El botón **Aprobar todos los tours y blogs (ES + EN)** aplica la aprobación a todas las fichas activas de esos dos tipos en ambos idiomas; no incluye eventos, destinos ni páginas institucionales. La aprobación se retira automáticamente si una actualización cambia el contenido.

## Estados y clasificación

El estado editorial y la calidad de clasificación son conceptos diferentes:

- Una publicación sincronizada desde una red social entra como `publicado` porque ya existe en la plataforma.
- Puede conservar campos `sin_clasificar`; aun así participa en el resumen por plataforma.
- Las piezas históricas clasificadas por criterio editorial muestran **Inferida**. En **Editar** se explica el motivo; no equivale al brief original aprobado.
- `mixto` documenta copys antiguos en español e inglés, pero no está permitido al crear una pieza nueva.
- Para compararla por objetivo, audiencia, tema o CTA, completa esos campos mediante clasificación rápida o edición individual.
- Un contenido nuevo creado dentro de la app comienza como `borrador`.

## Instalación y respaldo

Requiere Node.js 20 o superior.

```bash
npm install
cp .env.example .env
npm start
npm test
```

Configura al menos `ADMIN_PASSWORD` y `SESSION_SECRET`. Para generar contenido agrega una de `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` o `DEEPSEEK_API_KEY` y selecciona el proveedor en Configuración.

Los datos viven en `data/tikaymi.db`; respaldar ese archivo es suficiente. Consulta [CONECTAR-PLATAFORMAS.md](CONECTAR-PLATAFORMAS.md) para las credenciales de Meta.

## Problemas frecuentes

| Síntoma | Qué revisar |
|---|---|
| El Inicio indica publicaciones pendientes | Ve a Contenido y usa clasificación rápida. |
| No hay conversión | Registra consultas con el mismo código usado en el CTA. |
| Generar responde 422 | Falta información relacionada y autorizada en Sitio web o Biblioteca aprobada. |
| Un plan repite un tema | Comprueba que Sitio web esté sincronizado. El filtro evita títulos muy similares, pero conviene revisar el enfoque antes de aprobar. |
| Una página dejó de estar aprobada | Cambió su contenido en la última actualización; vuelve a revisarla. |
| Generar responde 503 | Falta la clave del proveedor activo en `.env`. |
| Un CSV no importa | Revisa plataforma y encabezados; cada adaptador reconoce formatos concretos. |
| Meta dejó de sincronizar | Revisa el aviso de expiración y ejecuta `npm run meta:renew`. |
