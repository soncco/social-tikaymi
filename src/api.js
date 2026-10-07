const { Router } = require('express');
const C = require('./constants');
const posts = require('./modules/posts');
const { buildLinks } = require('./modules/attribution');
const llm = require('./modules/llm');
const exporter = require('./modules/export');
const analysis = require('./modules/analysis');
const { importCsv } = require('./modules/importer');
const { autoClassify } = require('./modules/themes');
const { alerts } = require('./modules/alerts');
const { cohorts } = require('./modules/cohorts');
const abtests = require('./modules/abtests');
const { weeklyDigest } = require('./modules/digest');
const scheduleMod = require('./modules/schedule');

const { syncStats } = require('./modules/sync');
const content = require('./modules/content');
const planner = require('./modules/planner');
const site = require('./modules/site');
const editorialStrategy = require('./modules/editorial-strategy');
const revisions = require('./modules/revisions');
const visualReview = require('./modules/visual-review');
const metricsMod = require('./modules/metrics');

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
  r.get('/posts', wrap(() => db.prepare(`SELECT p.*, m.reach, m.plays, m.likes, m.saves,
    a.source AS classification_source, a.confidence AS classification_confidence,
    a.rationale AS classification_rationale, a.manually_modified_at AS classification_modified_at
    FROM posts p LEFT JOIN metrics m ON m.post_id=p.id
    LEFT JOIN post_classification_audit a ON a.post_id=p.id
    ORDER BY fecha DESC, p.id DESC`).all()));
  r.post('/posts', wrap(req => ({ id: posts.create(db, req.body) })));
  r.put('/posts/bulk', wrap(req => {
    const body = req.body || {};
    return posts.bulkUpdate(db, body.ids, body.fields || {}, { overwrite: body.overwrite === true });
  }));
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
    return revisions.recordLeadTransition(db, req.params.id, req.body.estado);
  }));

  // Snapshots inmutables para conservar la historia de métricas importadas.
  r.post('/metrics/snapshot', wrap(req => {
    const postId = req.body?.post_id;
    const row = db.prepare('SELECT * FROM metrics WHERE post_id=?').get(postId);
    if (!row) throw Object.assign(new Error('No hay métricas para esa publicación'), { status: 404 });
    return metricsMod.snapshotIfChanged(db, postId) || { duplicated: true, post_id: Number(postId) };
  }));
  r.get('/metrics/snapshots', wrap(req => req.query.post_id
    ? db.prepare('SELECT * FROM metric_snapshots WHERE post_id=? ORDER BY id DESC').all(req.query.post_id)
    : db.prepare('SELECT * FROM metric_snapshots ORDER BY id DESC').all()));

  // Análisis (confianza explícita, sin mezclar plataformas)
  r.get('/analysis', wrap(req => analysis.analyze(db, req.query)));

  // Exportación: informe Markdown y JSON compatible con el constructor de carruseles
  r.get('/report.md', (req, res, next) => { try { res.type('text/markdown').send(exporter.reportMarkdown(db, { periodo: req.query.periodo })); } catch (e) { next(e); } });
  r.post('/export/carousel', wrap(req => exporter.carouselExport(req.body)));

  r.post('/links', wrap(req => buildLinks(req.body)));

  // Administrador de proveedores de IA (las claves solo en .env)
  r.get('/llm', wrap(() => llm.status(db)));
  r.put('/llm', wrap(req => llm.configure(db, req.body)));

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

  // Sincronizar estadísticas por API oficial: instagram | facebook (acción manual, sólo lectura)
  r.post('/sync/:plataforma', wrapAsync(req => syncStats(db, req.params.plataforma, { force: !!req.body?.force })));

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
    return { id: db.prepare('INSERT INTO assets(tipo,url,descripcion,destino,autorizado_publicar) VALUES(?,?,?,?,?)')
      .run(b.tipo, b.url, b.descripcion ?? null, b.destino ?? null, b.autorizado_publicar===true ? 1 : 0).lastInsertRowid };
  }));
  r.put('/assets/:id/approve', wrap(req=> {
    const result=db.prepare('UPDATE assets SET autorizado_publicar=? WHERE id=?').run(req.body.autorizado_publicar===true?1:0,req.params.id);
    if(!result.changes)throw Object.assign(new Error('Recurso inexistente'),{status:404});
    return {ok:true};
  }));
  r.delete('/assets/:id', wrap(req => db.prepare('DELETE FROM assets WHERE id=?').run(req.params.id) && undefined));

  // Copia manual del sitio público; nunca autoriza automáticamente una página.
  r.get('/site/status', wrap(() => site.status(db)));
  r.get('/site/pages', wrap(req => site.list(db, req.query)));
  r.post('/site/sync', wrapAsync(() => site.sync(db)));
  r.put('/site/approve', wrap(req => site.approve(db, req.body?.url, req.body?.approved)));
  r.put('/site/approve-batch', wrap(req => site.approveBatch(db, req.body || {})));
  r.get('/editorial-strategy', wrap(() => editorialStrategy.get(db)));
  r.put('/editorial-strategy', wrap(req => editorialStrategy.update(db, req.body)));

  // Fase 2 — Generación con IA (siempre queda en revisión; aprobación humana manual)
  r.get('/generated', wrap(req => content.list(db, req.query).map(row=>({...row,visual_review:['imagen_unica','carrusel'].includes(row.tipo)?visualReview.inspect(db,row):null}))));
  r.post('/generate', wrapAsync(req => content.generate(db, req.body, {})));
  r.post('/generate-package', wrapAsync(req => content.generatePackage(db, req.body, {})));
  r.get('/visual-failures', wrap(() => db.prepare('SELECT * FROM failed_visual_reviews ORDER BY id DESC LIMIT 30').all()));
  r.post('/generated/:id/render-validation', wrap(req => visualReview.record(db,req.params.id,req.body)));
  r.put('/generated/:id', wrap(req => content.setEstado(db, req.params.id, req.body.estado, req.body.revisor || req.headers['x-reviewer'] || null)));
  r.get('/generated/:id/versions', wrap(req => revisions.versions(db, req.params.id)));
  r.get('/generated/:id/approvals', wrap(req => db.prepare('SELECT * FROM approval_events WHERE generated_id=? ORDER BY id DESC').all(req.params.id)));
  r.get('/generated/:id/parts', wrap(req => db.prepare('SELECT * FROM generated_parts WHERE generated_id=? ORDER BY clip_number').all(req.params.id)));
  r.get('/editorial-examples', wrap(() => db.prepare('SELECT * FROM editorial_examples ORDER BY id DESC').all()));
  r.post('/editorial-examples', wrap(req => {
    const b = req.body || {};
    const generated = db.prepare("SELECT id,tipo,contenido,estado FROM generated WHERE id=?").get(b.generated_id);
    if (!generated || generated.estado !== 'aprobado') throw Object.assign(new Error('Solo se puede guardar como ejemplo contenido aprobado'), { status: 400 });
    if (!String(b.etiqueta || '').trim()) throw Object.assign(new Error('etiqueta es obligatoria'), { status: 400 });
    const id = db.prepare('INSERT INTO editorial_examples(generated_id,tipo,etiqueta,contenido) VALUES(?,?,?,?)')
      .run(generated.id, generated.tipo, String(b.etiqueta).trim(), generated.contenido).lastInsertRowid;
    return { id: Number(id) };
  }));
  r.get('/generated/:id/publications', wrap(req => db.prepare('SELECT * FROM generated_publications WHERE generated_id=? ORDER BY published_at DESC').all(req.params.id)));
  r.post('/generated/:id/publications', wrap(req => {
    const generated = db.prepare('SELECT id,estado FROM generated WHERE id=?').get(req.params.id);
    const post = db.prepare('SELECT id,plataforma FROM posts WHERE id=?').get(req.body?.post_id);
    if (!generated || !post) throw Object.assign(new Error('Contenido o publicación inexistente'), { status: 404 });
    if (generated.estado !== 'aprobado') throw Object.assign(new Error('Solo se puede vincular contenido aprobado'), { status: 400 });
    const id = db.prepare('INSERT INTO generated_publications(generated_id,post_id,plataforma) VALUES(?,?,?) ON CONFLICT(generated_id,post_id) DO UPDATE SET published_at=CURRENT_TIMESTAMP')
      .run(generated.id, post.id, post.plataforma).lastInsertRowid;
    return { id: Number(id), generated_id: Number(generated.id), post_id: Number(post.id), plataforma: post.plataforma };
  }));
  r.post('/generated/:id/feedback', wrap(req => revisions.feedback(db, req.params.id, req.body || {})));
  r.put('/generated/:id/edit', wrap(req => revisions.edit(db, req.params.id, req.body || {})));
  r.post('/generated/:id/regenerate', wrapAsync(req => revisions.regenerate(db, req.params.id, req.body || {}, { content, fetchImpl: req.app?.locals?.fetchImpl })));

  // Plan editorial: propuesta calculada con señales observadas y límites explícitos.
  r.get('/plans/preview', wrap(req => planner.preview(db, req.query)));
  r.get('/plans', wrap(() => planner.list(db)));
  r.get('/plans/:id', wrap(req => planner.get(db, req.params.id)));
  r.post('/plans', wrapAsync(req => planner.create(db, req.body)));
  r.put('/plan-ideas/:id', wrap(req => planner.updateIdea(db, req.params.id, req.body)));

  // Clasificación automática de temas
  r.post('/themes/auto', wrap(req => autoClassify(db)));

  // Alertas objetivas
  r.get('/alerts', wrap(req => alerts(db)));

  // Cohorts de leads
  r.get('/cohorts', wrap(req => cohorts(db)));

  // Fase 3 — Pruebas A/B (misma plataforma, una sola variable, nunca por me gusta)
  r.get('/abtests', wrap(() => abtests.list(db)));
  r.post('/abtests', wrap(req => ({ id: abtests.create(db, req.body) })));
  r.get('/abtests/:id/evaluate', wrap(req => abtests.evaluate(db, req.params.id)));

  // Fase 3 — Recomendaciones periódicas (sin scheduler: llamar desde cron externo)
  r.get('/digest.md', (req, res, next) => {
    try { res.type('text/markdown').send(weeklyDigest(db, { periodo: req.query.periodo })); } catch (e) { next(e); }
  });

  // Fase 3 — Programación MANUAL (la app nunca publica sola)
  r.get('/schedule', wrap(() => scheduleMod.list(db)));
  r.put('/posts/:id/schedule', wrap(req => scheduleMod.schedule(db, req.params.id, req.body.programado_para)));
  r.get('/schedule.ics', (req, res, next) => {
    try { res.type('text/calendar').send(scheduleMod.icsCalendar(db)); } catch (e) { next(e); }
  });

  return r;
}
module.exports = { api };
