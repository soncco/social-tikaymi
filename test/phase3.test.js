const test = require('node:test');
const assert = require('node:assert');
const { open } = require('../src/db');
const { classify, autoClassify } = require('../src/modules/themes');
const { alerts } = require('../src/modules/alerts');
const { cohorts } = require('../src/modules/cohorts');

const dia = n => new Date(Date.UTC(2026, 0, n)).toISOString().slice(0, 10);
const ts = (d, h = 0) => new Date(Date.UTC(2026, 0, d, h, 0, 0)).toISOString();

test('themes.classify: detecta destinos por palabras clave', () => {
  assert.equal(classify('Laguna de Humantay'), 'humantay');
  assert.equal(classify('HUMANTAY y el viaje'), 'humantay');
  assert.equal(classify('Visita a Machu Picchu'), 'machu_picchu');
  assert.equal(classify('Rainbow Mountain Peru'), 'montaña_colores');
  assert.equal(classify('Montaña de Colores'), 'montaña_colores');
  assert.equal(classify('Valle Sagrado'), 'valle_sagrado');
  assert.equal(classify('Tour por Cusco'), 'cusco');
  assert.equal(classify('Vinicunca'), 'montaña_colores');
  assert.equal(classify('Ruta aleatoria'), null);
  assert.equal(classify(''), null);
  assert.equal(classify(null), null);
  assert.equal(classify(undefined), null);
});

test('themes.autoClassify: rellena tema en posts sin clasificar', () => {
  const db = open(':memory:');
  const base = {
    plataforma: 'instagram', objetivo_negocio: 'consulta_calificada',
    objetivo_marketing: 'resolver duda', objetivo_contenido: 'responder',
    audiencia: 'viajeros', etapa_embudo: 'consideracion',
    cta: 'WhatsApp', metrica_principal: 'consultas', idioma: 'es'
  };

  // Crear posts con tema NULL y sin_clasificar
  db.prepare(`INSERT INTO posts(titulo,tema,${Object.keys(base)}) VALUES(?,?,${Object.keys(base).map(() => '?')})`)
    .run('Humantay adventure', null, ...Object.values(base));
  db.prepare(`INSERT INTO posts(titulo,tema,${Object.keys(base)}) VALUES(?,?,${Object.keys(base).map(() => '?')})`)
    .run('Rainbow Mountain trek', 'sin_clasificar', ...Object.values(base));
  db.prepare(`INSERT INTO posts(titulo,tema,${Object.keys(base)}) VALUES(?,?,${Object.keys(base).map(() => '?')})`)
    .run('Random content', null, ...Object.values(base));

  const result = autoClassify(db);
  assert.equal(result.classified, 2, 'clasifica 2 posts (humantay y montaña)');
  assert.equal(result.total, 3);

  const posts = db.prepare('SELECT id, titulo, tema FROM posts ORDER BY id').all();
  assert.equal(posts[0].tema, 'humantay');
  assert.equal(posts[1].tema, 'montaña_colores');
  assert.equal(posts[2].tema, null, 'random content no es clasificado');
});

test('alerts: detecta posts publicados >7 días sin métricas', () => {
  const db = open(':memory:');
  const base = {
    plataforma: 'instagram', titulo: 'Test', objetivo_negocio: 'consulta_calificada',
    objetivo_marketing: 'resolver', objetivo_contenido: 'responder',
    audiencia: 'viajeros', etapa_embudo: 'consideracion', cta: 'WhatsApp',
    metrica_principal: 'consultas', idioma: 'es', estado: 'publicado'
  };

  // Post antiguo sin métricas
  const oldId = db.prepare(`INSERT INTO posts(fecha,${Object.keys(base)}) VALUES(?,${Object.keys(base).map(() => '?')})`)
    .run(dia(1), ...Object.values(base)).lastInsertRowid;

  // Post antiguo con métricas (no debe alertar)
  const withMetricsId = db.prepare(`INSERT INTO posts(fecha,${Object.keys(base)}) VALUES(?,${Object.keys(base).map(() => '?')})`)
    .run(dia(2), ...Object.values(base)).lastInsertRowid;
  db.prepare('INSERT INTO metrics(post_id, reach) VALUES(?, 100)').run(withMetricsId);

  // Post reciente sin métricas (no debe alertar)
  db.prepare(`INSERT INTO posts(fecha,${Object.keys(base)}) VALUES(?,${Object.keys(base).map(() => '?')})`)
    .run(dia(22), ...Object.values(base));

  const result = alerts(db);
  const postsAlert = result.find(a => a.tipo === 'post_sin_metricas');
  assert.ok(postsAlert, 'debe haber alerta de post sin métricas');
  assert.equal(postsAlert.ref.post_id, oldId);
});

test('alerts: detecta leads nuevos sin contactar >2 días', () => {
  const db = open(':memory:');

  // Lead nuevo pero reciente (no alerta)
  db.prepare(`INSERT INTO leads(estado, created_at) VALUES('nuevo', ?)`)
    .run(ts(28, 12));

  // Lead nuevo sin contactar >2 días
  db.prepare(`INSERT INTO leads(estado, created_at) VALUES('nuevo', ?)`)
    .run(ts(1, 0));

  // Lead en otro estado (no alerta)
  db.prepare(`INSERT INTO leads(estado, created_at) VALUES('contactado', ?)`)
    .run(ts(1, 0));

  const result = alerts(db);
  const leadAlert = result.find(a => a.tipo === 'lead_nuevo_sin_contacto');
  assert.ok(leadAlert, 'debe haber alerta de lead sin contacto');
  assert.ok(leadAlert.ref.dias > 2);
});

test('alerts: detecta posts sin clasificar', () => {
  const db = open(':memory:');
  const base = {
    plataforma: 'instagram', objetivo_negocio: 'consulta_calificada',
    objetivo_marketing: 'resolver', objetivo_contenido: 'responder',
    audiencia: 'viajeros', etapa_embudo: 'consideracion', cta: 'WhatsApp',
    metrica_principal: 'consultas', idioma: 'es'
  };

  db.prepare(`INSERT INTO posts(titulo,tema,${Object.keys(base)}) VALUES(?,?,${Object.keys(base).map(() => '?')})`)
    .run('Post 1', null, ...Object.values(base));
  db.prepare(`INSERT INTO posts(titulo,tema,${Object.keys(base)}) VALUES(?,?,${Object.keys(base).map(() => '?')})`)
    .run('Post 2', 'sin_clasificar', ...Object.values(base));

  const result = alerts(db);
  const classAlert = result.find(a => a.tipo === 'posts_sin_clasificar');
  assert.ok(classAlert);
  assert.equal(classAlert.ref.count, 2);
});

test('alerts: detecta período sin objetivo definido', () => {
  const db = open(':memory:');
  const base = {
    plataforma: 'instagram', titulo: 'Test', objetivo_negocio: 'consulta_calificada',
    objetivo_marketing: 'resolver', objetivo_contenido: 'responder',
    audiencia: 'viajeros', etapa_embudo: 'consideracion', cta: 'WhatsApp',
    metrica_principal: 'consultas', idioma: 'es', estado: 'publicado'
  };

  // Crear post reciente (fecha de hoy)
  const today = new Date().toISOString().slice(0, 10);
  const periodo = today.slice(0, 7);
  db.prepare(`INSERT INTO posts(fecha,${Object.keys(base)}) VALUES(?,${Object.keys(base).map(() => '?')})`)
    .run(today, ...Object.values(base));

  // Sin objetivo definido
  let result = alerts(db);
  const objAlert = result.find(a => a.tipo === 'periodo_sin_objetivo');
  assert.ok(objAlert, 'debe alertar período sin objetivo');

  // Agregar objetivo
  db.prepare('INSERT INTO objectives(periodo, objetivo_negocio) VALUES(?, ?)')
    .run(periodo, 'consulta_calificada');

  result = alerts(db);
  const noAlert = result.find(a => a.tipo === 'periodo_sin_objetivo');
  assert.ok(!noAlert, 'no debe alertar cuando hay objetivo');
});

test('cohorts: agrupa leads por semana con conversión', () => {
  const db = open(':memory:');

  // SQLite W01: 2026-01-05 to 2026-01-11
  // SQLite W02: 2026-01-12 to 2026-01-18

  // Week W02: 10 leads, 3 cotizados/reservados, tasa = 0.3
  for (let i = 0; i < 7; i++) {
    db.prepare('INSERT INTO leads(estado, created_at) VALUES(?, ?)')
      .run('nuevo', ts(12 + i, 10));
  }
  for (let i = 0; i < 3; i++) {
    db.prepare('INSERT INTO leads(estado, created_at) VALUES(?, ?)')
      .run(i < 2 ? 'cotizado' : 'reservado', ts(12 + i, 12));
  }

  // Week W03: 3 leads (insuficientes), tasa = null
  for (let i = 0; i < 3; i++) {
    db.prepare('INSERT INTO leads(estado, created_at) VALUES(?, ?)')
      .run('nuevo', ts(19 + i, 10));
  }

  const result = cohorts(db);
  const weeks = Object.keys(result).sort().reverse();

  assert.equal(weeks.length, 2);

  // Primera semana con suficientes datos
  const week1 = Object.values(result).find(w => w.total === 10);
  assert.ok(week1, `debe encontrar semana con 10 leads. Weeks: ${JSON.stringify(weeks)}`);
  assert.equal(week1.total, 10);
  assert.equal(week1.tasa_a_cotizado_reservado, 0.3);
  assert.ok(week1.datos_suficientes);

  // Segunda semana con datos insuficientes
  const week2 = Object.values(result).find(w => w.total === 3);
  assert.ok(week2, `debe encontrar semana con 3 leads. Weeks: ${JSON.stringify(weeks)}`);
  assert.equal(week2.total, 3);
  assert.equal(week2.tasa_a_cotizado_reservado, null, 'datos insuficientes');
  assert.ok(!week2.datos_suficientes);
});

test('cohorts: calcula conversión correctamente', () => {
  const db = open(':memory:');

  // 5 leads: 1 nuevo, 2 cotizados, 2 reservados
  db.prepare('INSERT INTO leads(estado, created_at) VALUES(?, ?)')
    .run('nuevo', ts(1, 10));
  db.prepare('INSERT INTO leads(estado, created_at) VALUES(?, ?)')
    .run('cotizado', ts(1, 11));
  db.prepare('INSERT INTO leads(estado, created_at) VALUES(?, ?)')
    .run('cotizado', ts(1, 12));
  db.prepare('INSERT INTO leads(estado, created_at) VALUES(?, ?)')
    .run('reservado', ts(2, 10));
  db.prepare('INSERT INTO leads(estado, created_at) VALUES(?, ?)')
    .run('reservado', ts(2, 11));

  const result = cohorts(db);
  const week = Object.values(result)[0];

  assert.equal(week.total, 5);
  assert.equal(week.por_estado.nuevo, 1);
  assert.equal(week.por_estado.cotizado, 2);
  assert.equal(week.por_estado.reservado, 2);
  assert.equal(week.tasa_a_cotizado_reservado, 0.8, '4 converted / 5 total');
});
