const test = require('node:test');
const assert = require('node:assert');
const { open } = require('../src/db');
const abtests = require('../src/modules/abtests');
const { weeklyDigest } = require('../src/modules/digest');
const schedule = require('../src/modules/schedule');
const { createApp } = require('../src/server');
const { makeAuth } = require('../src/modules/auth');

const BASE = {
  plataforma: 'instagram', objetivo_negocio: 'consulta_calificada', objetivo_marketing: 'resolver duda',
  objetivo_contenido: 'responder', audiencia: 'viajeros', etapa_embudo: 'consideracion',
  cta: 'WhatsApp', metrica_principal: 'consultas', idioma: 'es', estado: 'publicado',
};

function crearPost(db, over = {}) {
  const row = { ...BASE, titulo: 'Post', ...over };
  const cols = Object.keys(row);
  return db.prepare(`INSERT INTO posts(${cols}) VALUES(${cols.map(() => '?')})`).run(cols.map(k => row[k])).lastInsertRowid;
}
const metricas = (db, id, m) => {
  const cols = Object.keys(m);
  db.prepare(`INSERT INTO metrics(post_id,${cols}) VALUES(?,${cols.map(() => '?')})`).run(id, ...cols.map(k => m[k]));
};
const lead = (db, postId, estado) => db.prepare('INSERT INTO leads(post_id,estado) VALUES(?,?)').run(postId, estado);

// --- Esquema y migración -----------------------------------------------------

test('db: ab_tests existe y posts.programado_para se agrega por migración segura', () => {
  const db = open(':memory:');
  const cols = db.prepare('PRAGMA table_info(posts)').all().map(c => c.name);
  assert.ok(cols.includes('programado_para'));
  const ab = db.prepare('PRAGMA table_info(ab_tests)').all().map(c => c.name);
  assert.deepEqual(ab, ['id', 'nombre', 'variable', 'post_a', 'post_b', 'creado', 'conclusion']);

  // migrate() es idempotente: volver a ejecutarla no falla ni duplica la columna
  const { migrate } = require('../src/db');
  migrate(db);
  migrate(db);
  assert.equal(db.prepare('PRAGMA table_info(posts)').all().filter(c => c.name === 'programado_para').length, 1);
});

// --- A/B ---------------------------------------------------------------------

test('abtests.create: exige misma plataforma, variable válida y posts distintos', () => {
  const db = open(':memory:');
  const a = crearPost(db, { titulo: 'A', idioma: 'es' });
  const b = crearPost(db, { titulo: 'B', idioma: 'en' });
  const tk = crearPost(db, { titulo: 'TK', plataforma: 'tiktok' });

  assert.throws(() => abtests.create(db, { nombre: 'x', variable: 'color', post_a: a, post_b: b }), /variable inválida/);
  assert.throws(() => abtests.create(db, { nombre: 'x', variable: 'idioma', post_a: a, post_b: a }), /distintas/);
  assert.throws(() => abtests.create(db, { nombre: 'x', variable: 'idioma', post_a: a, post_b: tk }), /misma plataforma/);
  assert.throws(() => abtests.create(db, { variable: 'idioma', post_a: a, post_b: b }), /nombre/);

  const id = abtests.create(db, { nombre: 'es vs en', variable: 'idioma', post_a: a, post_b: b });
  assert.ok(id);
  assert.equal(abtests.list(db).length, 1);
});

test('abtests.evaluate: sin datos en un lado no hay ganador', () => {
  const db = open(':memory:');
  const a = crearPost(db, { titulo: 'A' });
  const b = crearPost(db, { titulo: 'B' });
  metricas(db, a, { saves: 40, shares: 10 });
  // B no tiene métricas ni leads
  const id = abtests.create(db, { nombre: 't', variable: 'hook', post_a: a, post_b: b });

  const r = abtests.evaluate(db, id);
  assert.equal(r.resultado, 'datos_insuficientes');
  assert.equal(r.ganador, null);
  assert.equal(r.confianza, 'datos_insuficientes');
  assert.match(r.motivo, /B/);
  // la conclusión queda persistida
  assert.match(db.prepare('SELECT conclusion FROM ab_tests WHERE id=?').get(id).conclusion, /sin conclusión/);
});

test('abtests.evaluate: post no publicado se considera dato insuficiente', () => {
  const db = open(':memory:');
  const a = crearPost(db, { titulo: 'A' });
  const b = crearPost(db, { titulo: 'B', estado: 'aprobado' });
  metricas(db, a, { saves: 10 });
  metricas(db, b, { saves: 99 });
  const id = abtests.create(db, { nombre: 't', variable: 'cta', post_a: a, post_b: b });
  const r = abtests.evaluate(db, id);
  assert.equal(r.resultado, 'datos_insuficientes');
  assert.match(r.motivo, /aprobado/);
});

test('abtests.evaluate: gana por intención, nunca por me gusta', () => {
  const db = open(':memory:');
  const a = crearPost(db, { titulo: 'A' });
  const b = crearPost(db, { titulo: 'B' });
  // A tiene muchísimos likes pero poca intención; B gana por intención.
  metricas(db, a, { likes: 5000, saves: 10, shares: 2, clicks: 1 });
  metricas(db, b, { likes: 3, saves: 80, shares: 30, clicks: 20 });
  const id = abtests.create(db, { nombre: 'hooks', variable: 'hook', post_a: a, post_b: b });

  const r = abtests.evaluate(db, id);
  assert.equal(r.resultado, 'ganador');
  assert.equal(r.ganador, 'b');
  assert.equal(r.post_ganador, b);
  assert.equal(r.base_decision, 'intencion_total');
  assert.equal(r.confianza, 'senal_inicial', 'sin leads atribuidos no pasa de señal inicial');
  assert.equal(JSON.stringify(r).includes('likes'), false, 'los me gusta no aparecen en la evaluación');
  assert.equal(r.a.intencion.total, 13);
  assert.equal(r.b.intencion.total, 130);
});

test('abtests.evaluate: el negocio manda sobre la intención', () => {
  const db = open(':memory:');
  const a = crearPost(db, { titulo: 'A' });
  const b = crearPost(db, { titulo: 'B' });
  metricas(db, a, { saves: 5, shares: 1 });
  metricas(db, b, { saves: 500, shares: 400 });
  // A generó consultas reales; B ninguna.
  lead(db, a, 'calificado');
  lead(db, a, 'reservado');
  lead(db, b, 'nuevo');
  const id = abtests.create(db, { nombre: 'cta', variable: 'cta', post_a: a, post_b: b });

  const r = abtests.evaluate(db, id);
  assert.equal(r.base_decision, 'consultas_atribuidas');
  assert.equal(r.ganador, 'a');
  assert.equal(r.confianza, 'patron_probable');
  assert.notEqual(r.confianza, 'patron_confirmado', 'con dos publicaciones nunca hay patrón confirmado');
  assert.equal(r.a.negocio.consultas, 2);
  assert.equal(r.a.negocio.reservas, 1);
  assert.equal(r.b.negocio.consultas, 0);
});

test('abtests.evaluate: diferencia pequeña es empate', () => {
  const db = open(':memory:');
  const a = crearPost(db, { titulo: 'A' });
  const b = crearPost(db, { titulo: 'B' });
  metricas(db, a, { saves: 100 });
  metricas(db, b, { saves: 95 });
  const id = abtests.create(db, { nombre: 'formatos', variable: 'formato', post_a: a, post_b: b });
  const r = abtests.evaluate(db, id);
  assert.equal(r.resultado, 'empate');
  assert.equal(r.ganador, null);
  assert.match(r.motivo, /umbral/);
});

test('abtests.evaluate: plataformas distintas tras editar el post cortan la comparación', () => {
  const db = open(':memory:');
  const a = crearPost(db, { titulo: 'A' });
  const b = crearPost(db, { titulo: 'B' });
  metricas(db, a, { saves: 10 });
  metricas(db, b, { saves: 100 });
  const id = abtests.create(db, { nombre: 't', variable: 'idioma', post_a: a, post_b: b });
  db.prepare("UPDATE posts SET plataforma='tiktok' WHERE id=?").run(b);

  const r = abtests.evaluate(db, id);
  assert.equal(r.resultado, 'datos_insuficientes');
  assert.match(r.motivo, /plataformas distintas/);
});

test('abtests.evaluate: prueba inexistente da 404', () => {
  const db = open(':memory:');
  assert.throws(() => abtests.evaluate(db, 999), e => e.status === 404);
});

// --- Digest ------------------------------------------------------------------

test('digest.weeklyDigest: combina análisis, alertas y cohortes con confianza explícita', () => {
  const db = open(':memory:');
  const hoy = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < 6; i++) {
    const id = crearPost(db, { titulo: `Humantay ${i}`, tema: 'humantay', fecha: hoy });
    metricas(db, id, { saves: 10 + i, shares: i, likes: 999, retention: 0.4 + i / 100 });
    if (i < 2) lead(db, id, 'calificado');
  }
  const md = weeklyDigest(db);

  assert.match(md, /^# Resumen periódico Tikaymi/);
  assert.match(md, /Confianza global/);
  assert.match(md, /## 1\. Negocio/);
  assert.match(md, /## 2\. Conversión atribuida/);
  assert.match(md, /## 3\. Mejores publicaciones \(sin me gusta\)/);
  assert.match(md, /## 4\. Cohortes de leads por semana/);
  assert.match(md, /## 5\. Alertas abiertas/);
  assert.match(md, /## 6\. Recomendaciones calificadas por confianza/);
  assert.match(md, /cron externo/);
  // Toda recomendación queda bajo un encabezado de nivel de confianza
  const seccion = md.split('## 6.')[1].split('## 7.')[0];
  assert.ok(/### (datos insuficientes|señal inicial|patrón probable|patrón confirmado)/.test(seccion));
});

test('digest.weeklyDigest: base vacía no inventa conclusiones', () => {
  const db = open(':memory:');
  const md = weeklyDigest(db);
  assert.match(md, /datos insuficientes/);
  assert.match(md, /no se emiten conclusiones/);
  assert.match(md, /Sin leads registrados/);
});

// --- Programación manual -----------------------------------------------------

test('schedule: sólo programa posts aprobados', () => {
  const db = open(':memory:');
  const borrador = crearPost(db, { titulo: 'B', estado: 'borrador' });
  const aprobado = crearPost(db, { titulo: 'A', estado: 'aprobado' });

  assert.throws(() => schedule.schedule(db, borrador, '2026-02-14T09:30:00Z'), e => e.status === 409);
  assert.throws(() => schedule.schedule(db, aprobado, 'mañana'), /inválido/);
  assert.throws(() => schedule.schedule(db, aprobado, ''), /obligatorio/);
  assert.throws(() => schedule.schedule(db, 999, '2026-02-14'), e => e.status === 404);

  const r = schedule.schedule(db, aprobado, '2026-02-14T09:30:00Z');
  assert.equal(r.programado_para, '2026-02-14T09:30:00.000Z');
  assert.equal(r.estado, 'programado');
  const row = db.prepare('SELECT estado, programado_para FROM posts WHERE id=?').get(aprobado);
  assert.equal(row.estado, 'programado');
  assert.equal(row.programado_para, '2026-02-14T09:30:00.000Z');

  const lista = schedule.list(db);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].id, aprobado);
});

test('schedule.icsCalendar: exporta un iCal válido con recordatorio', () => {
  const db = open(':memory:');
  const id = crearPost(db, { titulo: 'Humantay; guía, completa', estado: 'aprobado', campaign_code: 'HUMANTAY' });
  schedule.schedule(db, id, '2026-02-14T09:30:00Z');

  const ics = schedule.icsCalendar(db, { ahora: new Date('2026-02-01T00:00:00Z') });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
  assert.match(ics, /BEGIN:VEVENT/);
  assert.match(ics, /DTSTART:20260214T093000Z/);
  assert.match(ics, new RegExp(`UID:tikaymi-post-${id}@tikaymi`));
  assert.match(ics, /TRIGGER:-PT30M/);
  assert.match(ics, /SUMMARY:Publicar: Humantay\\; guía\\, completa \(instagram\)/, 'escapa ; y ,');
  assert.match(ics, /no publica automáticamente/);
  assert.equal(ics.split('BEGIN:VEVENT').length - 1, 1);
});

test('schedule.icsCalendar: calendario vacío sigue siendo válido', () => {
  const ics = schedule.icsCalendar(open(':memory:'));
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.ok(!ics.includes('BEGIN:VEVENT'));
});

// --- Rutas -------------------------------------------------------------------

test('API fase 3b: abtests, digest.md, schedule y schedule.ics', async () => {
  const db = open(':memory:');
  const srv = createApp(db, makeAuth({ password: 'pw', secret: 's' })).listen(0);
  const url = `http://localhost:${srv.address().port}/api`;
  let ck = '';
  const j = (p, o = {}) => fetch(url + p, { ...o, headers: { 'content-type': 'application/json', cookie: ck }, body: o.body && JSON.stringify(o.body) });

  try {
    ck = (await j('/login', { method: 'POST', body: { password: 'pw' } })).headers.get('set-cookie').split(';')[0];

    const a = crearPost(db, { titulo: 'A' });
    const b = crearPost(db, { titulo: 'B' });
    metricas(db, a, { saves: 10, likes: 900 });
    metricas(db, b, { saves: 90 });

    // A/B
    assert.equal((await j('/abtests', { method: 'POST', body: { nombre: 'x', variable: 'nope', post_a: a, post_b: b } })).status, 400);
    const { id } = await (await j('/abtests', { method: 'POST', body: { nombre: 'hooks', variable: 'hook', post_a: a, post_b: b } })).json();
    assert.ok(id);
    assert.equal((await (await j('/abtests')).json()).length, 1);
    const ev = await (await j(`/abtests/${id}/evaluate`)).json();
    assert.equal(ev.ganador, 'b');
    assert.equal((await j('/abtests/999/evaluate')).status, 404);

    // Digest
    const dig = await j('/digest.md');
    assert.match(dig.headers.get('content-type'), /text\/markdown/);
    assert.match(await dig.text(), /# Resumen periódico Tikaymi/);

    // Programación manual
    const pub = crearPost(db, { titulo: 'Publicado ya', estado: 'publicado' });
    assert.equal((await j(`/posts/${pub}/schedule`, { method: 'PUT', body: { programado_para: '2026-03-01T10:00:00Z' } })).status, 409);

    const ap = crearPost(db, { titulo: 'Listo', estado: 'aprobado' });
    const okRes = await j(`/posts/${ap}/schedule`, { method: 'PUT', body: { programado_para: '2026-03-01T10:00:00Z' } });
    assert.equal(okRes.status, 200);
    assert.equal((await okRes.json()).estado, 'programado');

    const lista = await (await j('/schedule')).json();
    assert.equal(lista.length, 1);
    assert.equal(lista[0].programado_para, '2026-03-01T10:00:00.000Z');

    const ics = await j('/schedule.ics');
    assert.match(ics.headers.get('content-type'), /text\/calendar/);
    assert.match(await ics.text(), /DTSTART:20260301T100000Z/);
  } finally { srv.close(); }
});
