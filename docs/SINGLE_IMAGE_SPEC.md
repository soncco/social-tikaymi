# Imagen única y composición móvil

Implementación revisada el 2026-10-05. La pieza tiene contrato propio, sin `slides`.

```json
{
  "format": "imagen_unica",
  "version": 1,
  "tipo": "producto",
  "plataforma": "instagram",
  "idioma": "es",
  "resource": {"url": "", "pending": "Foto aprobada de Humantay pendiente"},
  "visual": {"headline": "Planifica tu visita a Humantay", "support": "Decide cómo encaja en tu viaje", "visualCta": "Consulta tus fechas"},
  "alt": "Fotografía de referencia pendiente de revisión",
  "cta": {"text": "Escríbenos con tus fechas", "destination": ""},
  "warnings": [],
  "pending": ["Fotografía aprobada pendiente"],
  "copies": [{"plataforma": "instagram", "idioma": "es", "text": "Copy ilustrativo; revisar antes de publicar."}]
}
```

Este ejemplo es ilustrativo, sin afirmaciones comerciales. Tipos: `producto`, `informativo`, `testimonio`. Para testimonio el apoyo visual debe coincidir literalmente con `testimonial.quote` y con un testimonio aprobado; una cita larga requiere otro formato, no inventar una versión corta. Si se incluye `testimonial.by`, debe coincidir con el título de la ficha del testimonio autorizado; no inferir nombres. El título de esa ficha debe revisarse humanamente antes de autorizarla.

## Flujo

1. Foto: pegar una URL de `https://res.cloudinary.com/tikaymi/image/upload/…` en el editor, o autorizar explícitamente otra fotografía en Biblioteca. Al guardar, una URL de Cloudinary de Tikaymi se registra en Biblioteca como autorizada (si ya existía, no se modifica: una foto desmarcada sigue bloqueada). `/image/fetch/` y otras cuentas no se aceptan. Los recursos anteriores requieren autorización; la migración no los aprueba automáticamente.
2. Crear con IA: elegir **Imagen única + copy**. Formato y propósito de contenido son decisiones independientes.
3. Abrir **Revisar y descargar PNG** en el borrador. El renderer reutiliza las plantillas del constructor de carruseles: `producto` = portada con foto a sangre, `informativo` = portada editorial, `testimonio` = cita. Usa el mismo logo, cresta, tipografías y marcador de foto pendiente, sin numeración ni «Desliza». La etiqueta superior sigue `idioma`.
   El editor muestra controles a la izquierda y una vista previa en vivo a la derecha; URL y textos actualizan la composición sin guardar. Si falta foto, elegirla en **Fotografía autorizada** o pegar su URL pública. Las URL de Cloudinary de Tikaymi se aceptan pegadas y se registran al guardar; otras deben estar autorizadas en la Biblioteca. Deben permitir CORS (Cloudinary responde `access-control-allow-origin: *`). La IA no puede proponer URL de Cloudinary que no estén registradas. Puede acortarse el texto en **Ajustar textos y resolver pendientes**; retirar pendientes solo después de comprobarlos. **Guardar foto y textos para revisar** vuelve a revisión y conserva los copies. También puede cargarse JSON local, pero la descarga consulta la Biblioteca autenticada para verificar fotos y testimonios.
4. Revisar foto, texto, CTA e idioma. Una foto pendiente impide aprobación y exportación final. Se descarga un PNG de 1080 × 1350 (4:5) o 1080 × 1920 (9:16), sin numeración ni paquete de diapositivas. Para 9:16, el editor recompone los bloques, muestra guías orientativas de interfaz y vuelve a comprobar cortes, solapamientos y zonas; las guías no se exportan. Oscurecimiento y silueta decorativa son ajustables, el logo original permanece.
5. Volver a Lab y aprobar humanamente. No existe publicación automática.

## Archivos y límites

- `public/visual-contract.js`: contrato y límites ajustables compartidos por Node y navegador. Imagen: 8/12/5 palabras para titular/apoyo/CTA visual.
  Cada campo además admite hasta 16 caracteres por palabra permitida, configurable con `charactersPerWord`; esto evita que una única cadena enorme eluda el contador de palabras.
- `public/imagen-unica.html` y `imagen-unica.js`: renderer de una imagen, con variantes de producto, informativo y testimonio; acepta fotos aprobadas seleccionadas de la Biblioteca o su URL.
- El constructor de carruseles carga el mismo módulo: portada 8 palabras de título y 12 de apoyo; interiores 10 de título y 25 de cuerpo; listas/campos repetibles tienen límites diferentes por layout. Columnas: 2 contenedores, máximo 3 filas cada uno.
- `visual_render_checks`: resultado del navegador ligado al hash del contenido. Una edición obliga a revisar nuevamente. La API interna confía en el reporte autenticado del navegador; no constituye una auditoría independiente de veracidad.
- `generated.plataforma`: destino explícito de cada nueva salida/copy; los registros históricos quedan con `NULL` sin inferirlo. La regeneración conserva ese destino. Los pendientes declarados en la imagen también bloquean la aprobación hasta resolverlos.
- El brief de entrada no se modifica al generar derivados. El paquete conserva su plataforma principal y todos sus destinos; la reparación de imagen única mantiene el destino solicitado.
- `failed_visual_reviews`: respuestas inválidas después de un intento de corrección; visibles al final de Crear con IA. No forman un paquete aprobado.
- La composición mide dimensiones, cortes en contenedores y cruces con logo/pie. No se reduce la fuente automáticamente. Hay una reparación automática por pieza, compartida entre contrato y render, registrada en `generated.visual_repair_used`; recargar o abrir otra pestaña no renueva el presupuesto. Después se bloquea la salida y se explica qué corregir humanamente. Las correcciones humanas/regeneraciones solicitadas explícitamente siguen disponibles.

## Límites operativos

La descarga PNG depende de html2canvas y de fotografías accesibles con CORS. La comprobación de contraste por oscurecimiento es conservadora, no mide exhaustivamente los píxeles de la fotografía ni predice rendimiento. Las guías 9:16 pueden diferir de la interfaz Meta real. La validación técnica no confirma el idioma ni la calidad narrativa, y la fotografía debe revisarse humanamente. Sin datos comparables, las sugerencias de formato se etiquetan como hipótesis. No se usan likes como evidencia de elección del formato.

La sugerencia exploratoria consulta `/api/analysis` filtrado por plataforma y objetivo comercial. Requiere al menos dos formatos diferentes, cada uno con 5 publicaciones, 3 consultas atribuidas y confianza distinta de `datos_insuficientes`. Compara consultas/publicación, no tasa de conversión ni causalidad; no modifica el formato seleccionado. El criterio está en `formatRecommendation()` y puede ajustarse. No garantiza comparabilidad de audiencia, tema o período: esas limitaciones se muestran y requieren revisión humana.

## Verificación de esta entrega

Las pruebas automáticas usan bases en memoria y proveedores ficticios; no consumen la API real ni modifican datos de producción. `test/visual-render.html` es un fixture de navegador con las tres variantes y un caso deliberado de desbordamiento. Su ejecución headless no se pudo completar en este entorno: Brave no finalizó y Chrome devolvió `ETIMEDOUT` con errores `CVDisplayLinkCreateWithCGDisplay`. Queda pendiente comprobar ese fixture y una descarga PNG real en un navegador operativo; las pruebas de contratos y geometría simulada no equivalen a esa comprobación.

Resultados finales, incluida revisión adicional: `node --test test/visual.test.js test/content.test.js test/export.test.js`: 34/34; `npm test`: 119/119 con permisos para sockets locales; comprobaciones de sintaxis backend/frontend/scripts HTML y `git diff --check`: correctos.

Para reproducir la comprobación visual desde la raíz del repositorio en macOS (límite de 20 segundos, perfil temporal, sin usar el perfil personal):

```sh
node -e "const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),url=require('node:url');const profile=fs.mkdtempSync('/private/tmp/tikaymi-chrome-');const fixture=url.pathToFileURL(path.resolve('test/visual-render.html')).href;const html=cp.execFileSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless','--no-first-run','--disable-background-networking','--disable-component-update','--disable-extensions','--disable-gpu','--allow-file-access-from-files','--user-data-dir='+profile,'--dump-dom','--virtual-time-budget=3000',fixture],{timeout:20000,encoding:'utf8',maxBuffer:2000000});console.log(html);"
```

El resultado esperado del fixture es `PASS` para producto, informativo, testimonio y detección de overflow. Aun si pasa, revisar una exportación real con html2canvas y fotografías aprobadas/CORS antes de considerar cerrada la verificación visual.
