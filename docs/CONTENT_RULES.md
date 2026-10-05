# Reglas de contenido de Tikaymi

## Principios editoriales

- Cada pieza debe tener un objetivo, una audiencia, una etapa, un CTA y una métrica principal.
- El contenido debe ayudar a decidir o preparar un viaje: rutas, días, entradas, trenes, altura, equipaje, traslados o coordinación.
- Evitar contenido enciclopédico independiente que no conduzca a una decisión o conversación.
- Presentar a Tikaymi como una agencia boutique y a Deicy como figura humana de coordinación cuando sea pertinente, sin inventar biografía, autoridad o testimonio.
- Usar solo información aprobada de `approved_info`, páginas web aprobadas y recursos visuales autorizados explícitamente en Biblioteca.

## Formatos e imagen única

El formato elegido (imagen única, carrusel, reel/video o solo copy) es independiente del propósito. No convertir imagen única en una diapositiva de carrusel. Su contrato, plantillas y controles se documentan en `SINGLE_IMAGE_SPEC.md`.

El texto visual es breve; la explicación va en el copy, generado por separado para cada plataforma. Las recomendaciones de formato son hipótesis o señales exploratorias con evidencia y limitaciones, no decisiones automáticas ni ganadores por likes.

## Carruseles

- Usar 3 a 5 diapositivas por defecto.
- No generar automáticamente siete diapositivas. Las nuevas generaciones exigen 3–5; `export.js` conserva el tope de siete para compatibilidad histórica y el editor manual permite más.
- Cada diapositiva debe aportar una idea nueva; no dividir artificialmente una misma frase.
- En nuevas generaciones, incluir cierre con CTA como última diapositiva; los archivos históricos pueden tener otra estructura.
- Elegir `producto` para vender o explicar un tour y `informativo` para resolver una pregunta general.
- Usar los campos reales de cada layout; no enviar únicamente `titulo` y `texto` como contrato principal.
- En un itinerario, separar cada día o etapa en `route`; en una ficha, separar datos en `meta`; en “bueno saberlo”, usar `notes`.
- Las etiquetas, títulos, notas, CTA y contacto deben estar en el idioma de la pieza.
- Respetar los límites por layout de `visual-contract.js` y resolver cortes/solapamientos antes de exportar o aprobar. No reducir indefinidamente la tipografía para forzar texto.

## Reels y videos cortos

- Variar la estructura: pregunta, documental, recorrido, problema-solución, comparación, narración sobre fotos, testimonio autorizado o guía visible.
- No usar siempre “Killa abre, imágenes, Killa cierra”. Killa es opcional y su presencia depende del tema.
- Evitar videos comerciales o informativos completamente silenciosos salvo que el silencio tenga una función narrativa explícita.
- Mantener una sola idea principal y un CTA por publicación.
- El guion debe ser ejecutable: clips, función narrativa, visual, cámara, audio/voz, continuidad y edición.

## Veracidad y fuentes

- No inventar precios, disponibilidad, horarios, servicios, resultados, estadísticas, condiciones de viaje, nombres o testimonios.
- No tratar texto público no aprobado como fuente autorizada para redactar afirmaciones; primero debe revisarse y aprobarse en la copia local.
- Testimonios y reseñas solo se reutilizan si son reales, están autorizados y se conserva su sentido.
- Si falta un dato, indicar `[FALTA DATO: ...]` o dejar claro que debe consultarse con el equipo.

## Idioma y visuales

- Cada pieza nueva usa un solo idioma: español (`es`) o inglés (`en`). No mezclar idiomas en textos, etiquetas o CTA.
- Las publicaciones históricas pueden estar marcadas como `mixto`, pero eso no habilita a generar piezas bilingües nuevas.
- Usar fotografías reales disponibles cuando existan y asignarlas al contenido correcto.
- No inventar URLs de imágenes; si no existe un recurso aprobado, dejar un marcador explícito.

## Flujo de aprobación

- Todo contenido generado nace en `revision`.
- Una persona debe revisar el texto, las fuentes, el idioma, los recursos y el CTA antes de marcarlo aprobado.
- Las piezas visuales requieren una comprobación de render vigente, sin cortes ni marcadores fotográficos. Cambiar el contenido exige nueva revisión.
- La aplicación no publica automáticamente; programar solo crea un recordatorio manual o un archivo iCalendar.
