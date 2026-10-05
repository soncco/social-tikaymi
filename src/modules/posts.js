const C = require('../constants');

const REQUIRED = ['plataforma', 'titulo', 'objetivo_negocio', 'objetivo_marketing', 'objetivo_contenido', 'audiencia', 'etapa_embudo', 'cta', 'metrica_principal', 'idioma'];
const ENUMS = { plataforma: C.PLATAFORMAS, objetivo_negocio: C.OBJETIVOS_NEGOCIO, etapa_embudo: C.ETAPAS, objetivo_contenido: C.OBJETIVOS_CONTENIDO, idioma: C.IDIOMAS_HISTORICOS, estado: C.POST_ESTADOS };
const FIELDS = [...REQUIRED, 'external_id', 'fecha', 'formato', 'tema', 'campaign_code', 'estado'];
const BULK_FIELDS = ['objetivo_negocio', 'objetivo_marketing', 'objetivo_contenido', 'audiencia', 'etapa_embudo', 'cta', 'metrica_principal', 'idioma', 'formato', 'tema', 'campaign_code'];
const CLASSIFICATION_FIELDS = ['objetivo_negocio', 'objetivo_marketing', 'objetivo_contenido', 'audiencia', 'etapa_embudo', 'cta', 'metrica_principal', 'idioma'];
// Para incluir una publicación en comparaciones de negocio solo necesitamos
// saber qué resultado buscaba, para quién y en qué idioma. El resto enriquece
// el análisis/editorial, pero no debe bloquear al usuario histórico.
const ANALYSIS_CONTEXT_FIELDS = ['objetivo_negocio', 'audiencia', 'idioma'];
const AUDITED_FIELDS = [...CLASSIFICATION_FIELDS, 'tema'];
const missingClassification = post => CLASSIFICATION_FIELDS.filter(k => !String(post[k] ?? '').trim() || post[k] === 'sin_clasificar');
const missingAnalysisContext = post => ANALYSIS_CONTEXT_FIELDS.filter(k => !String(post[k] ?? '').trim() || post[k] === 'sin_clasificar');

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
  if (AUDITED_FIELDS.some(k => k in body && body[k] !== cur[k])) {
    db.prepare('UPDATE post_classification_audit SET manually_modified_at=CURRENT_TIMESTAMP WHERE post_id=?').run(id);
  }
}

// Clasificación masiva de publicaciones importadas. A diferencia de update(),
// acepta avanzar por partes: el usuario puede asignar hoy el tema y mañana el
// CTA sin tener que completar diez campos en una sola pantalla.
function bulkUpdate(db, ids, body, { overwrite = false } = {}) {
  const cleanIds = [...new Set((Array.isArray(ids) ? ids : []).map(Number).filter(Number.isInteger))];
  if (!cleanIds.length) throw Object.assign(new Error('Selecciona al menos una publicación'), { status: 400 });
  const cols = BULK_FIELDS.filter(k => k in body && body[k] !== '' && body[k] != null);
  if (!cols.length) throw Object.assign(new Error('Elige al menos un campo para aplicar'), { status: 400 });
  for (const [k, list] of Object.entries(ENUMS)) {
    if (k in body && !list.includes(body[k])) throw Object.assign(new Error(`Valor inválido en ${k}: ${body[k]}`), { status: 400 });
  }
  const find = db.prepare('SELECT * FROM posts WHERE id=?');
  return db.transaction(() => {
    let updated = 0;
    let skippedExisting = 0;
    const missingByField = {};
    let remaining = 0;
    let selected = 0;
    for (const id of cleanIds) {
      const current = find.get(id);
      if (!current) continue;
      selected++;
      const changes = cols.filter(k => {
        if (current[k] === body[k]) return false;
        if (overwrite || current[k] == null || current[k] === '' || current[k] === 'sin_clasificar') return true;
        skippedExisting++;
        return false;
      });
      if (changes.length) {
        db.prepare(`UPDATE posts SET ${changes.map(k => k + '=?').join(',')} WHERE id=?`)
          .run(...changes.map(k => body[k]), id);
        if (changes.some(k => AUDITED_FIELDS.includes(k))) {
          db.prepare('UPDATE post_classification_audit SET manually_modified_at=CURRENT_TIMESTAMP WHERE post_id=?').run(id);
        }
        updated++;
      }
      const after = { ...current, ...Object.fromEntries(changes.map(k => [k, body[k]])) };
      const missing = missingClassification(after);
      if (missing.length) {
        remaining++;
        for (const k of missing) missingByField[k] = (missingByField[k] || 0) + 1;
      }
    }
    return { selected, updated, remaining, missing_by_field: missingByField, skipped_existing: skippedExisting };
  })();
}

module.exports = { create, update, bulkUpdate, validate, missingClassification, missingAnalysisContext, ANALYSIS_CONTEXT_FIELDS };
