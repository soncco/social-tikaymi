// Textos de anuncio para Meta Ads (Facebook + Instagram). La IA redacta variantes;
// el servidor asigna códigos de campaña, mensaje precargado de WhatsApp y URL con UTM.
// Nunca se publica ni se lanza una campaña: el anuncio se arma a mano en el Administrador de anuncios.

// Límites de lo visible sin «ver más» y de los campos del Administrador de anuncios.
// El cuerpo queda oculto tras «ver más»: 350 es una recomendación (aviso) y solo 600 bloquea.
const LIMITS = Object.freeze({ gancho:125, cuerpo:600, titulo:25, descripcion:30, saludo:300, mensaje_whatsapp:80, variantes:[2, 3] });
const SOFT = Object.freeze({ cuerpo:350 });
// Business Suite: límites observados en la pantalla de Tikaymi (2026-10-09).
// Ads Manager: el título 40 es una recomendación editorial heredada, no un límite universal verificado.
const PROFILES = Object.freeze({
  business_suite: { label:'Business Suite simplificado', hard:{ titulo:25, saludo:300, mensaje_whatsapp:80, descripcion:30, gancho:125, cuerpo:600 }, soft:{ cuerpo:350 } },
  ads_manager: { label:'Ads Manager', hard:{ gancho:125, cuerpo:600 }, soft:{ titulo:40, descripcion:30, cuerpo:350 } },
});
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
const UNSUPPORTED = [
  [/t[úu] eliges el orden|you choose the order/i, 'verifica si el tour permite cambiar el orden del itinerario'],
  [/el cuerpo se adapta|your body (?:will )?adapt|garantiza (?:la )?aclimataci[oó]n/i, 'no garantices adaptación física ni aclimatación'],
];

const nonEmpty = v => typeof v === 'string' && v.trim().length > 0;
const pendingMarks = text => String(text || '').match(/\[FALTA DATO:[^\]]+\]/gi) || [];

// sourcesText: texto de la información aprobada y páginas usadas. Una cifra con moneda solo
// es válida si aparece en esas fuentes; así el anuncio no inventa precios.
function validate(x, { idioma, sourcesText = null, ready = false, prepared = false, profile, objective, productUrl } = {}) {
  const errors = [], warnings = [];
  if (x?.format !== 'anuncio_meta' || x?.version !== 1) errors.push('format/version: requiere anuncio_meta versión 1');
  if (idioma && x?.idioma !== idioma) errors.push(`idioma: debe ser ${idioma}`);
  if (!['es', 'en'].includes(x?.idioma)) errors.push('idioma: es o en');
  const variants = Array.isArray(x?.variantes) ? x.variantes : [];
  const selectedProfile = profile || x?.profile || 'business_suite';
  const rules = PROFILES[selectedProfile];
  if (!rules) errors.push('profile: elige Business Suite simplificado o Ads Manager');
  if (variants.length < LIMITS.variantes[0] || variants.length > LIMITS.variantes[1]) errors.push(`variantes: se requieren ${LIMITS.variantes.join('–')}`);
  const sources = sourcesText == null ? null : String(sourcesText);
  let expectedPrice=null;try{expectedPrice=priceText(x?.precio,x?.idioma);}catch(e){errors.push(e.message);}
  variants.forEach((v, i) => {
    const path = `variante ${LETTERS[i] || i + 1}`;
    if (!nonEmpty(v?.angulo)) errors.push(`${path}.angulo: obligatorio`);
    for (const field of ['gancho', 'titulo']) if (!nonEmpty(v?.[field])) errors.push(`${path}.${field}: obligatorio`);
    for (const field of ['cuerpo', 'descripcion']) if (v?.[field] != null && typeof v[field] !== 'string') errors.push(`${path}.${field}: debe ser texto`);
    for (const field of TEXT_FIELDS) {
      const text = String(v?.[field] || '');
      const hard = rules?.hard[field], soft = rules?.soft[field];
      if (hard && text.length > hard) errors.push(`${path}.${field}: ${text.length} caracteres, máximo ${hard}; acorta el texto`);
      else if (soft && text.length > soft) warnings.push(`${path}.${field}: ${text.length} caracteres; se recomiendan ${soft} o menos`);
      for (const [rule, message] of BANNED) if (rule.test(text)) errors.push(`${path}.${field}: ${message}`);
      for (const [rule, message] of UNSUPPORTED) if (rule.test(text) && !(sources && sources.toLowerCase().includes(text.toLowerCase()))) errors.push(`${path}.${field}: ${message} con una fuente aprobada o elimina la afirmación`);
      for (const m of text.matchAll(PRICE)) if (!expectedPrice?.includes(m[0].trim())) errors.push(`${path}.${field}: precio «${m[0].trim()}» sin precio confirmado para este producto`);
      if (ready && pendingMarks(text).length) errors.push(`${path}.${field}: contiene ${pendingMarks(text).join(' ')}`);
    }
    if (ready) {
      const msg = String(v?.mensaje_whatsapp || '');
      if (!msg) errors.push(`${path}.mensaje_whatsapp: obligatorio`);
      if (rules?.hard.mensaje_whatsapp && msg.length > rules.hard.mensaje_whatsapp) errors.push(`${path}.mensaje_whatsapp: ${msg.length} caracteres, máximo ${rules.hard.mensaje_whatsapp}; acorta el mensaje`);
      if (v?.campaign_code && !msg.includes(v.campaign_code)) errors.push(`${path}.mensaje_whatsapp: conserva el código ${v.campaign_code}`);
    }
  });
  const hooks = variants.map(v => String(v?.gancho || '').trim().toLowerCase()).filter(Boolean);
  if (new Set(hooks).size !== hooks.length) errors.push('variantes: cada una necesita un gancho distinto para poder compararlas');
  if (!Array.isArray(x?.pending) || x.pending.some(v => typeof v !== 'string')) errors.push('pending: requiere una lista de textos');
  if (ready && variants.some(v => !nonEmpty(v?.campaign_code))) errors.push('campaign_code: falta en alguna variante; regenera el anuncio');
  if (ready) {
    const greeting = String(x?.saludo || '');
    if (!greeting) errors.push('saludo: obligatorio');
    if (rules?.hard.saludo && greeting.length > rules.hard.saludo) errors.push(`saludo: ${greeting.length} caracteres, máximo ${rules.hard.saludo}; acorta el saludo`);
  }
  if ((objective || x?.objetivo_negocio) === 'cotizacion' && /reserva ahora|book now/i.test(String(x?.visual_cta || ''))) errors.push('visual_cta: para cotización usa «Cotiza tu viaje» o «Solicita una cotización»');
  errors.push(...validatePrice(x?.precio, { productUrl:productUrl || x?.product_url, prepared }));
  return { ok:!errors.length, errors, warnings };
}

// Precio opcional escrito por una persona al crear el anuncio: es su autorización para esta pieza.
// Debe ser una cifra con moneda, breve y sin lenguaje de descuento. El servidor lo coloca; la IA no lo redacta.
const PRICE_MAX = 40;
function normalizePrice(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const amount = Number(value.amount), currency = String(value.currency || '').toUpperCase();
    const mode = String(value.mode || ''), unit = String(value.unit || '');
    if (!Number.isFinite(amount) || amount <= 0) throw Object.assign(new Error('Precio: indica un importe mayor que cero'), { status:400 });
    if (!/^[A-Z]{3}$/.test(currency)) throw Object.assign(new Error('Precio: indica la moneda, por ejemplo USD o PEN'), { status:400 });
    if (!['desde','fijo'].includes(mode)) throw Object.assign(new Error('Precio: elige «desde» o «fijo»'), { status:400 });
    if (!['persona','grupo','otra'].includes(unit)) throw Object.assign(new Error('Precio: confirma la unidad (persona, grupo u otra)'), { status:400 });
    const price = { amount, currency, mode, unit, unit_detail:String(value.unit_detail || '').trim(), conditions:String(value.conditions || '').trim(), valid_until:String(value.valid_until || '').trim() || null,
      confirmation:String(value.confirmation || '').trim(), product_url:String(value.product_url || '').trim() };
    if(price.conditions.length>160)throw Object.assign(new Error('Precio: condiciones máximo 160 caracteres'),{status:400});
    if (unit==='otra'&&!price.unit_detail) throw Object.assign(new Error('Precio: describe la otra unidad'), { status:400 });
    if (price.valid_until && !/^\d{4}-\d{2}-\d{2}$/.test(price.valid_until)) throw Object.assign(new Error('Precio: vigencia debe tener formato AAAA-MM-DD'), { status:400 });
    priceText(price);
    return price;
  }
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const bad = m => { throw Object.assign(new Error(`Precio: ${m}`), { status:400 }); };
  if (text.length > PRICE_MAX) bad(`máximo ${PRICE_MAX} caracteres (ej. «Desde USD 890 por persona»)`);
  if (text.split(' ').length > 8) bad('máximo 8 palabras');
  if (!new RegExp(PRICE.source, 'i').test(text)) bad('incluye la cifra con su moneda (ej. USD 890, S/ 1200)');
  for (const [rule, message] of BANNED) if (rule.test(text)) bad(message);
  return text;
}
function priceText(price, lang = 'es') {
  if (!price) return null;
  if (typeof price === 'string') return price;
  const prefix = price.mode === 'desde' ? (lang === 'en' ? 'From ' : 'Desde ') : '';
  const unit = price.unit === 'persona' ? (lang === 'en' ? 'per person' : 'por persona') : price.unit === 'grupo' ? (lang === 'en' ? 'per group' : 'por grupo') : price.unit_detail;
  const result = `${prefix}${price.currency} ${price.amount}${unit ? ' · ' + unit : ''}`;
  if (result.length > PRICE_MAX) throw Object.assign(new Error('Precio: la etiqueta visual supera 40 caracteres; acórtala sin quitar la unidad'), { status:400 });
  return result;
}
function validatePrice(price, { productUrl, prepared = false } = {}) {
  if (!price) return [];
  if (typeof price === 'string') return prepared ? ['precio: el precio antiguo no tiene unidad ni condiciones confirmadas; complétalas'] : [];
  const errors = [];
  try { normalizePrice(price); } catch (e) { return [e.message]; }
  if (price.product_url && productUrl && price.product_url !== productUrl) errors.push('precio.product_url: no corresponde al tour seleccionado');
  if (prepared) {
    if (!price.product_url || !productUrl) errors.push('precio.product_url: confirma el tour al que corresponde el precio');
    if (!price.conditions) errors.push('precio.conditions: confirma las condiciones o escribe «Sin condiciones adicionales confirmadas»');
    if (!price.confirmation) errors.push('precio.confirmation: indica quién confirmó el precio o su fuente aprobada');
  }
  return errors;
}
// Una cifra confirmada resuelve solo el pendiente genérico de precio, no otros costos o condiciones.
const withoutPricePending = (pending, price) => price ? pending.filter(x => !/^\[FALTA DATO: (?:precio|price) del (?:paquete|tour)\]$/i.test(String(x).trim())) : pending;

// Siguiente base libre por idioma: ADEN001, ADEN002… Se lee de los anuncios ya guardados.
function nextBase(db, idioma) {
  const prefix = `AD${String(idioma).toUpperCase()}`;
  let max = 0;
  for (const row of db.prepare("SELECT contenido FROM generated WHERE tipo='anuncio_meta'").all()) {
    let base; try { base = JSON.parse(row.contenido).codigo_base; } catch { continue; }
    const m = String(base || '').match(new RegExp(`^${prefix}(\\d+)$`));
    if (m) max = Math.max(max, Number(m[1]));
  }
  for (const row of db.prepare('SELECT code FROM ad_variants').all()) {
    const m = String(row.code).match(new RegExp(`^${prefix}(\\d+)[A-C]$`));
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

function whatsappMessage(idioma, product, code) {
  const days = String(product).match(/(?:\b(\d+)\s*(?:d[ií]as|days|day)\b|\b(\d+)[- ]day\b)/i);
  const short = /cusco/i.test(product) && days ? (idioma === 'en' ? `Cusco ${days[1] || days[2]} days` : `Cusco de ${days[1] || days[2]} días`) : String(product).slice(0,28).replace(/\s+\S*$/,'');
  const message = idioma === 'en' ? `Hi, I'd like a quote for ${short}. Code: ${code}` : `Hola, quiero cotizar ${short}. Código: ${code}`;
  if (message.length <= LIMITS.mensaje_whatsapp) return message;
  return idioma === 'en' ? `Hi, I'd like a quote. Code: ${code}` : `Hola, quiero cotizar. Código: ${code}`;
}
function greeting(idioma, name) {
  const first = String(name || 'Deicy').trim().split(/\s+/)[0];
  return idioma === 'en' ? `Hi! I'm ${first} from Tikaymi. What month would you like to travel, and how many people are coming? With that, I can prepare your quote.`
    : `¡Hola! Soy ${first}, de Tikaymi. ¿En qué mes deseas viajar y cuántas personas son? Con esos datos podremos preparar tu cotización.`;
}

// Completa lo que no decide la IA. Idempotente para una misma base: regenerar conserva los códigos.
function finalize(x, { base, tour, contactName = 'Deicy', precio = null, profile = 'business_suite', objective = 'consulta_calificada' }) {
  const product = tour?.title || x.producto || 'Tikaymi';
  const variantes = x.variantes.map((v, i) => {
    const code = `${base}${LETTERS[i]}`;
    const clean = Object.fromEntries(TEXT_FIELDS.map(f => [f, String(v[f] || '').trim()]));
    if (precio && typeof precio==='object' && precio.conditions) clean.cuerpo=[clean.cuerpo,`${priceText(precio,x.idioma)}. ${precio.conditions}`].filter(Boolean).join('\n');
    return { id:LETTERS[i], angulo:String(v.angulo).trim(), ...clean,
      texto_principal:[clean.gancho, clean.cuerpo].filter(Boolean).join('\n\n'),
      campaign_code:code, mensaje_whatsapp:whatsappMessage(x.idioma, product, code),
      url_destino:destinationUrl(tour?.url, base, LETTERS[i]) };
  });
  const pending = [...new Set([...withoutPricePending(x.pending || [], precio), ...(tour?.url ? [] : ['[FALTA DATO: página del tour en tikaymi.com para el enlace «Más información»; elige un tour aprobado en el brief]'])])];
  return { format:'anuncio_meta', version:1, idioma:x.idioma, producto:product, product_url:tour?.url || null, codigo_base:base,
    precio, price_label:priceText(precio,x.idioma), profile, objetivo_negocio:objective, saludo:greeting(x.idioma,contactName), objetivo_meta:'Conversaciones por WhatsApp', ubicaciones:['facebook', 'instagram'], boton:BUTTON[x.idioma], boton_plantilla:null,
    variantes, pending, warnings:[...(x.warnings || []),
      'Crea un anuncio por variante dentro del mismo conjunto de anuncios y pega su mensaje precargado en «Mensaje predeterminado»; así cada consulta llega con su código.',
      'Registra cada consulta en Consultas con su código: sin lead atribuido no hay evidencia de conversión.'] };
}

const INSTRUCTIONS = [
  'Devuelve exclusivamente JSON: {"format":"anuncio_meta","version":1,"idioma":"","variantes":[{"angulo":"","gancho":"","cuerpo":"","titulo":"","descripcion":""}],"warnings":[],"pending":[]}.',
  'Son textos para un anuncio pagado de Meta (Facebook + Instagram) cuyo botón abre WhatsApp con Deicy. No es un post orgánico: no uses hashtags ni URLs, y como mucho un emoji por campo.',
  `Escribe 2 o 3 variantes. Cada una prueba un ángulo distinto que ayude a decidir (por ejemplo: logística resuelta, itinerario a medida, acompañamiento de Deicy antes y durante el viaje, cómo encajar los días), y lo declara en "angulo".`,
  `"gancho" (máximo ${LIMITS.gancho} caracteres) debe nombrar el viaje y un beneficio verificable. El texto visible depende de la ubicación; no hay un número fijo antes de «ver más». "cuerpo" (opcional, se recomiendan ${SOFT.cuerpo} caracteres o menos) amplía solo hechos verificados. "titulo" (máximo ${LIMITS.titulo} caracteres para Business Suite simplificado) va bajo la imagen. "descripcion" (máximo ${LIMITS.descripcion}). Cuenta los caracteres antes de responder.`,
  'Si el objetivo es cotización, invita a pedirla con fechas aproximadas y número de viajeros. No uses «Reserva ahora». No prometas cambio libre de itinerario ni aclimatación garantizada sin evidencia específica del tour.',
  'Prohibido: «barato», «low cost», «mejor precio», urgencia o escasez («últimos cupos»), superlativos sin respaldo, y afirmar o insinuar atributos personales del lector (salud, edad, ingresos). Un precio solo si aparece literal en la información aprobada.',
  'Si falta un dato que el anuncio necesitaba, no lo escribas en los textos: anótalo en "pending" con el formato [FALTA DATO: ...]. Los códigos de campaña, el botón, el mensaje de WhatsApp y el enlace los añade el sistema.',
].join('\n');

module.exports = { PROFILES, LIMITS, SOFT, BUTTON, INSTRUCTIONS, validate, validatePrice, finalize, nextBase, destinationUrl, normalizePrice, priceText, withoutPricePending, whatsappMessage, greeting };
