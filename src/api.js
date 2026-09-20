const { Router } = require('express');
const C = require('./constants');
const posts = require('./modules/posts');
const { buildLinks } = require('./modules/attribution');
const exporter = require('./modules/export');
const analysis = require('./modules/analysis');
const { importCsv } = require('./modules/importer');
const { autoClassify } = require('./modules/themes');
const { alerts } = require('./modules/alerts');
const { cohorts } = require('./modules/cohorts');

const content = require('./modules/content');

const wrap = fn => (req, res, next) => { try { res.json(fn(req, res) ?? { ok: true }); } catch (e) { next(e); } };
const wrapAsync = fn => async (req, res, next) => { try { res.json((await fn(req, res)) ?? { ok: true }); } catch (e) { next(e); } };

function api(db) {
  const r = Router();
  r.get('/constants', wrap(() => C));

  // Objetivos de negocio por período
  r.get('/objectives', wrap(() => db.prepare('SELECT * FROM objectives ORDER BY id DESC').all()));
  r.post('/objectives', wrap(req => {
    const { periodo, objetivo_negocio, meta } = req.body;
    if (!periodo || !C.OBJETIVOS_NEGOCIO.includes(objetivo_negocio)) throw Object.assign(new Error('periodo y objetivo_negocio válidos son obligatorios'), { status: 400 });
    return { id: db.prepare('INSERT INTO objectives(periodo,objetivo_negocio,meta) VALUES(?,?,?)').run(periodo, objetivo_negocio, meta ?? null).lastInsertRowid };
  }));

  // Publicaciones (siempre con objetivo)
  r.get('/posts', wrap(() => db.prepare('SELECT p.*, m.reach, m.plays, m.likes, m.saves FROM posts p LEFT JOIN metrics m ON m.post_id=p.id ORDER BY fecha DESC, p.id DESC').all()));
  r.post('/posts', wrap(req => ({ id: posts.create(db, req.body) })));
  r.put('/posts/:id', wrap(req => posts.update(db, req.params.id, req.body)));
  r.delete('/posts/:id', wrap(req => db.prepare('DELETE FROM posts WHERE id=?').run(req.params.id) && undefined));

  // Leads
  r.get('/leads', wrap(() => db.prepare('SELECT * FROM leads ORDER BY id DESC').all()));
  r.post('/leads', wrap(req => {
    const b = req.body;
    if (b.estado && !C.LEAD_ESTADOS.includes(b.estado)) throw Object.assign(new Error('estado inválido'), { status: 400 });
    const post = b.campaign_code && db.prepare('SELECT id FROM posts WHERE campaign_code=?').get(b.campaign_code);
    const id = db.prepare('INSERT INTO leads(post_id,campaign_code,fuente,estado,fecha_viaje,viajeros,notas) VALUES(?,?,?,?,?,?,?)')
      .run(b.post_id ?? post?.id ?? null, b.campaign_code ?? null, b.fuente ?? null, b.estado ?? 'nuevo', b.fecha_viaje ?? null, b.viajeros ?? null, b.notas ?? null).lastInsertRowid;
    return { id, atribuido: !!(b.post_id ?? post) };
  }));
  r.put('/leads/:id', wrap(req => {
    if (!C.LEAD_ESTADOS.includes(req.body.estado)) throw Object.assign(new Error('estado inválido'), { status: 400 });
    db.prepare('UPDATE leads SET estado=? WHERE id=?').run(req.body.estado, req.params.id);
  }));

  // Análisis (confianza explícita, sin mezclar plataformas)
  r.get('/analysis', wrap(req => analysis.analyze(db, { periodo: req.query.periodo })));

  // Exportación: informe Markdown y JSON compatible con el constructor de carruseles
  r.get('/report.md', (req, res, next) => { try { res.type('text/markdown').send(exporter.reportMarkdown(db, { periodo: req.query.periodo })); } catch (e) { next(e); } });
  r.post('/export/carousel', wrap(req => exporter.carouselExport(req.body)));

  r.post('/links', wrap(req => buildLinks(req.body)));

  // Aprendizajes
  r.get('/learnings', wrap(() => db.prepare('SELECT * FROM learnings ORDER BY id DESC').all()));
  r.post('/learnings', wrap(req => ({ id: db.prepare('INSERT INTO learnings(texto,post_id) VALUES(?,?)').run(req.body.texto, req.body.post_id ?? null).lastInsertRowid })));

  // Importar CSV
  r.post('/import/:plataforma', wrap(req => {
    if (!req.body.csv) throw Object.assign(new Error('csv field es obligatorio'), { status: 400 });
    const plataforma = req.params.plataforma;
    if (!C.PLATAFORMAS.includes(plataforma)) throw Object.assign(new Error(`plataforma no válida: ${plataforma}`), { status: 400 });
    const result = importCsv(db, plataforma, req.body.csv);
    if (result.errors.length > 0) {
      result.errors.forEach(err => console.error(`[import ${plataforma}] ${err}`));
    }
    return result;
  }));

  // Fase 2 — Biblioteca de información aprobada de Tikaymi
  r.get('/approved-info', wrap(() => db.prepare('SELECT * FROM approved_info ORDER BY id DESC').all()));
  r.post('/approved-info', wrap(req => {
    const b = req.body;
    if (!C.INFO_TIPOS.includes(b.tipo)) throw Object.assign(new Error(`tipo inválido: ${b.tipo}`), { status: 400 });
    if (!String(b.titulo ?? '').trim() || !String(b.texto ?? '').trim()) throw Object.assign(new Error('titulo y texto son obligatorios'), { status: 400 });
    return { id: db.prepare('INSERT INTO approved_info(tipo,titulo,texto,autorizado_publicar,fuente) VALUES(?,?,?,?,?)')
      .run(b.tipo, b.titulo, b.texto, b.autorizado_publicar ? 1 : 0, b.fuente ?? null).lastInsertRowid };
  }));
  r.put('/approved-info/:id', wrap(req => {
    const r2 = db.prepare('UPDATE approved_info SET autorizado_publicar=? WHERE id=?').run(req.body.autorizado_publicar ? 1 : 0, req.params.id);
    if (!r2.changes) throw Object.assign(new Error('No existe'), { status: 404 });
  }));
  r.delete('/approved-info/:id', wrap(req => db.prepare('DELETE FROM approved_info WHERE id=?').run(req.params.id) && undefined));

  // Fase 2 — Biblioteca de fotografías y videos reales
  r.get('/assets', wrap(() => db.prepare('SELECT * FROM assets ORDER BY id DESC').all()));
  r.post('/assets', wrap(req => {
    const b = req.body;
    if (!C.ASSET_TIPOS.includes(b.tipo)) throw Object.assign(new Error(`tipo inválido: ${b.tipo}`), { status: 400 });
    if (!String(b.url ?? '').trim()) throw Object.assign(new Error('url es obligatoria'), { status: 400 });
    return { id: db.prepare('INSERT INTO assets(tipo,url,descripcion,destino) VALUES(?,?,?,?)')
      .run(b.tipo, b.url, b.descripcion ?? null, b.destino ?? null).lastInsertRowid };
  }));
  r.delete('/assets/:id', wrap(req => db.prepare('DELETE FROM assets WHERE id=?').run(req.params.id) && undefined));

  // Fase 2 — Generación con IA (siempre queda en revisión; aprobación humana manual)
  r.get('/generated', wrap(req => (req.query.post_id
    ? db.prepare('SELECT * FROM generated WHERE post_id=? ORDER BY id DESC').all(req.query.post_id)
    : db.prepare('SELECT * FROM generated ORDER BY id DESC').all())));
  r.post('/generate', wrapAsync(req => content.generate(db, req.body, {})));
  r.put('/generated/:id', wrap(req => content.setEstado(db, req.params.id, req.body.estado)));

  // Clasificación automática de temas
  r.post('/themes/auto', wrap(req => autoClassify(db)));

  // Alertas objetivas
  r.get('/alerts', wrap(req => alerts(db)));

  // Cohorts de leads
  r.get('/cohorts', wrap(req => cohorts(db)));

  return r;
}
module.exports = { api };
