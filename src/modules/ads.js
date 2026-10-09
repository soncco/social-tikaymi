// Textos de anuncio para Meta Ads (Facebook + Instagram). La IA redacta variantes;
// el servidor asigna códigos de campaña, mensaje precargado de WhatsApp y URL con UTM.
// Nunca se publica ni se lanza una campaña: el anuncio se arma a mano en el Administrador de anuncios.

// Límites de lo visible sin «ver más» y de los campos del Administrador de anuncios.
// El cuerpo queda oculto tras «ver más»: 350 es una recomendación (aviso) y solo 600 bloquea.
const LIMITS = Object.freeze({ gancho:125, cuerpo:600, titulo:40, descripcion:30, variantes:[2, 3] });
const SOFT = Object.freeze({ cuerpo:350 });
const LETTERS = ['A', 'B', 'C'];
const BUTTON = { es:'Enviar mensaje de WhatsApp', en:'Send WhatsApp message' };
const TEXT_FIELDS = ['gancho', 'cuerpo', 'titulo', 'descripcion'];

const BANNED = [
  [/\bbarat|\blow[- ]?cost\b|\bcheap|\bbest price\b|\bmejor precio\b|\bprecio m[aá]s bajo\b|\blowest price\b/i, 'no compitas por precio («barato», «low cost», «mejor precio»)'],
  [/[úu]ltimos cupos|[úu]ltimas plazas|solo quedan|last (?:few )?spots|only \d+ (?:spots|seats) left|hurry/i, 'urgencia o escasez sin respaldo'],
  [/#[\p{L}\p{N}_]/u, 'los anuncios no llevan hashtags'],
  [/https?:\/\/|www\.|wa\.me/i, 'la URL va en el campo de destino, no en el texto'],
];
// Cifra con moneda: «$350», «USD 350», «S/ 1200», «350 soles», «350 dólares».
const PRICE = /(?:US\$|\$|USD|S\/\.?|PEN|€)\s?(\d[\d.,]*)|(\d[\d.,]*)\s?(?:USD|soles|d[oó]lares|dollars|PEN|€)/gi;

const nonEmpty = v => typeof v === 'string' && v.trim().length > 0;
const pendingMarks = text => String(text || '').match(/\[FALTA DATO:[^\]]+\]/gi) || [];
const digitsOf = n => String(n).replace(/[.,]/g, '');

// sourcesText: texto de la información aprobada y páginas usadas. Una cifra con moneda solo
// es válida si aparece en esas fuentes; así el anuncio no inventa precios.
function validate(x, { idioma, sourcesText = null, ready = false } = {}) {
  const errors = [], warnings = [];
  if (x?.format !== 'anuncio_meta' || x?.version !== 1) errors.push('format/version: requiere anuncio_meta versión 1');
  if (idioma && x?.idioma !== idioma) errors.push(`idioma: debe ser ${idioma}`);
  if (!['es', 'en'].includes(x?.idioma)) errors.push('idioma: es o en');
  const variants = Array.isArray(x?.variantes) ? x.variantes : [];
  if (variants.length < LIMITS.variantes[0] || variants.length > LIMITS.variantes[1]) errors.push(`variantes: se requieren ${LIMITS.variantes.join('–')}`);
  const sources = sourcesText == null ? null : digitsOf(sourcesText);
  variants.forEach((v, i) => {
    const path = `variante ${LETTERS[i] || i + 1}`;
    if (!nonEmpty(v?.angulo)) errors.push(`${path}.angulo: obligatorio`);
    for (const field of ['gancho', 'titulo']) if (!nonEmpty(v?.[field])) errors.push(`${path}.${field}: obligatorio`);
    for (const field of ['cuerpo', 'descripcion']) if (v?.[field] != null && typeof v[field] !== 'string') errors.push(`${path}.${field}: debe ser texto`);
    for (const field of TEXT_FIELDS) {
      const text = String(v?.[field] || '');
      if (text.length > LIMITS[field]) errors.push(`${path}.${field}: ${text.length} caracteres, máximo ${LIMITS[field]}`);
      else if (SOFT[field] && text.length > SOFT[field]) warnings.push(`${path}.${field}: ${text.length} caracteres; se recomiendan ${SOFT[field]} o menos para que se lea completo`);
      for (const [rule, message] of BANNED) if (rule.test(text)) errors.push(`${path}.${field}: ${message}`);
      if (sources != null) for (const m of text.matchAll(PRICE)) if (!sources.includes(digitsOf(m[1] || m[2]))) errors.push(`${path}.${field}: precio «${m[0].trim()}» sin fuente aprobada`);
      if (ready && pendingMarks(text).length) errors.push(`${path}.${field}: contiene ${pendingMarks(text).join(' ')}`);
    }
  });
  const hooks = variants.map(v => String(v?.gancho || '').trim().toLowerCase()).filter(Boolean);
  if (new Set(hooks).size !== hooks.length) errors.push('variantes: cada una necesita un gancho distinto para poder compararlas');
  if (!Array.isArray(x?.pending) || x.pending.some(v => typeof v !== 'string')) errors.push('pending: requiere una lista de textos');
  if (ready && variants.some(v => !nonEmpty(v?.campaign_code))) errors.push('campaign_code: falta en alguna variante; regenera el anuncio');
  return { ok:!errors.length, errors, warnings };
}

// Precio opcional escrito por una persona al crear el anuncio: es su autorización para esta pieza.
// Debe ser una cifra con moneda, breve y sin lenguaje de descuento. El servidor lo coloca; la IA no lo redacta.
const PRICE_MAX = 40;
function normalizePrice(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const bad = m => { throw Object.assign(new Error(`Precio: ${m}`), { status:400 }); };
  if (text.length > PRICE_MAX) bad(`máximo ${PRICE_MAX} caracteres (ej. «Desde USD 890 por persona»)`);
  if (text.split(' ').length > 8) bad('máximo 8 palabras');
  if (!new RegExp(PRICE.source, 'i').test(text)) bad('incluye la cifra con su moneda (ej. USD 890, S/ 1200)');
  for (const [rule, message] of BANNED) if (rule.test(text)) bad(message);
  return text;
}
// Con precio confirmado, el pendiente «precio» que declare la IA ya no aplica.
const withoutPricePending = (pending, price) => price ? pending.filter(x => !/precio|price|tarifa|rate|cost/i.test(x)) : pending;

// Siguiente base libre por idioma: ADEN001, ADEN002… Se lee de los anuncios ya guardados.
function nextBase(db, idioma) {
  const prefix = `AD${String(idioma).toUpperCase()}`;
  let max = 0;
  for (const row of db.prepare("SELECT contenido FROM generated WHERE tipo='anuncio_meta'").all()) {
    let base; try { base = JSON.parse(row.contenido).codigo_base; } catch { continue; }
    const m = String(base || '').match(new RegExp(`^${prefix}(\\d+)$`));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

function destinationUrl(url, base, letter) {
  if (!url) return null;
  const u = new URL(url);
  u.searchParams.set('utm_source', 'meta');
  u.searchParams.set('utm_medium', 'paid_social');
  u.searchParams.set('utm_campaign', base.toLowerCase());
  u.searchParams.set('utm_content', letter.toLowerCase());
  return u.toString();
}

function whatsappMessage(idioma, product, code, name) {
  return idioma === 'en'
    ? `Hi ${name}, I saw the ad for ${product} and I'd like to plan my trip. Code: ${code}`
    : `Hola ${name}, vi el anuncio de ${product} y quiero planificar mi viaje. Código: ${code}`;
}

// Completa lo que no decide la IA. Idempotente para una misma base: regenerar conserva los códigos.
function finalize(x, { base, tour, contactName = 'Deicy', precio = null }) {
  const product = tour?.title || x.producto || 'Tikaymi';
  const variantes = x.variantes.map((v, i) => {
    const code = `${base}${LETTERS[i]}`;
    const clean = Object.fromEntries(TEXT_FIELDS.map(f => [f, String(v[f] || '').trim()]));
    return { id:LETTERS[i], angulo:String(v.angulo).trim(), ...clean,
      texto_principal:[clean.gancho, clean.cuerpo].filter(Boolean).join('\n\n'),
      campaign_code:code, mensaje_whatsapp:whatsappMessage(x.idioma, product, code, String(contactName).trim().split(/\s+/)[0] || 'Deicy'),
      url_destino:destinationUrl(tour?.url, base, LETTERS[i]) };
  });
  const pending = [...new Set([...withoutPricePending(x.pending || [], precio), ...(tour?.url ? [] : ['[FALTA DATO: página del tour en tikaymi.com para el enlace «Más información»; elige un tour aprobado en el brief]'])])];
  return { format:'anuncio_meta', version:1, idioma:x.idioma, producto:product, codigo_base:base,
    precio, objetivo_meta:'Mensajes (Click to WhatsApp)', ubicaciones:['facebook', 'instagram'], boton:BUTTON[x.idioma],
    variantes, pending, warnings:[...(x.warnings || []),
      'Crea un anuncio por variante dentro del mismo conjunto de anuncios y pega su mensaje precargado en «Mensaje predeterminado»; así cada consulta llega con su código.',
      'Registra cada consulta en Consultas con su código: sin lead atribuido no hay evidencia de conversión.'] };
}

const INSTRUCTIONS = [
  'Devuelve exclusivamente JSON: {"format":"anuncio_meta","version":1,"idioma":"","variantes":[{"angulo":"","gancho":"","cuerpo":"","titulo":"","descripcion":""}],"warnings":[],"pending":[]}.',
  'Son textos para un anuncio pagado de Meta (Facebook + Instagram) cuyo botón abre WhatsApp con Deicy. No es un post orgánico: no uses hashtags ni URLs, y como mucho un emoji por campo.',
  `Escribe 2 o 3 variantes. Cada una prueba un ángulo distinto que ayude a decidir (por ejemplo: logística resuelta, itinerario a medida, acompañamiento de Deicy antes y durante el viaje, cómo encajar los días), y lo declara en "angulo".`,
  `"gancho" (máximo ${LIMITS.gancho} caracteres, unas 18 palabras) es lo único visible antes de «ver más»: debe nombrar el viaje y el beneficio concreto. "cuerpo" (opcional, ${SOFT.cuerpo} caracteres o menos, unas 50 palabras en 2–3 frases) amplía con detalles operativos verificados. "titulo" (máximo ${LIMITS.titulo} caracteres, unas 6 palabras) va bajo la imagen. "descripcion" (opcional, máximo ${LIMITS.descripcion} caracteres, unas 4 palabras). Cuenta los caracteres antes de responder.`,
  'Prohibido: «barato», «low cost», «mejor precio», urgencia o escasez («últimos cupos»), superlativos sin respaldo, y afirmar o insinuar atributos personales del lector (salud, edad, ingresos). Un precio solo si aparece literal en la información aprobada.',
  'Si falta un dato que el anuncio necesitaba, no lo escribas en los textos: anótalo en "pending" con el formato [FALTA DATO: ...]. Los códigos de campaña, el botón, el mensaje de WhatsApp y el enlace los añade el sistema.',
].join('\n');

module.exports = { LIMITS, SOFT, BUTTON, INSTRUCTIONS, validate, finalize, nextBase, destinationUrl, normalizePrice, withoutPricePending };
