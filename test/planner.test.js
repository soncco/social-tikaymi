const test = require('node:test');
const assert = require('node:assert/strict');
const { open } = require('../src/db');
const planner = require('../src/modules/planner');
const strategy = require('../src/modules/editorial-strategy');
const content = require('../src/modules/content');
const { createApp } = require('../src/server');
const { makeAuth } = require('../src/modules/auth');

const withKey = async fn => {
  const old = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'test-key';
  try { return await fn(); } finally { old === undefined ? delete process.env.ANTHROPIC_API_KEY : process.env.ANTHROPIC_API_KEY = old; }
};
const fake = text => async () => ({ ok:true, status:200, json:async () => ({ content:[{ type:'text', text }] }) });

test('plan semanal y mensual separa las redes y declara ausencia de atribución', async () => {
  const db = open(':memory:');
  const weekly = planner.preview(db, { cadence:'semana', objetivo_negocio:'consulta_calificada' });
  assert.equal(weekly.ideas.length, 3);
  assert.deepEqual(weekly.ideas[0].platforms, ['instagram','facebook']);
  assert.deepEqual(weekly.ideas[1].platforms, ['tiktok','youtube_shorts']);
  assert.match(weekly.ideas[0].limitations, /No hay consultas atribuidas/);
  assert.equal(weekly.ideas[1].confidence, 'datos_insuficientes');
  assert.equal(planner.preview(db, { cadence:'mes' }).ideas.length, 8);
  const saved = await planner.create(db, { cadence:'semana' });
  assert.equal(saved.ideas.length, 3);
  assert.equal(saved.method, 'analisis');
  assert.equal(saved.ideas[0].status, 'propuesta');
  db.close();
});

test('la estrategia editorial activa idioma, audiencia, producto y CTA sin fingir conversiones', () => {
  const db = open(':memory:');
  const settings = { ...strategy.get(db), primary_audience:'Viajeros de prueba EN', secondary_audience:'Viajeros de prueba ES', contact_name:'Deicy Ayala' };
  strategy.update(db, settings);
  const esUrl = settings.priority_tour_url;
  const enUrl = esUrl.replace('tikaymi.com/', 'tikaymi.com/en/');
  const insert = db.prepare('INSERT INTO site_pages(url,lang,kind,title,content_hash,approved) VALUES(?,?,?,?,?,?)');
  insert.run(esUrl,'es','tour','Tour Cusco 5 días','a',0);
  insert.run(enUrl,'en','tour','Cusco 5-day tour','b',0);
  const ideas = planner.preview(db).ideas;
  assert.equal(ideas[0].source_url, enUrl);
  assert.equal(ideas[0].brief.idioma, 'en');
  assert.equal(ideas[0].brief.audiencia, 'Viajeros de prueba EN');
  assert.match(ideas[0].brief.cta, /Deicy Ayala.*WhatsApp/);
  assert.match(ideas[0].evidence, /Prioridad comercial declarada/);
  assert.match(ideas[0].evidence, /hipótesis para probar/);
  assert.equal(ideas[1].brief.idioma, 'es');
  assert.equal(ideas[1].brief.audiencia, 'Viajeros de prueba ES');
  assert.throws(() => strategy.update(db, { ...settings, priority_tour_url:'https://otro.com/tour/x' }), /Tikaymi.com/);
  db.close();
});

test('IA propone ángulos pero no puede modificar evidencia, plataformas ni confianza', async () => {
  const db = open(':memory:');
  const proposals = Array.from({ length:3 }, (_, i) => ({ title:`Ángulo ${i+1}`, objetivo_marketing:'resolver una duda', objetivo_contenido:'explicar', audiencia:'viajeros', cta:'Escríbenos' }));
  const saved = await withKey(() => planner.create(db, { cadence:'semana', use_ai:true }, { fetchImpl:fake(JSON.stringify(proposals)) }));
  assert.equal(saved.method, 'ia');
  assert.equal(saved.ideas[0].title, 'Ángulo 1');
  assert.match(saved.ideas[0].evidence, /No hay métricas de una publicación claramente relacionada/);
  assert.deepEqual(saved.ideas[0].platforms, ['instagram','facebook']);
  assert.notEqual(saved.ideas[0].brief.audiencia, 'viajeros');
  assert.match(saved.ideas[0].brief.cta, /Deicy/);
  await withKey(() => assert.rejects(() => planner.create(db, { use_ai:true }, { fetchImpl:fake('no json') }), /no devolvió un plan JSON válido/));
  assert.equal(db.prepare('SELECT count(*) n FROM editorial_plans').get().n, 1);
  db.close();
});

test('idea aprobada genera copy obligatorio y complemento; falla sin guardar parcialmente', async () => {
  const db = open(':memory:');
  db.prepare("INSERT INTO approved_info(tipo,titulo,texto,autorizado_publicar) VALUES('servicio','Humantay','Excursión a Humantay',1)").run();
  const plan = await planner.create(db, { cadence:'semana' });
  const id = plan.ideas[0].id;
  await withKey(() => assert.rejects(() => content.generatePackage(db, { plan_idea_id:id }, { fetchImpl:fake('Copy') }), /Aprueba la idea/));
  planner.updateIdea(db, id, { status:'aprobada', title:'Humantay', brief:{ cta:'Escríbenos HUMANTAY' } });
  const prompts = [];
  const capture = async (_url, opts) => {
    const prompt = JSON.parse(opts.body).messages[0].content;
    prompts.push(prompt);
    const guion = Array.from({ length:3 }, (_, i) => `### Clip ${i + 1}\nFunción: explicación\nDuración: 10 segundos\nDiálogo: “Planifica tu ruta con Deicy.”\n`).join('\n');
    return fake(prompt.includes('Módulo de guiones') ? guion : 'Texto')();
  };
  const result = await withKey(() => content.generatePackage(db, { plan_idea_id:id, extra:'guion' }, { fetchImpl:capture }));
  assert.equal(result.copy.tipo, 'copy');
  assert.equal(result.copies.length, 2, 'una copia por plataforma destino');
  assert.equal(result.additional.tipo, 'guion');
  assert.equal(result.copy.estado, 'revision');
  assert.match(prompts[0], /instagram, facebook/);
  assert.match(prompts[0], /copies se generarán en llamadas separadas/);
  assert.doesNotMatch(prompts[1], /instagram, facebook/);
  assert.match(prompts[1], /Plataforma única de esta salida: instagram/);
  assert.match(prompts[2], /Plataforma única de esta salida: facebook/);
  assert.equal(db.prepare('SELECT count(*) n FROM generated').get().n, 3);
  await withKey(() => assert.rejects(() => content.generatePackage(db, { plan_idea_id:id, extra:'carrusel' }, { fetchImpl:fake('No es JSON') }), /Carrusel incompleto.*revisión fallida/));
  assert.equal(db.prepare('SELECT count(*) n FROM generated').get().n, 3);
  db.close();
});

test('pieza nueva puede generar copy sin publicación de referencia', async () => {
  const db = open(':memory:');
  db.prepare("INSERT INTO approved_info(tipo,titulo,texto,autorizado_publicar) VALUES('servicio','Cusco','Viajes en Cusco',1)").run();
  const brief = { plataforma:'instagram', titulo:'Cusco', objetivo_negocio:'consulta_calificada', objetivo_marketing:'resolver duda', objetivo_contenido:'explicar', audiencia:'viajeros', etapa_embudo:'consideracion', cta:'Escríbenos', metrica_principal:'conversaciones', idioma:'es' };
  const result = await withKey(() => content.generatePackage(db, { brief }, { fetchImpl:fake('Copy') }));
  assert.equal(result.copy.post_id, null);
  assert.equal(result.copy.plan_idea_id, null);
  assert.equal(result.copy.contenido, 'Copy');
  db.close();
});

test('API permite previsualizar, guardar y aprobar una idea de plan', async () => {
  const db = open(':memory:');
  const server = createApp(db, makeAuth({ password:'pw', secret:'s' })).listen(0);
  const base = `http://localhost:${server.address().port}/api`;
  const request = (path, method = 'GET', body, cookie = '') => fetch(base + path, {
    method, headers:{ 'content-type':'application/json', cookie }, body:body && JSON.stringify(body),
  });
  try {
    const login = await request('/login','POST',{ password:'pw' });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const strategyRes = await request('/editorial-strategy','GET',null,cookie);
    assert.equal(strategyRes.status, 200);
    const strategyBody = await strategyRes.json();
    const savedStrategy = await request('/editorial-strategy','PUT',{
      ...strategyBody, primary_audience:'Viajeros internacionales con fechas definidas',
    },cookie);
    assert.equal(savedStrategy.status, 200);
    assert.equal((await savedStrategy.json()).primary_audience, 'Viajeros internacionales con fechas definidas');
    const preview = await (await request('/plans/preview?cadence=semana', 'GET', null, cookie)).json();
    assert.equal(preview.ideas.length, 3);
    assert.equal(preview.ideas[0].brief.audiencia, 'Viajeros internacionales con fechas definidas');
    const res = await request('/plans','POST',{ cadence:'semana', objetivo_negocio:'consulta_calificada' },cookie);
    assert.equal(res.status, 200);
    const plan = await res.json();
    assert.equal(plan.ideas.length, 3);
    const updated = await (await request('/plan-ideas/' + plan.ideas[0].id,'PUT',{ status:'aprobada', title:'Idea ajustada', planned_for:'2026-10-01' },cookie)).json();
    assert.equal(updated.ideas[0].status, 'aprobada');
    assert.equal(updated.ideas[0].planned_for, '2026-10-01');
    assert.equal(updated.ideas[0].brief.titulo, 'Idea ajustada');
  } finally { server.close(); db.close(); }
});

test('listado de planes resume ideas por estado y borradores conservan su origen', () => {
  const db = open(':memory:');
  const planId = db.prepare("INSERT INTO editorial_plans(cadence,objetivo_negocio) VALUES('semana','consulta_calificada')").run().lastInsertRowid;
  const empty = db.prepare("INSERT INTO editorial_plans(cadence,objetivo_negocio) VALUES('mes','confianza')").run().lastInsertRowid;
  const idea = (status, position) => db.prepare("INSERT INTO plan_ideas(plan_id,title,platforms,brief_json,evidence,limitations,confidence,status,position) VALUES(?,?,?,?,?,?,?,?,?)")
    .run(planId, 'Idea ' + position, '["instagram"]', '{}', 'e', 'l', 'datos_insuficientes', status, position).lastInsertRowid;
  const approved = idea('aprobada', 1); idea('propuesta', 2); idea('descartada', 3);
  const list = planner.list(db);
  assert.deepEqual(list.map(p => p.id), [Number(empty), Number(planId)]);
  assert.deepEqual([list[1].ideas_total, list[1].ideas_aprobadas, list[1].ideas_propuestas, list[1].ideas_descartadas], [3, 1, 1, 1]);
  assert.deepEqual([list[0].ideas_total, list[0].ideas_aprobadas], [0, 0]);
  db.prepare("INSERT INTO generated(plan_idea_id,tipo,idioma,contenido) VALUES(?,'copy','es','Texto')").run(approved);
  const pkg = db.prepare("INSERT INTO content_packages(brief_json,concept_json,primary_json,sources_json,resources_json,cta,warnings_json,pending_json,validations_json) VALUES(?,'{}','{}','[]','[]','cta','[]','[]','[]')").run(JSON.stringify({ titulo:'Brief libre' })).lastInsertRowid;
  db.prepare("INSERT INTO generated(package_id,tipo,idioma,contenido) VALUES(?,'copy','en','Text')").run(pkg);
  const rows = content.list(db);
  assert.deepEqual(rows.map(r => [r.origen, r.origen_titulo, r.plan_id ?? null]), [['brief','Brief libre',null], ['idea','Idea 1',Number(planId)]]);
  assert.equal(content.list(db, { post_id: 99 }).length, 0);
  db.close();
});
