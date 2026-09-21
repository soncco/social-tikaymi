# Clasificación retrospectiva de publicaciones Meta

Fecha: 2026-09-21. Responsable: revisión editorial asistida por Codex.

## Alcance y fuente

Se revisaron los textos completos de 25 publicaciones de Instagram (`caption`) y las publicaciones correspondientes de la Página de Facebook (`message`) mediante la conexión Meta ya configurada, en modo solo lectura. La base local tenía solo la primera línea de varios textos. La clasificación se aplicó a 44 de las 50 publicaciones; seis piezas de Facebook no devolvieron texto ni tenían título.

El script reproducible es `scripts/classify-historical.js`. Antes de aplicar los cambios se creó un respaldo SQLite consistente en `data/tikaymi-before-classification-2026-09-21.db` (ignorado por Git). Cada pieza clasificada tiene una fila en `post_classification_audit` con fuente, grado de confianza y motivo; la UI muestra la etiqueta **Inferida** y su explicación en **Contenido → Publicaciones → Editar**.

## Qué significan los campos

- **Tema, idioma y CTA:** salen directamente del texto cuando se pueden observar. Los temas automáticos erróneos se corrigieron si el asunto principal era evidente.
- **Objetivo, audiencia, etapa y métrica principal:** son una interpretación editorial retrospectiva. No deben presentarse como el brief original aprobado por Tikaymi.
- **Métrica principal:** indica qué habría sido razonable medir para la intención del copy; no demuestra que esa métrica exista ni que el contenido haya convertido.
- **`mixto`:** el copy publicado contiene inglés y español. Esta etiqueta solo documenta piezas históricas. Las piezas nuevas y la generación con IA siguen exigiendo un único idioma.
- **Testimonio:** una publicación pública de Randall se etiquetó como testimonio para análisis, pero no se incorporó a la biblioteca aprobada de la IA. Reutilizarlo exige autorización separada.

## Resumen de criterio por pieza

Los ID separados por coma son versiones de Instagram y Facebook del mismo copy. Cada plataforma conserva sus propias métricas.

| ID | Tema principal | Lectura editorial | CTA observado |
|---|---|---|---|
| 1, 26 | Experiencias de viajeros | Confianza y organización | Enviar fechas, viajeros e intereses |
| 2, 27 | Ruta multi-destino Perú | Producto de 10 días, probable solicitud de cotización | Enviar fechas/tipo de viaje; ver itinerario |
| 3, 28 | Montaña de Colores | Comparar Palcoyo y Vinicunca | Enviar fechas; leer comparación |
| 4, 29 | Humantay | Resolver dudas de altura y aclimatación | Enviar fechas |
| 5, 31 | Experiencias de viajeros | Confianza y coordinación | Enviar fechas e intereses |
| 6, 32 | Valle Sagrado | Integrarlo en una ruta personalizada | Enviar fechas |
| 7, 33 | Machu Picchu | Resolver visita de un día | Enviar fecha y comprobar disponibilidad |
| 8, 34 | Itinerario Cusco | Producto de cinco días, probable solicitud de cotización | Enviar fechas/viajeros; ver itinerario |
| 9, 35 | Temporada de lluvias | Resolver objeción estacional | Leer guía; pedir ayuda |
| 10, 36 | Tours Cusco | Comparar privado y grupal | Enviar viajeros, fechas y ritmo |
| 11, 37 | Sitio Tikaymi | Dar a conocer el sitio renovado | Visitar sitio; comentar destino |
| 12 | Ausangate | Inspirar interés por naturaleza | No explícito |
| 13, 42 | Quillabamba | Mostrar la Feria de Sambaray | Deslizar para ver momentos |
| 14 | Mosoqllacta | Dar visibilidad a destino menos conocido | No explícito |
| 15, 46 | Experiencia de Randall | Confianza mediante testimonio publicado | Contactar por WhatsApp o correo |
| 16, 47 | Maras | Explicar Salineras de Maras | WhatsApp o sitio |
| 17, 48 | Experiencia de viajeros | Mostrar viaje personalizado | WhatsApp, sitio o correo |
| 18, 49 | Viajes Perú | Estimular conversación | Etiquetar acompañantes |
| 19 | Fiestas Cusco | Despertar interés cultural | WhatsApp genérico |
| 20, 50 | Experiencia familiar | Demostrar personalización | WhatsApp o sitio |
| 21 | Valle Sagrado | Invitar a reservar | «Reserva con nosotros» |
| 22 | Montaña de Colores | Explicar Vinicunca | Contactar por WhatsApp |
| 23 | Machu Picchu | Inspirar viaje y contacto | WhatsApp, sitio o correo |
| 24 | Inti Raymi | Invitar a reservar | «Reserva ahora» y WhatsApp |
| 25 | Inti Raymi | Promover interés | Contactar por WhatsApp |
| 41 | Cusco / Machu Picchu | Inspirar interacción | Comentar imagen favorita o contactar |
| 43 | Inti Raymi | Mostrar celebración cultural | No explícito |

## Lo que quedó pendiente

- **ID 30, 38, 39, 40, 44 y 45:** Facebook no devolvió texto y en la base figuran como `Sin título`. No se les asignó tema, objetivo, audiencia, etapa, CTA ni idioma. Habría que ver la imagen o video original para decidir.
- **ID 12, 14 y 43:** sí se clasificó contenido, pero no se inventó CTA. Siguen apareciendo como pendientes en la UI.
- **ID 1:** se respetaron los campos previamente definidos por el usuario (`confianza`, `testimonio`, `alcance`), aunque el texto por sí solo no acredita una reseña individual. Conviene revisar esa etiqueta antes de usar la pieza como ejemplo de testimonio.
- **ID 41:** el propio copy declara que las imágenes fueron generadas con IA; no deben tratarse como fotografías reales ni copiarse a `assets` sin aprobación.
- **Todas las piezas:** no había códigos de campaña por publicación ni leads atribuidos. No se pueden calcular conversiones históricas ni afirmar que una pieza produjo reservas.

## Cómo revisar o corregir

Abre **Contenido → Publicaciones**. Las piezas inferidas muestran una insignia; al pulsar **Editar**, aparece el motivo. Los nueve registros que aún tienen algún campo obligatorio pendiente aparecen en la parte superior. Si Tikaymi conserva el brief original, ese documento tiene prioridad sobre estas inferencias.
