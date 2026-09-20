// Módulo de IA y contenido (Inicial.MD §8, §9, §10 y §14 Fase 2).
// Regla central: la IA solo puede usar información aprobada de Tikaymi. Nunca inventa.
const C = require('../constants');
const llm = require('./llm');
const { validate } = require('./posts');
const { analyze } = require('./analysis');
const { carouselExport, LAYOUTS } = require('./export');

const err = (status, message) => Object.assign(new Error(message), { status });

const PROHIBIDO = 'precios, disponibilidad, horarios, servicios, resultados, reseñas, testimonios, estadísticas ni condiciones de viaje';

// Instrucciones por tipo de pieza (§9).
const INSTRUCCIONES = {
  copy: 'Escribe un copy para la publicación con gancho, cuerpo breve y el CTA indicado. Devuelve solo el texto.',
  guion: [
    'Escribe el guion del reel. Reglas obligatorias:',
    '- Google Flow Omni genera clips de ~10 segundos: divide el guion en clips de ese largo.',
    '- Cada clip indica qué fotografía de referencia usa (solo de la lista de recursos disponibles).',
    '- El reel no puede ser silencioso: planifica voz, diálogo o narración y subtítulos explícitos.',
    '- Killa no es obligatoria: úsala solo si aporta valor y nunca siempre en apertura y cierre.',
    '- Varía la estructura narrativa; no repitas siempre apertura, explicación y cierre.',
  ].join('\n'),
  prompt_flow: [
    'Escribe los prompts para Google Flow. Reglas obligatorias:',
    '- Un prompt por clip de ~10 segundos.',
    '- Indica en cada clip la fotografía de referencia (solo de la lista de recursos disponibles).',
    '- Planifica voz/narración y subtítulos por clip: el reel no debe quedar silencioso.',
    '- Killa no es obligatoria en apertura ni cierre; inclúyela solo si aporta valor.',
    '- Varía la estructura narrativa entre clips.',
  ].join('\n'),
  carrusel: null, // se construye abajo con los layouts reales del constructor
  whatsapp: 'Escribe respuestas para WhatsApp acordes al CTA y a la etapa del embudo. Solo información aprobada; si falta un dato, indica que se consultará con el equipo.',
  ab: 'Propone una prueba A/B: variante A, variante B, qué cambia exactamente, hipótesis y métrica de éxito. Una sola variable por prueba.',
};

const instruccionCarrusel = () => [
  'Devuelve ÚNICAMENTE un JSON válido, sin texto alrededor y sin bloques de código, con esta forma:',
  '{"tipo":"producto|informativo","slides":[{"layout":"<id>","data":{"titulo":"...","texto":"..."}}]}',
  'Usa entre 3 y 5 diapositivas (nunca 7 por defecto) y cada una debe aportar una idea nueva.',
  `Layouts válidos para "producto": ${LAYOUTS.producto.join(', ')}.`,
  `Layouts válidos para "informativo": ${LAYOUTS.informativo.join(', ')}.`,
].join('\n');

function reglasTestimonios(info) {
  const hayTestimonio = info.some(i => i.tipo === 'testimonio');
  return hayTestimonio
    ? 'Testimonios: usa exclusivamente el texto real y autorizado que aparece en la información aprobada. Si no hay video, trátalo como testimonio textual (fotografía real + texto real) y dilo explícitamente. Jamás inventes un testimonio ni un nombre.'
    : 'Testimonios: no hay ninguno autorizado, así que no incluyas ni insinúes testimonios, reseñas ni opiniones de clientes.';
}

function resumenAnalisis(db) {
  try {
    const a = analyze(db, {});
    const r = a.resumen;
    return [
      `Publicaciones analizadas: ${r.publicaciones}; consultas: ${r.consultas}; cotizaciones: ${r.cotizaciones}; reservas: ${r.reservas}.`,
      `Confianza de los datos: ${r.confianza}.`,
      `Recomendación de idioma: ${a.idioma?.recomendacion ?? 'sin datos'}.`,
      a.recomendaciones.length ? `Recomendaciones vigentes: ${a.recomendaciones.map(x => x.formato_y_por_que).join(' | ')}` : 'Sin recomendaciones: datos insuficientes.',
    ].join('\n');
  } catch {
    return 'Sin análisis disponible.';
  }
}

// El prompt solo contiene información aprobada. Nada más entra aquí.
function buildPrompt(db, { post, tipo, idioma }) {
  const info = db.prepare('SELECT * FROM approved_info WHERE autorizado_publicar = 1 ORDER BY id').all();
  if (!info.length) throw err(422, 'No hay información aprobada de Tikaymi (approved_info con autorizado_publicar=1). Carga servicios, precios o testimonios verificables antes de generar contenido.');
  const assets = db.prepare('SELECT * FROM assets ORDER BY id').all();

  const sistema = [
    'Eres el asistente de contenido de Tikaymi, agencia de viajes en Cusco.',
    `Usa ÚNICAMENTE la información aprobada y los recursos listados. Nunca inventes ${PROHIBIDO}.`,
    'Si falta un dato para cumplir la petición, escríbelo como "[FALTA DATO: ...]" en lugar de suponerlo.',
    `Toda la pieza va en un solo idioma: ${idioma === 'en' ? 'inglés' : 'español'}. Nunca mezcles idiomas dentro de la misma pieza.`,
    'El resultado pasa siempre por aprobación humana antes de publicarse.',
  ].join('\n');

  const L = [];
  L.push('## Publicación');
  L.push(`Título: ${post.titulo}`, `Plataforma: ${post.plataforma}`, `Formato: ${post.formato ?? 'no definido'}`,
    `Objetivo de negocio: ${post.objetivo_negocio}`, `Objetivo de marketing: ${post.objetivo_marketing}`,
    `Objetivo de contenido: ${post.objetivo_contenido}`, `Audiencia: ${post.audiencia}`,
    `Etapa del embudo: ${post.etapa_embudo}`, `CTA: ${post.cta}`, `Métrica principal: ${post.metrica_principal}`,
    `Idioma de la pieza: ${idioma}`);
  L.push('', '## Información aprobada de Tikaymi (única fuente de verdad)');
  for (const i of info) L.push(`- [${i.tipo}] ${i.titulo}: ${i.texto}${i.fuente ? ` (fuente: ${i.fuente})` : ''}`);
  L.push('', '## Recursos disponibles (fotografías y videos reales)');
  if (assets.length) for (const a of assets) L.push(`- [${a.tipo}] ${a.url} — ${a.descripcion ?? 'sin descripción'}${a.destino ? ` (destino: ${a.destino})` : ''}`);
  else L.push('- No hay fotografías ni videos disponibles: no describas material visual inexistente.');
  L.push('', '## Resumen del análisis de datos', resumenAnalisis(db));
  L.push('', '## Qué debes generar', tipo === 'carrusel' ? instruccionCarrusel() : INSTRUCCIONES[tipo]);
  L.push('', '## Restricciones', `No inventes ${PROHIBIDO}.`, reglasTestimonios(info));

  return { sistema, prompt: L.join('\n') };
}

const quitarCercas = t => t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

async function generate(db, { post_id, tipo, idioma } = {}, { fetchImpl } = {}) {
  if (!C.CONTENIDO_TIPOS.includes(tipo)) throw err(400, `tipo inválido: ${tipo}. Válidos: ${C.CONTENIDO_TIPOS.join(', ')}`);
  const post = db.prepare('SELECT * FROM posts WHERE id=?').get(post_id);
  if (!post) throw err(404, 'La publicación no existe');

  // (a) Sin objetivo, audiencia, etapa, CTA, métrica, plataforma e idioma no se genera nada.
  const faltan = validate(post);
  if (faltan) throw err(400, `No se puede generar contenido: ${faltan}`);

  // Una pieza = un solo idioma (§10).
  const lang = idioma ?? post.idioma;
  if (!C.IDIOMAS.includes(lang)) throw err(400, `idioma inválido: ${lang}. Una pieza usa un solo idioma (es o en).`);

  // (b) Prompt con información aprobada + recursos + análisis; 422 si no hay info aprobada.
  const partes = buildPrompt(db, { post, tipo, idioma: lang });

  // (c) Llamada a la API de Anthropic.
  const texto = (await llm.complete(db, partes, fetchImpl)).texto;

  let contenido = texto;
  if (tipo === 'carrusel') {
    let json;
    try { json = JSON.parse(quitarCercas(texto)); } catch (e) {
      console.error('[content] carrusel: JSON inválido de la IA:', e.message);
      throw err(502, 'La IA no devolvió un JSON de carrusel válido.');
    }
    contenido = JSON.stringify(carouselExport(json), null, 2); // valida tipo, layouts y 3-5 diapositivas
  }

  // (d) Siempre nace en revisión: nunca 'publicado'.
  const id = db.prepare('INSERT INTO generated(post_id,tipo,idioma,contenido,estado) VALUES(?,?,?,?,?)')
    .run(post.id, tipo, lang, contenido, 'revision').lastInsertRowid;
  return { id, post_id: post.id, tipo, idioma: lang, estado: 'revision', contenido };
}

// Aprobación humana manual. 'publicado' nunca es un estado válido aquí.
function setEstado(db, id, estado) {
  if (!C.GENERADO_ESTADOS.includes(estado)) throw err(400, `estado inválido: ${estado}. Válidos: ${C.GENERADO_ESTADOS.join(', ')}`);
  const r = db.prepare('UPDATE generated SET estado=? WHERE id=?').run(estado, id);
  if (!r.changes) throw err(404, 'No existe el contenido generado');
  return { id: Number(id), estado };
}

module.exports = { generate, setEstado, buildPrompt };
