# Proyecto: Tikaymi Marketing Intelligence & Content Lab

> **Documento de requerimientos original.** Se conserva como contrato funcional. La arquitectura de experiencia vigente está en `docs/PLAN.md`, el estado real en `docs/PROGRESS.md` y las instrucciones para futuras sesiones de Claude Code en `CLAUDE.md`.

Construye una aplicación web para Tikaymi, agencia de viajes especializada en Cusco y Perú.

La aplicación no debe ser principalmente un generador de publicaciones. Su función central es analizar datos reales de redes sociales y relacionarlos con objetivos comerciales. La IA debe generar recomendaciones y contenidos únicamente después de analizar esos datos.

## 1. Objetivo principal

Ayudar a Tikaymi a convertir la actividad en redes sociales en:

- consultas calificadas;
- solicitudes de cotización;
- reservas;
- aprendizaje sobre qué contenidos generan resultados comerciales.

No optimices únicamente para likes, reproducciones o seguidores.

La aplicación debe distinguir entre:

- alcance;
- interacción;
- consideración;
- intención de compra;
- consulta;
- cotización;
- reserva.

## 2. Flujo obligatorio de la aplicación

La aplicación debe seguir este proceso:

1. Definir el objetivo de negocio.
2. Registrar el objetivo de marketing de la publicación.
3. Obtener estadísticas reales.
4. Analizar el rendimiento por plataforma.
5. Relacionar los resultados con el contenido publicado.
6. Detectar patrones y limitaciones de los datos.
7. Recomendar una acción.
8. Generar contenido únicamente cuando corresponda.
9. Solicitar aprobación humana.
10. Publicar o exportar.
11. Medir nuevamente el resultado.
12. Registrar lo aprendido.

Nunca generes contenido sin indicar previamente:

- objetivo;
- audiencia;
- etapa del embudo;
- CTA;
- métrica principal;
- plataforma;
- idioma.

## 3. Jerarquía de objetivos

Cada publicación debe tener estos niveles:

### Objetivo de negocio

Uno de los siguientes:

- generar una consulta calificada;
- conseguir una solicitud de cotización;
- impulsar una reserva;
- aumentar el reconocimiento de Tikaymi;
- construir confianza;
- captar personas interesadas para seguimiento.

### Objetivo de marketing

Por ejemplo:

- atraer viajeros que están planificando su viaje;
- resolver una duda frecuente;
- comparar dos experiencias;
- demostrar organización;
- reducir una objeción;
- mostrar una experiencia real;
- dirigir tráfico a WhatsApp o al sitio web.

### Objetivo de contenido

Por ejemplo:

- explicar;
- comparar;
- demostrar;
- responder;
- inspirar;
- presentar un producto;
- mostrar un testimonio.

“Producto”, “informativo” y “testimonio” son tipos de contenido, no objetivos comerciales finales.

## 4. Análisis de datos

Permite importar información mediante:

- APIs oficiales cuando estén disponibles;
- archivos CSV;
- exportaciones manuales de las plataformas;
- entrada manual para consultas, cotizaciones y reservas.

Plataformas iniciales:

- Meta: Instagram y Facebook;
- TikTok;
- YouTube Shorts.

Diseña una capa de adaptadores para que cada plataforma tenga su propio conector y no se mezclen sus métricas de forma incorrecta.

Registra como mínimo:

- plataforma;
- publicación;
- fecha;
- formato;
- idioma;
- tema;
- objetivo;
- CTA;
- alcance;
- impresiones;
- reproducciones;
- retención;
- reproducciones completas;
- me gusta;
- comentarios;
- compartidos;
- guardados;
- visitas al perfil;
- clics;
- conversaciones;
- consultas calificadas;
- cotizaciones;
- reservas.

No presentes una publicación como exitosa solo porque obtuvo muchos likes.

## 5. Conversión y atribución

Implementa mecanismos para relacionar una publicación con una consulta:

- enlaces UTM;
- enlaces diferentes por campaña;
- palabras clave de WhatsApp;
- formularios;
- códigos de campaña;
- registro manual de origen del lead.

Ejemplo:

> HUMANTAY + fecha de viaje + número de viajeros

Crea un registro básico de leads con estos estados:

- nuevo;
- contactado;
- calificado;
- cotizado;
- reservado;
- perdido;
- sin respuesta.

Calcula la conversión desde publicación hasta consulta, cotización y reserva cuando existan datos suficientes.

Si no existen datos de conversión, indícalo explícitamente. No inventes atribuciones.

## 6. Calidad estadística

La aplicación debe mostrar el nivel de confianza de cada conclusión:

- datos insuficientes;
- señal inicial;
- patrón probable;
- patrón confirmado.

No generes recomendaciones definitivas con pocos datos.

Considera:

- cantidad de publicaciones;
- período analizado;
- estacionalidad;
- plataforma;
- idioma;
- inversión publicitaria;
- cambios en el CTA;
- cambios en la audiencia;
- campañas especiales.

La aplicación debe diferenciar entre:

- dato observado;
- interpretación;
- recomendación;
- hipótesis que todavía debe probarse.

## 7. Recomendaciones de contenido

La IA debe sugerir contenido basándose en:

- publicaciones con mejor retención;
- publicaciones con más guardados y compartidos;
- publicaciones que generaron visitas al perfil;
- publicaciones que generaron consultas;
- temas con bajo rendimiento;
- preguntas frecuentes;
- destinos prioritarios;
- etapa del embudo;
- idioma de la audiencia;
- recursos visuales disponibles.

Cada recomendación debe explicar:

- qué dato la origina;
- qué objetivo busca;
- por qué se propone ese formato;
- qué CTA utilizará;
- qué métrica determinará el éxito;
- qué limitaciones existen.

No digas simplemente “publica más reels”. Explica qué tipo de reel, para qué audiencia y con qué objetivo.

## 8. Generación mediante IA

La IA podrá generar:

- ideas;
- copys;
- guiones;
- prompts para Google Flow;
- textos para carruseles;
- variantes en inglés y español;
- CTA;
- respuestas para WhatsApp;
- propuestas de pruebas A/B.

Pero debe utilizar únicamente:

- datos reales;
- información aprobada de Tikaymi;
- servicios existentes;
- fotografías disponibles;
- testimonios verificables.

Nunca debe inventar:

- precios;
- disponibilidad;
- horarios;
- servicios;
- resultados;
- reseñas;
- testimonios;
- estadísticas;
- condiciones de viaje.

Todo contenido generado debe pasar por aprobación humana antes de publicarse.

## 9. Reglas de contenido de Tikaymi

### Carruseles

- Usar normalmente entre 3 y 5 diapositivas.
- No utilizar siete diapositivas por defecto.
- Cada diapositiva debe aportar una idea nueva.
- Mantener un solo idioma visual por pieza.
- Crear versión en español o inglés cuando los datos indiquen que vale la pena probarla.
- Utilizar el generador de carruseles existente.
- Inspeccionar primero su código y respetar exactamente su esquema de datos.
- No reconstruir su editor ni duplicar su sistema de renderizado.
- Exportar los datos en el formato compatible con ese generador.

### Reels

- Variar las estructuras narrativas.
- Killa no debe aparecer siempre en la apertura y el cierre.
- Puede utilizarse como presentadora, guía o narradora cuando aporte valor.
- Los reels informativos y comerciales no deben ser silenciosos.
- Incluir voz, diálogo, narración o subtítulos claramente planificados.
- Considerar que Google Flow Omni genera clips de aproximadamente 10 segundos.
- Permitir que cada clip utilice fotografías de referencia.
- Evitar repetir siempre la misma secuencia de apertura, explicación y cierre.

### Testimonios

Si no existe video:

- utilizar fotografías reales;
- aplicar movimiento sutil;
- incluir el texto real del testimonio;
- indicar nombre y contexto solo si están autorizados;
- no crear testimonios ficticios;
- diferenciar claramente entre testimonio textual y video testimonial.

## 10. Bilingüismo

La aplicación debe permitir:

- idioma principal;
- idioma secundario;
- versión independiente en inglés;
- versión independiente en español;
- subtítulos;
- copy bilingüe;
- comparación del rendimiento por idioma.

No mezclar automáticamente ambos idiomas dentro de una misma pieza visual.

La aplicación debe recomendar si conviene:

- publicar solo en inglés;
- publicar solo en español;
- crear dos versiones;
- probar ambos idiomas durante un período.

La recomendación debe basarse en audiencia y resultados, no en una preferencia fija.

## 11. Integración con publicaciones

Implementa inicialmente:

- calendario editorial;
- estado de borrador;
- revisión;
- aprobado;
- programado;
- publicado;
- analizado.

La publicación automática debe ser una fase posterior.

La primera versión debe permitir:

- exportar contenido;
- copiar copys;
- descargar archivos;
- generar enlaces;
- revisar visualmente;
- aprobar manualmente.

Después se podrán agregar conectores oficiales para publicación mediante APIs, respetando permisos, límites y políticas de cada plataforma.

## 12. Panel principal

El dashboard debe mostrar:

- objetivo comercial del período;
- publicaciones realizadas;
- consultas generadas;
- cotizaciones;
- reservas;
- rendimiento por plataforma;
- rendimiento por formato;
- rendimiento por idioma;
- rendimiento por tema;
- CTA con mejores resultados;
- contenido con mejor retención;
- contenido con mejor conversión;
- datos insuficientes;
- recomendaciones prioritarias.

Debe existir una diferencia visual entre:

- métricas de atención;
- métricas de intención;
- métricas de negocio.

## 13. Arquitectura recomendada

Utiliza una arquitectura modular:

- frontend;
- backend;
- base de datos;
- módulo de autenticación;
- módulo de métricas;
- adaptadores por plataforma;
- módulo de objetivos;
- módulo de atribución;
- módulo de leads;
- módulo de IA;
- módulo de contenido;
- módulo de aprobación;
- módulo de exportación;
- módulo de publicación futura.

Usa variables de entorno para claves y credenciales.

Nunca incluyas tokens directamente en el código.

Registra errores, límites de API y respuestas incompletas.

## 14. Fases de desarrollo

### Fase 1 — MVP analítico

Construye primero:

- autenticación;
- registro de objetivos;
- importación CSV;
- dashboard;
- análisis por publicación;
- clasificación de contenido;
- registro de consultas;
- recomendaciones básicas;
- exportación de informes.

No incluir todavía publicación automática.

### Fase 2 — IA y contenido

Agregar:

- generación de copys;
- guiones;
- prompts;
- variantes bilingües;
- recomendaciones basadas en datos;
- exportación compatible con el constructor de carruseles;
- biblioteca de fotografías y testimonios.

### Fase 3 — Automatización

Agregar:

- APIs oficiales;
- programación;
- publicación;
- actualización automática de estadísticas;
- pruebas A/B;
- alertas;
- análisis de cohortes;
- recomendaciones periódicas.

## 15. Criterios de aceptación

La aplicación será válida si:

- no genera contenido sin objetivo;
- no confunde likes con resultados comerciales;
- indica cuando los datos son insuficientes;
- explica el origen de cada recomendación;
- permite registrar consultas y reservas;
- respeta la información aprobada de Tikaymi;
- no inventa datos turísticos;
- requiere aprobación humana;
- respeta el formato del constructor de carruseles existente;
- separa correctamente las métricas por plataforma;
- permite analizar inglés y español;
- permite revisar qué contenido produjo consultas reales.

Antes de programar:

1. Inspecciona el repositorio existente.
2. Inspecciona el constructor de carruseles.
3. Identifica qué partes pueden reutilizarse.
4. Propón el modelo de datos.
5. Define el MVP.
6. Señala los riesgos técnicos.
7. No reconstruyas componentes que ya funcionan.
8. Comienza por el módulo analítico y de objetivos.
