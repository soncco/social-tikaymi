const C = require('../constants');

const REQUIRED = ['plataforma', 'titulo', 'objetivo_negocio', 'objetivo_marketing', 'objetivo_contenido', 'audiencia', 'etapa_embudo', 'cta', 'metrica_principal', 'idioma'];
const ENUMS = { plataforma: C.PLATAFORMAS, objetivo_negocio: C.OBJETIVOS_NEGOCIO, etapa_embudo: C.ETAPAS, objetivo_contenido: C.OBJETIVOS_CONTENIDO, idioma: C.IDIOMAS_HISTORICOS, estado: C.POST_ESTADOS };
const FIELDS = [...REQUIRED, 'external_id', 'fecha', 'formato', 'tema', 'campaign_code', 'estado'];
const BULK_FIELDS = ['objetivo_negocio', 'objetivo_marketing', 'objetivo_contenido', 'audiencia', 'etapa_embudo', 'cta', 'metrica_principal', 'idioma', 'formato', 'tema', 'campaign_code'];

// Regla del documento: no existe publicación sin objetivo, audiencia, etapa, CTA, métrica, plataforma e idioma.
function validate(body) {
  const missing = REQUIRED.filter(k => !String(body[k] ?? '').trim());
  if (missing.length) return `Faltan campos obligatorios: ${missing.join(', ')}`;
  for (const [k, list] of Object.entries(ENUMS)) if (body[k] != null && !list.includes(body[k])) return `Valor inválido en ${k}: ${body[k]}`;
  return null;
}

function create(db, body) {
  const err = validate(body);
  if (err) throw Object.assign(new Error(err), { status: 400 });
  if (!C.IDIOMAS.includes(body.idioma)) throw Object.assign(new Error('Una publicación nueva debe usar un solo idioma (es o en)'), { status: 400 });
  const cols = FIELDS.filter(k => body[k] != null);
  const r = db.prepare(`INSERT INTO posts(${cols}) VALUES(${cols.map(() => '?')})`).run(cols.map(k => body[k]));
  return r.lastInsertRowid;
}

function update(db, id, body) {
  const cur = db.prepare('SELECT * FROM posts WHERE id=?').get(id);
  if (!cur) throw Object.assign(new Error('No existe'), { status: 404 });
  const merged = { ...cur, ...body };
  const err = validate(merged);
  if (err) throw Object.assign(new Error(err), { status: 400 });
  const cols = FIELDS.filter(k => k in body);
  if (cols.length) db.prepare(`UPDATE posts SET ${cols.map(k => k + '=?')} WHERE id=?`).run([...cols.map(k => body[k]), id]);
}

// Clasificación masiva de publicaciones importadas. A diferencia de update(),
// acepta avanzar por partes: el usuario puede asignar hoy el tema y mañana el
// CTA sin tener que completar diez campos en una sola pantalla.
function bulkUpdate(db, ids, body) {
  const cleanIds = [...new Set((ids || []).map(Number).filter(Number.isInteger))];
  if (!cleanIds.length) throw Object.assign(new Error('Selecciona al menos una publicación'), { status: 400 });
  const cols = BULK_FIELDS.filter(k => k in body && body[k] !== '' && body[k] != null);
  if (!cols.length) throw Object.assign(new Error('Elige al menos un campo para aplicar'), { status: 400 });
  for (const [k, list] of Object.entries(ENUMS)) {
    if (k in body && !list.includes(body[k])) throw Object.assign(new Error(`Valor inválido en ${k}: ${body[k]}`), { status: 400 });
  }
  const marks = cleanIds.map(() => '?').join(',');
  const result = db.prepare(`UPDATE posts SET ${cols.map(k => k + '=?').join(',')} WHERE id IN (${marks})`)
    .run(...cols.map(k => body[k]), ...cleanIds);
  return { updated: result.changes };
}

module.exports = { create, update, bulkUpdate, validate };
