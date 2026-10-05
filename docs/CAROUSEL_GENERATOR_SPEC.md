# Especificación del generador de carruseles

## Fuente de verdad y archivos

El generador existente está en:

- `carruseles-claude-design/Tikaymi - Constructor de Carruseles.html`: aplicación autónoma, estado, layouts, editores, renderers, importación/exportación y descarga de imágenes;
- `carruseles-claude-design/styles.css`: estilos;
- `carruseles-claude-design/shared.jsx`: recurso auxiliar del diseño;
- `carruseles-claude-design/assets/tikaymi-logo.png`: logo;
- `src/modules/export.js`: validación/normalización del mismo contrato para salidas de IA.
- `src/modules/content.js`: validación estricta de nuevas generaciones y recursos autorizados.
- `public/visual-contract.js`: límites compartidos por campo/layout y comprobación geométrica del render.

No reconstruir los layouts en otro componente sin una decisión explícita. `src/modules/export.js` y el HTML deben mantenerse compatibles con el contrato existente.

## Contenedor JSON/YAML

El objeto serializado por el constructor es:

```json
{
  "app": "tikaymi-constructor-carruseles",
  "version": 1,
  "tipo": "producto",
  "exportadoEn": "2026-09-21T20:59:07.464Z",
  "slides": [
    {
      "layout": "portada",
      "data": {
        "eyebrow": "Cusco · Perú",
        "h1": "Un título de portada",
        "imageUrl": "",
        "caption": "",
        "note": "Foto de portada",
        "swipe": "Desliza"
      }
    }
  ]
}
```

`app`, `version` y `exportadoEn` son metadatos de serialización. Para cargar, el código exige `tipo` y un array `slides` no vacío; no exige que el archivo traiga todos los campos porque completa valores por defecto.

El YAML usa la misma estructura. El constructor carga JSON por contenido y, si no es JSON válido, intenta `jsyaml.load`. También permite pegar texto o cargar `.json`, `.yaml` y `.yml`.

## Tipos de carrusel y layouts

### `producto`

`portada`, `portada-foto`, `portada-editorial`, `ficha`, `itinerario`, `foto-sangre`, `split`, `foto-arriba`, `foto-abajo`, `galeria`, `cita`, `antes-despues`, `incluido`, `bueno-saberlo`, `cierre`.

### `informativo`

`portada`, `portada-foto`, `portada-editorial`, `cifras`, `pasos`, `columnas`, `foto-overlay`, `qa-panel`, `cierre`.

Los identificadores son exactos y dependen del tipo elegido. El backend acepta además estos alias: `bueno-saber-lo`, `bueno_saberlo` y `bueno-saber`, convertidos a `bueno-saberlo`.

## Campos de cada layout

Los siguientes campos reflejan `defaultDataFor`, `buildFieldsFor` y los renderers del constructor.

| Layout | Campos de `data` |
|---|---|
| `portada` | `eyebrow`, `h1`, `imageUrl`, `caption`, `note`, `swipe`. |
| `portada-foto` | `eyebrow`, `h1`, `body`, `imageUrl`, `note`, `swipe`. |
| `portada-editorial` | `badge`, `eyebrow`, `h1`, `body`, `imageUrl`, `caption`, `note`, `swipe`. |
| `ficha` | `eyebrow`, `h2`, `meta` (`[{k,v}]`), `body`. |
| `itinerario` | `eyebrow`, `h2`, `imageUrl`, `caption`, `note`, `route` (`[{d,t}]`). Puede contener varios días/etapas. |
| `foto-sangre` / `foto-overlay` | `eyebrow`, `h2`, `body`, `imageUrl`, `note`. |
| `split` / `foto-arriba` / `foto-abajo` | `eyebrow`, `h2`, `body`, `imageUrl`, `caption`, `note`. |
| `galeria` | `eyebrow`, `h2`, `photos` (`[{imageUrl,tag,note}]`); el renderer usa como máximo 3 fotos. |
| `cita` | `quote`, `by`, `imageUrl`, `note`. |
| `antes-despues` | `eyebrow`, `h2`, `beforeUrl`, `afterUrl`, `beforeTag`, `afterTag`, `beforeNote`, `afterNote`, `body`. |
| `incluido` | `eyebrow`, `h2`, `items` (`[string]`). |
| `bueno-saberlo` | `eyebrow`, `h2`, `notes` (`[{title,text}]`), `body`. |
| `cierre` | `eyebrow`, `h2`, `body`, `ctaText`, `ctaUrl`, `contact`. |
| `cifras` | `eyebrow`, `h2`, `facts` (`[{v,k}]`). |
| `pasos` | `eyebrow`, `h2`, `steps` (`[{title,text}]`). |
| `columnas` | `eyebrow`, `h2`, `colA` (`{heading,items}`), `colB` (`{heading,items}`). |
| `qa-panel` | `eyebrow`, `qas` (`[{q,a}]`), `panelLabel`, `panelText`. |

`cita` no usa `eyebrow` ni `h2` en su renderer: muestra la cita, autor y foto. El `cierre` debe reservarse para el final cuando se usa como cierre editorial.

## Propiedades visuales confirmadas

- Las diapositivas se renderizan a 1080 × 1350.
- Se usan fotografías mediante `imageUrl`; `note`/`caption` sirven como marcador o pie, no sustituyen una imagen real.
- Hay variantes de foto lateral, foto a sangre, foto arriba, foto abajo, split, overlay y galería.
- El constructor añade logo, contador de diapositiva y, en portadas, texto de swipe/desliza.
- El resultado visual puede descargarse como PNG o JPEG mediante `html2canvas`.
- Los campos se escapan antes de insertarse en HTML; las URLs CTA se escapan como atributo.

## Validaciones e importación

Al importar:

1. se parsea JSON o YAML;
2. se comprueba que `tipo` sea `producto` o `informativo`;
3. se comprueba que `slides` sea un array no vacío;
4. cada `layout` debe pertenecer al tipo elegido, aplicando los alias conocidos;
5. se mezclan los datos importados con `defaultDataFor(layout)`;
6. se normalizan campos antiguos `titulo` y `texto`.

La normalización convierte `titulo` en `h1`/`h2` según el layout, `texto` en `body`, y crea una entrada única para `route`, `notes`, `steps`, `qas` o `quote` cuando corresponde. También reemplaza una `eyebrow` vacía o literalmente `Etiqueta` por un valor predeterminado.

Al cambiar el layout dentro del editor, el código confirma la acción y reinicia los datos con los valores por defecto del nuevo layout.

## Exportación

El constructor exporta JSON o YAML con `app`, `version`, `tipo`, `exportadoEn` y las diapositivas. La exportación de imágenes genera un archivo por diapositiva en PNG o JPEG.

`src/modules/export.js` ofrece `carouselExport` para validar salidas de IA, limita el array a un máximo técnico de 7 y normaliza alias/campos antiguos. El prompt de IA solicita 3–5 diapositivas.

Desde 2026-10-05, `content.js` exige 3–5 en nuevas generaciones, campos internos del layout y cierre con CTA. `visual-contract.js` aplica límites de palabras y caracteres por campo (portada 8/12, interior 10/25 para título/cuerpo) y cantidades por lista. El constructor bloquea PNG/JPEG si detecta texto cortado, desbordamiento, solapamiento con logo/pie/contador o fotografías pendientes/no cargables. No reduce automáticamente la fuente. El flujo abierto desde Lab registra la comprobación ligada al contenido exacto y permite guardar cambios en Lab. Contrato y render comparten una sola reparación automática por pieza, persistida en `generated.visual_repair_used`; después se requiere corrección humana. La importación histórica conserva su normalización; no garantiza que un archivo antiguo pase los nuevos controles de exportación.

## Limitaciones

- El archivo autónomo no guarda proyectos por sí solo; el flujo `?id=` guarda correcciones como revisiones en Lab.
- Express sirve el HTML existente bajo `/constructor/`; no se reconstruyen sus layouts.
- Las generaciones y aprobaciones de Lab comprueban campos y fotos/testimonios autorizados. La importación autónoma no consulta la Biblioteca; una descarga local por sí sola no implica aprobación en Lab.
- No hay verificación automática de veracidad ni del idioma de todo el texto: requiere revisión humana.
- La carga/exportación depende de fotografías accesibles con CORS y dependencias CDN.
- El renderer de galería corta la lista a un máximo de 3 fotos.
- El creador inicial puede generar más diapositivas que la recomendación editorial; el botón permite hasta 20, mientras que la recomendación 3–5 proviene de las reglas/prompt.

## Ejemplo real mínimo

```yaml
app: tikaymi-constructor-carruseles
version: 1
tipo: informativo
slides:
  - layout: portada-editorial
    data:
      badge: Guía
      eyebrow: Antes de viajar
      h1: Qué decidir antes de reservar
      body: Una pregunta concreta para planificar mejor.
      imageUrl: ''
      caption: ''
      note: Foto de referencia
      swipe: Desliza
  - layout: pasos
    data:
      eyebrow: Paso a paso
      h2: La decisión en tres pasos
      steps:
        - title: Fechas
          text: Define cuándo viajarás.
        - title: Ruta
          text: Ordena las etapas del itinerario.
  - layout: cierre
    data:
      eyebrow: Tu viaje
      h2: Conversemos sobre tu ruta
      body: Escribe a Deicy con fechas y viajeros.
      ctaText: Hablar por WhatsApp
      ctaUrl: https://tikaymi.com
      contact: tikaymi.com
```

El ejemplo usa únicamente campos presentes en el esquema real; los valores son ilustrativos y deben reemplazarse por información aprobada antes de publicar.
