# Publicidad Meta en Tikaymi Lab

Actualizado: 2026-10-09. Implementación: `src/modules/ads.js`, `src/modules/paid.js`, `src/modules/leads.js`, `public/app.js` y editor de imagen única.

## Flujo y alcance

`Contenido → Crear con IA → Anuncio Meta` genera visual y variantes. `Contenido → Publicidad` conserva el brief y permite registrar país, público, presupuesto, fechas, horario, IDs externos y resultados. Los estados son: contenido en revisión → creatividad aprobada → campaña preparada → lanzamiento manual → resultados registrados. La aprobación del texto no confirma el presupuesto, país, precio ni lanzamiento. La app no crea campañas en Meta ni sincroniza Ads Manager.

Meta orgánico se sincroniza en **Configuración → Fuentes de datos**. El gasto pagado se registra manualmente o mediante CSV en **Publicidad**. Son conjuntos de datos distintos.

## Perfiles de interfaz

| Perfil | Bloquea | Solo avisa | Procedencia |
|---|---|---|---|
| Business Suite simplificado | título 25, saludo 300, mensaje predefinido 80; además gancho 125, cuerpo 600 y descripción 30 como límites internos del contrato | cuerpo sobre 350 | Los valores 25/300/80 proceden de la pantalla concreta comunicada por Tikaymi en el encargo recibido el 2026-10-09. No se verificaron contra todas las cuentas o ubicaciones. Los demás límites son del contrato interno previo, no límites universales de Meta. |
| Ads Manager | gancho 125 y cuerpo 600 por contrato interno | título sobre 40, descripción sobre 30, cuerpo sobre 350 | El 40 procede de la implementación anterior; no hay verificación de un máximo universal de Ads Manager. Reconfirmar en la interfaz de la cuenta al copiar. |

El texto visible antes de «ver más» depende de ubicación y presentación. No se promete un número fijo de caracteres visibles. `saludo` es el primer mensaje de la plantilla de conversación; `mensaje_whatsapp` es el mensaje predefinido que incluye el código. `boton` describe el botón real del anuncio. No se configura un botón adicional dentro de la plantilla en esta versión.

El servidor acorta el nombre del producto en el mensaje predefinido y conserva el código. Valida 25/300/80 después de construir la salida. La edición y aprobación vuelven a validar; cambiar un código ya asignado se rechaza.

## Precio y afirmaciones

La entrada nueva de precio pide importe, moneda, modalidad (`desde` o `fijo`), unidad, condiciones, vigencia opcional, confirmación humana y URL del producto. La etiqueta visual muestra importe, moneda y unidad; las condiciones confirmadas se añaden al cuerpo del anuncio. Se puede generar sin precio. Los precios antiguos en texto se conservan sin inferir unidad ni condiciones; **Publicidad → Confirmar o corregir precio** permite convertirlos mediante una decisión humana y devuelve visual y textos a revisión.

La preparación exige revisar afirmaciones e inclusiones frente al tour aprobado. Se rechazan promesas detectadas de cambio libre del itinerario o aclimatación garantizada cuando no existe respaldo explícito. Esta detección es parcial: no prueba que todas las afirmaciones sean verdaderas. Las páginas aprobadas, el brief y la revisión humana siguen siendo necesarios. No se infiere que una cifra aislada en otra página corresponda a este tour.

Para cotización, la imagen nueva sugiere «Solicita una cotización» y el mensaje pide datos para cotizar. Un CTA visual «Reserva ahora» bloquea la aprobación/preparación de ese paquete. Los contenidos históricos no se reescriben.

## País, público y presupuesto

Cada campaña tiene su propio brief y variantes registradas. **Duplicar para otro país** asigna códigos nuevos, para poder preparar Colombia y Costa Rica por separado. El país describe ubicación elegida en Meta; no demuestra nacionalidad ni residencia de quienes respondieron. Público, edad, intereses y presupuesto requieren decisión humana; si no se confirman, la campaña no alcanza el estado «preparada».

La guía propone WhatsApp como destino único. Las opciones de optimización dependen de la cuenta; Pixel no es requisito universal para iniciar conversaciones. Público Advantage+ y Contenido Advantage+ se registran por separado como decisiones propuestas.

## Consultas y resultados

`POST /api/leads` vincula un código `AD…` a `ad_variants` aun si no existe `post` orgánico. Si un código aparece en ambos orígenes se rechaza por ambiguo. Sin coincidencia, se guarda como origen desconocido. El país de residencia solo se registra si la persona lo declara; no se copia del país elegido para el anuncio. `acquired_at` permite conservar la fecha de adquisición, y `lead_status_history` mantiene transiciones posteriores.

`paid_metrics` registra períodos por variante: gasto/moneda, impresiones, alcance, clics con definición y conversaciones con definición. Dos períodos superpuestos para la misma variante se rechazan, también dentro del CSV. Cero y dato ausente son distintos. Se calcula costo por conversación, por consulta calificada y por reserva solo cuando hay gasto y denominador válido. Alcances de varios períodos/anuncios no se suman como personas únicas. No se convierten monedas ni se afirma rentabilidad. Conversaciones declaradas por Meta y consultas registradas en Tikaymi se muestran por separado.

El resultado de una variante no equivale a un experimento A/B controlado si la entrega, presupuesto, país o creatividad también difieren. Los códigos ayudan, pero una persona puede borrarlos o editarlos antes de enviar WhatsApp.

## Exportación y API

`GET /api/ads/campaigns/:id/export` devuelve JSON `tikaymi-meta-review` versión 1: brief, producto, fuentes del paquete, visual, textos y códigos de las variantes, validaciones, pendientes y resultados agregados. Excluye notas y datos personales de consultas. La UI descarga ese JSON desde **Publicidad** para revisión externa.

Al registrar el lanzamiento manual se congela una copia del anuncio, visual, producto y fuentes utilizados. Una edición posterior del borrador no cambia esa parte histórica de la exportación; el brief y los resultados siguen reflejando el estado actual del registro de campaña.

Endpoints principales: `GET/PUT /ads/campaigns/:id`, `POST /ads/campaigns/:id/clone|prepare|launch`, `GET /ads/campaigns/:id/results|export`, `POST /ads/metrics`, `POST /ads/metrics/preview|import`. La importación CSV pide mapeo de columnas y muestra vista previa antes de guardar.

## Imagen única

El editor conserva el logo original y permite retirar la silueta decorativa, ajustar oscurecimiento del fondo, CTA, 4:5 (1080 × 1350) y 9:16 (1080 × 1920). 9:16 recompone la disposición y muestra guías orientativas arriba/abajo que no se exportan. La descarga sigue requiriendo foto autorizada, revisión de texto y reporte de render vigente. El control de contraste es una comprobación conservadora basada en el oscurecimiento elegido, no una medición exhaustiva de píxeles ni garantía de rendimiento.

## Limitaciones actuales

- No hay lectura de Ads Manager por API ni publicación automática.
- Las opciones de optimización y límites de Ads Manager deben confirmarse en la cuenta real.
- El precio antiguo libre se conserva para compatibilidad, pero no puede convertirse automáticamente en precio preparado.
- La verificación de afirmaciones comerciales combina reglas, fuentes aprobadas y confirmación humana; no demuestra por sí sola la veracidad de cada frase.
- Las pruebas de navegador con fotografía real y exportación PNG de ambas relaciones de aspecto siguen pendientes cuando el entorno no permita completar Chrome headless.
