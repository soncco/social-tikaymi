// Preferencias comerciales declaradas por Tikaymi. No son resultados observados.
const DEFAULT = Object.freeze({
  priority_product: 'Viaje de 5 días por Cusco, Valle Sagrado y Machu Picchu',
  priority_tour_url: 'https://tikaymi.com/tour/tour-5-dias-city-tour-valle-machupicchu-vinincunca/',
  primary_audience: 'Viajeros internacionales que planean su primera visita a Perú y necesitan coordinar boletos, trenes, altura y traslados',
  secondary_audience: 'Viajeros hispanohablantes que comparan tours de un día o rutas cortas desde Cusco',
  contact_name: 'Deicy Ayala',
});
// Datos de contacto declarados por Tikaymi. Opcionales: si faltan, el copy no inventa un número.
const OPTIONAL = Object.freeze({ whatsapp_number:'' });

const RULES = Object.freeze({
  position: 'Agencia boutique de viajes personalizados por todo el Perú. Deicy diseña la ruta y coordina la logística antes y durante el viaje.',
  voice: 'Cálida, experta y concreta; segunda persona, frases breves y detalles operativos comprobados.',
  intent: 'Cada pieza ayuda a decidir o planificar un viaje: comparar opciones, elegir días, reservar entradas o trenes, preparar altura, equipaje y traslados.',
  avoid: 'Evitar contenido enciclopédico independiente, competir por precio, clichés turísticos y superlativos sin respaldo.',
  evidence: 'La prioridad del paquete de 5 días es una decisión comercial declarada; las métricas de redes muestran señales, no ventas sin consultas atribuidas.',
  reviews: 'Las reseñas y las cinco estrellas solo pueden mencionarse si hay una fuente real aprobada; nunca inventar testimonios, cifras o respaldo institucional.',
});

const err = message => Object.assign(new Error(message), { status:400 });

function get(db) {
  const raw = db.prepare("SELECT value FROM settings WHERE key='editorial_strategy'").get()?.value;
  let saved = {};
  if (raw) try { saved = JSON.parse(raw); } catch { /* mantener valores seguros */ }
  return { ...DEFAULT, ...OPTIONAL, ...saved, rules:RULES };
}

function update(db, body = {}) {
  const editable = Object.keys(DEFAULT);
  const next = {};
  for (const key of editable) {
    const value = String(body[key] ?? '').trim();
    if (!value || value.length > 350) throw err(`Completa ${key} (máximo 350 caracteres)`);
    next[key] = value;
  }
  const whatsapp = String(body.whatsapp_number ?? '').trim();
  const digits = whatsapp.replace(/\D/g, '');
  if (whatsapp && (!/^\+?[\d\s().-]+$/.test(whatsapp) || digits.length < 8 || digits.length > 15))
    throw err('El WhatsApp debe incluir código de país y solo números, por ejemplo +51 984 000 000');
  next.whatsapp_number = whatsapp;
  let url;
  try { url = new URL(next.priority_tour_url); } catch { throw err('La URL del producto prioritario no es válida'); }
  if (url.protocol !== 'https:' || url.hostname !== 'tikaymi.com' || !/^\/(?:en\/)?tour\//.test(url.pathname))
    throw err('El producto prioritario debe enlazar a un tour de Tikaymi.com');
  const set = db.prepare("INSERT INTO settings(key,value) VALUES('editorial_strategy',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
  set.run(JSON.stringify(next));
  return get(db);
}

// Línea de contacto verificable: el número sale de la configuración, nunca de la IA.
function contact(strategy, lang) {
  const digits = String(strategy.whatsapp_number || '').replace(/\D/g, '');
  if (!digits) return null;
  const shown = String(strategy.whatsapp_number).trim();
  return { digits, url:`https://wa.me/${digits}`, line: lang === 'en'
    ? `📲 WhatsApp ${strategy.contact_name}: ${shown} · wa.me/${digits}`
    : `📲 WhatsApp de ${strategy.contact_name}: ${shown} · wa.me/${digits}` };
}

function guidance(strategy, lang) {
  const whatsapp = contact(strategy, lang);
  const primary = lang === 'en';
  return [
    `Posicionamiento: ${RULES.position}`,
    `Persona de confianza: ${strategy.contact_name}; presentar su papel humano sin inventar testimonios.`,
    `Producto prioritario declarado: ${strategy.priority_product}. URL de referencia: ${strategy.priority_tour_url}.`,
    `Audiencia de esta versión: ${primary ? strategy.primary_audience : strategy.secondary_audience}.`,
    `Idioma y mercado: ${primary ? 'inglés para viajeros internacionales; adaptar preguntas y contexto, no traducir literalmente desde español' : 'español neutro para viajeros hispanohablantes'}.`,
    `Voz: ${RULES.voice}`,
    `Intención: ${RULES.intent}`,
    `Prohibiciones: ${RULES.avoid} No usar cheap, barato, low cost, ofertas, hidden gem, bucket list, unforgettable experience, mágico/místico ni the best sin respaldo.`,
    `CTA: invitar a escribir por WhatsApp a ${strategy.contact_name} con destino, fechas y cantidad de viajeros; adaptar el mensaje al tema.`,
    whatsapp ? `Contacto verificado para el cierre: WhatsApp ${strategy.whatsapp_number} (${whatsapp.url}). Cópialo exactamente.` : 'No hay número de WhatsApp configurado: no escribas ningún número ni enlace inventado.',
    `Prueba social: ${RULES.reviews}`,
  ].join('\n');
}

module.exports = { DEFAULT, RULES, get, update, guidance, contact };
