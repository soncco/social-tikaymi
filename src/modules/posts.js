const C = require('../constants');

const REQUIRED = ['plataforma', 'titulo', 'objetivo_negocio', 'objetivo_marketing', 'objetivo_contenido', 'audiencia', 'etapa_embudo', 'cta', 'metrica_principal', 'idioma'];
const ENUMS = { plataforma: C.PLATAFORMAS, objetivo_negocio: C.OBJETIVOS_NEGOCIO, etapa_embudo: C.ETAPAS, objetivo_contenido: C.OBJETIVOS_CONTENIDO, idioma: C.IDIOMAS, estado: C.POST_ESTADOS };
const FIELDS = [...REQUIRED, 'external_id', 'fecha', 'formato', 'tema', 'campaign_code', 'estado'];

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

module.exports = { create, update, validate };
