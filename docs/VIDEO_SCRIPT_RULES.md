# Reglas para guiones de video corto

## Unidad de producción

Google Flow Omni trabaja con clips de aproximadamente 10 segundos. Un reel debe dividirse en clips ejecutables, normalmente exactamente 3, 4 o 5 clips (aproximadamente 30–50 segundos en total). El módulo `src/modules/content.js` rechaza una respuesta que siga teniendo más de cinco clips después de un reintento.

Cada clip debe tener una función narrativa clara: atención, problema o deseo, explicación, logística, objeción, confianza o CTA.

## Audio y quién habla

Cada clip debe indicar si usa diálogo visible, voz en off, narración externa, conversación, testimonio autorizado o sonido ambiente con una función narrativa explícita.

Debe quedar claro quién habla y cuál es el texto exacto. Una voz en off debe señalar que la persona visible no mueve los labios. No justificar un video entero sin audio narrativo.

Si aparece una guía mujer, debe ser Killa u otra mujer aprobada. No mostrar un guía masculino hablando con voz femenina. No inventar apariencia, biografía, vestuario o voz de Killa si esos datos no están aprobados.

## Killa y variación narrativa

Killa no es obligatoria. La decisión “Killa: sí/no” depende del tema y la estructura elegida. Las piezas deben variar entre pregunta, documental, recorrido, problema-solución, comparación, narración sobre fotografías, testimonio autorizado y guía visible.

Evitar la plantilla repetitiva “Killa abre → imágenes → Killa cierra”. Si Killa aparece, indicar en qué clips participa, qué idioma usa, qué dice y cómo se mantiene la continuidad.

## Fotografía y visuales

Cada fotografía disponible debe asignarse a clips concretos como referencia principal. El prompt visual debe preservar lugar, arquitectura, personas y ambiente; se permite movimiento sutil, no cambiar el destino ni inventar actividades.

El texto en pantalla y los subtítulos se añaden durante la edición. No pedir a Flow que genere letras o palabras dentro de la imagen.

## Entrega mínima del guion

La instrucción de generación exige este orden:

1. concepto general: título, objetivo, audiencia, mensaje, estructura, duración, CTA, métrica y razón;
2. guion completo hablado sin instrucciones técnicas;
3. tabla de clips;
4. prompt visual individual por clip;
5. edición final: orden, sobreimpresos, subtítulos, música, voz, transición, logo, CTA y advertencias;
6. copy de publicación, CTA, enlace/WhatsApp, hashtags moderados y advertencias.

Cada clip debe incluir duración aproximada, función, visual, movimiento de cámara, voz o diálogo, texto en pantalla opcional, foto de referencia, formato vertical 9:16, continuidad y restricciones negativas.

## Veracidad

- Usar únicamente información aprobada y recursos listados.
- No inventar horarios, precios, disponibilidad, servicios, dificultad, condiciones de viaje ni datos turísticos.
- No atribuir frases a viajeros reales sin testimonio aprobado.
- Si falta información, usar `[FALTA DATO: ...]`.
- El idioma de todo el guion debe coincidir con el idioma de la pieza.
