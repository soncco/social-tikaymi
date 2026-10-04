# Objetivos de marketing de Tikaymi

## Jerarquía obligatoria

Cada publicación nueva debe poder describirse en este orden:

1. **Objetivo de negocio:** resultado comercial buscado.
2. **Objetivo de marketing:** cambio que se quiere producir en la relación con la audiencia.
3. **Objetivo de contenido:** trabajo concreto que realiza la pieza.
4. **Formato:** cómo se entrega la pieza en la plataforma.
5. **CTA:** siguiente acción que se solicita a la persona.
6. **Métrica principal:** señal que define el éxito de esa pieza.
7. **Métricas secundarias:** señales complementarias, siempre interpretadas según la plataforma.

Estos campos corresponden a `posts` y se validan en `src/modules/posts.js`. La generación también exige plataforma, idioma, audiencia y etapa del embudo.

## Objetivo de negocio

Los valores cerrados del sistema son `consulta_calificada`, `cotizacion`, `reserva`, `reconocimiento`, `confianza` y `seguimiento`.

La prioridad comercial general es generar consultas calificadas, cotizaciones y reservas. `reconocimiento`, `confianza` y `seguimiento` son objetivos admitidos, pero no sustituyen la medición de conversión cuando se afirma impacto comercial.

## Objetivo de marketing

El código almacena este campo como texto libre. Debe explicar el cambio buscado: mostrar cómo Deicy coordina una ruta, resolver una duda de logística, comparar modalidades, demostrar coordinación real o motivar una conversación contextual.

No debe ser simplemente “tener likes” o “hacer un reel”.

## Objetivo de contenido

El vocabulario cerrado es `explicar`, `comparar`, `demostrar`, `responder`, `inspirar`, `producto` y `testimonio`.

- **explicar:** decisiones logísticas de un viaje;
- **comparar:** dos tours o rutas para ayudar a elegir;
- **demostrar:** coordinación de una experiencia real aprobada;
- **responder:** resolver una pregunta concreta;
- **inspirar:** despertar interés por un destino;
- **producto:** presentar un paquete o tour aprobado;
- **testimonio:** utilizar una experiencia real autorizada.

Producto, informativo y testimonial son tipos o enfoques de contenido. No son objetivos comerciales finales. Un carrusel de producto puede buscar una consulta; una pieza informativa puede buscar consideración; un testimonio puede construir confianza y llevar a una consulta.

## Formato

El formato describe la pieza, no su éxito. El sistema reconoce imagen, video/reel, story y carousel en adaptadores y publicaciones; la IA produce además `copy`, `guion`, `prompt_flow`, `carrusel`, `whatsapp` y `ab`.

## CTA

El CTA debe pedir una acción coherente con la etapa. La estrategia recomienda invitar a escribir a Deicy por WhatsApp con destino, fechas y cantidad de viajeros.

## Métrica principal

`metrica_principal` es obligatoria. Debe definir el éxito de esa publicación: conversaciones/consultas atribuidas para intención, clics para tráfico, guardados/compartidos para utilidad, retención para evaluar un reel o alcance para reconocimiento.

## Métricas secundarias

Pueden incluir `reach`, `impressions`, `plays`, `retention`, `completed_plays`, `likes`, `comments`, `shares`, `saves`, `profile_visits`, `clicks` y `conversations`. Los adaptadores dejan en `NULL` lo que la fuente no entrega.

## Reglas de interpretación

- Una reproducción o un like mide atención/interacción, no una consulta, cotización o reserva.
- No se deben sumar métricas de Instagram, Facebook, TikTok y YouTube Shorts como si fueran equivalentes.
- `NULL` significa “dato no disponible”, no cero.
- Las consultas, cotizaciones y reservas deben proceder de leads registrados; no se infieren del engagement.
- Con pocos datos se presenta una señal o hipótesis, no un patrón confirmado.
- Las pruebas A/B comparan dos publicaciones de la misma plataforma y nunca declaran ganador por likes.
