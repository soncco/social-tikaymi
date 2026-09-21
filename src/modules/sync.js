// Sincronización manual de estadísticas vía API oficial (Instagram). La dispara una persona
// (POST /api/sync/:plataforma); nunca corre sola. Sólo lee: no publica nada.
const { getAdapter } = require('../adapters');
const { METRICS } = require('../db');

const MIN_HORAS = 20; // contrato: como mucho una vez al día por publicación
const AVISO_DIAS = 7;

async function syncStats(db, plataforma, { force = false, limit = 25, fetchImpl, credentials } = {}) {
  const adapter = getAdapter(plataforma);
  if (!['instagram', 'facebook'].includes(plataforma) || !adapter?.fetchStats) {
    throw Object.assign(new Error(`Sincronización por API no disponible para: ${plataforma}`), { status: 400 });
  }
  const opts = { fetchImpl, credentials, plataforma };
  const token = await adapter.tokenStatus(opts);
  const res = { ok: true, nuevos: 0, actualizados: 0, omitidos: 0, errores: [], token };

  const list = await adapter.listRecent({ ...opts, limit });
  if (!list.ok) return { ...res, ok: false, errores: list.errors };

  const sel = db.prepare('SELECT p.id, m.captured_at FROM posts p LEFT JOIN metrics m ON m.post_id=p.id WHERE p.plataforma=? AND p.external_id=?');
  const ins = db.prepare(`INSERT INTO posts(plataforma, external_id, titulo, fecha, formato, objetivo_negocio, objetivo_marketing,
    objetivo_contenido, audiencia, etapa_embudo, cta, metrica_principal, idioma, estado)
    VALUES(?,?,?,?,?,'sin_clasificar','sin_clasificar','sin_clasificar','sin_clasificar','sin_clasificar','sin_clasificar','sin_clasificar','es','publicado')`);
  // COALESCE: lo que la API no devuelve no pisa datos ya importados por CSV (p. ej. clics).
  const up = db.prepare(`INSERT INTO metrics(post_id, ${METRICS.join(',')}) VALUES(?, ${METRICS.map(() => '?').join(',')})
    ON CONFLICT(post_id) DO UPDATE SET ${METRICS.map(m => `${m}=COALESCE(excluded.${m}, ${m})`).join(', ')}, captured_at=CURRENT_TIMESTAMP`);

  const pendientes = [];
  for (const it of list.items) {
    const ex = sel.get(plataforma, it.external_id);
    const reciente = ex?.captured_at && Date.now() - Date.parse(ex.captured_at.replace(' ', 'T') + 'Z') < MIN_HORAS * 36e5;
    if (reciente && !force) { res.omitidos++; continue; }
    pendientes.push({ ...it, id: ex?.id ?? null });
  }

  const stats = await adapter.fetchStats(pendientes, opts);
  res.errores = stats.errors;
  if (!stats.ok && !stats.items.length) res.ok = false;
  const byId = Object.fromEntries(pendientes.map(p => [p.external_id, p]));
  for (const s of stats.items) {
    const p = byId[s.external_id];
    let id = p.id;
    if (id) res.actualizados++;
    else { id = ins.run(plataforma, p.external_id, p.titulo, p.fecha, p.formato).lastInsertRowid; res.nuevos++; }
    up.run(id, ...METRICS.map(m => s[m] ?? null));
  }
  if (token.dias_restantes != null && token.dias_restantes <= AVISO_DIAS) res.aviso = `El token de Meta caduca en ${token.dias_restantes} día(s): renuévalo.`;
  if (token.code === 'credenciales_caducadas') res.aviso = 'El token de Meta caducó: genera uno nuevo.';
  return res;
}

module.exports = { syncStats };
