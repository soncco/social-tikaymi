const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/server');
const { open, METRICS } = require('../src/db');
const { makeAuth } = require('../src/modules/auth');
const { importCsv } = require('../src/modules/importer');
const meta = require('../src/adapters/meta');
const tiktok = require('../src/adapters/tiktok');
const youtube = require('../src/adapters/youtube');

// Small CSV fixtures
const META_CSV = `Post ID,Post Date,Text,Post Type,Reach,Impressions,Likes,Comments,Shares,Saves,Profile Visits,Plays
123abc,2024-01-15,Humantay sunset,Video,500,1200,45,12,3,8,25,600`;

const TIKTOK_CSV = `Video ID,Post Date,Video Title,Plays,Likes,Comments,Shares,Saves,Profile Visits,Completion Rate
vid_456,2024-01-16,Cusco Travel Tips,800,120,20,15,50,40,65%`;

const YOUTUBE_CSV = `Video ID,Upload Date,Video Title,Impressions,Watch Time (minutes),Average Percentage Viewed,Likes,Comments,Shares
vid_789,2024-01-17,Peru Adventure,1000,250,45%,200,30,10`;

test('Adaptadores: Meta parse', () => {
  const rows = meta.parse(META_CSV);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].external_id, '123abc');
  assert.equal(rows[0].titulo, 'Humantay sunset');
  assert.equal(rows[0].reach, 500);
  assert.equal(rows[0].impressions, 1200);
  assert.equal(rows[0].plays, 600);
  assert.equal(rows[0].likes, 45);
  assert.equal(rows[0].comments, 12);
});

test('Adaptadores: TikTok parse', () => {
  const rows = tiktok.parse(TIKTOK_CSV);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].external_id, 'vid_456');
  assert.equal(rows[0].titulo, 'Cusco Travel Tips');
  assert.equal(rows[0].plays, 800);
  assert.equal(rows[0].retention, 65); // Completion Rate stored as retention
  assert.equal(rows[0].likes, 120);
});

test('Adaptadores: YouTube parse', () => {
  const rows = youtube.parse(YOUTUBE_CSV);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].external_id, 'vid_789');
  assert.equal(rows[0].titulo, 'Peru Adventure');
  assert.equal(rows[0].impressions, 1000);
  assert.equal(rows[0].retention, 45); // Average Percentage Viewed stored as retention
  assert.equal(rows[0].likes, 200);
});

test('Importer: new posts created with sin_clasificar defaults', () => {
  const db = open(':memory:');
  const result = importCsv(db, 'instagram', META_CSV);

  assert.equal(result.imported, 1);
  assert.equal(result.updated, 0);
  assert.equal(result.errors.length, 0);

  // Verify post was created with defaults
  const post = db.prepare('SELECT * FROM posts WHERE external_id = ?').get('123abc');
  assert.ok(post);
  assert.equal(post.objetivo_negocio, 'sin_clasificar');
  assert.equal(post.objetivo_marketing, 'sin_clasificar');
  assert.equal(post.objetivo_contenido, 'sin_clasificar');
  assert.equal(post.audiencia, 'sin_clasificar');
  assert.equal(post.etapa_embudo, 'sin_clasificar');
  assert.equal(post.cta, 'sin_clasificar');
  assert.equal(post.metrica_principal, 'sin_clasificar');
  assert.equal(post.idioma, 'es');
  assert.equal(post.estado, 'publicado');

  // Verify metrics were stored
  const metrics = db.prepare('SELECT * FROM metrics WHERE post_id = ?').get(post.id);
  assert.ok(metrics);
  assert.equal(metrics.reach, 500);
  assert.equal(metrics.plays, 600);
});

test('Importer: existing posts preserve objectives, metrics updated', () => {
  const db = open(':memory:');

  // First import
  importCsv(db, 'tiktok', TIKTOK_CSV);

  // Get the created post and assign objectives
  let post = db.prepare('SELECT id FROM posts WHERE external_id = ?').get('vid_456');
  const postId = post.id;
  db.prepare(`UPDATE posts SET objetivo_negocio='consulta_calificada',
             objetivo_marketing='atraer viajeros', objetivo_contenido='demostrar',
             audiencia='turistas', etapa_embudo='consideracion', cta='WhatsApp',
             metrica_principal='conversaciones', idioma='es'
             WHERE id=?`).run(postId);

  // Import same post again with updated metrics
  const updated_csv = `Video ID,Post Date,Video Title,Plays,Likes,Comments,Shares,Saves,Profile Visits,Completion Rate
vid_456,2024-01-16,Cusco Travel Tips,1000,150,25,20,60,50,70%`;

  const result = importCsv(db, 'tiktok', updated_csv);
  assert.equal(result.updated, 1);
  assert.equal(result.imported, 0);

  // Verify objectives preserved
  post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
  assert.equal(post.objetivo_negocio, 'consulta_calificada');
  assert.equal(post.objetivo_marketing, 'atraer viajeros');
  assert.equal(post.audiencia, 'turistas');

  // Verify metrics updated
  const metrics = db.prepare('SELECT * FROM metrics WHERE post_id = ?').get(postId);
  assert.equal(metrics.plays, 1000);
  assert.equal(metrics.likes, 150);
});

test('Importer: invalid platform returns error', () => {
  const db = open(':memory:');
  const result = importCsv(db, 'invalid_platform', META_CSV);

  assert.equal(result.imported, 0);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /Plataforma no soportada/);
});

test('Importer: malformed CSV returns error', () => {
  const db = open(':memory:');
  const bad_csv = 'invalid,csv\nno,post,id';
  const result = importCsv(db, 'instagram', bad_csv);

  assert.ok(result.errors.length > 0);
  assert.equal(result.imported, 0);
});

test('API: POST /import/:plataforma with valid CSV', async () => {
  const db = open(':memory:');
  const auth = makeAuth({ password: 'pw', secret: 's' });
  const srv = createApp(db, auth).listen(0);
  const url = `http://localhost:${srv.address().port}/api`;
  const j = (p, o = {}, c) => fetch(url + p, {
    ...o,
    headers: { 'content-type': 'application/json', cookie: c || '' },
    body: o.body && JSON.stringify(o.body)
  });

  try {
    // Login
    const loginRes = await j('/login', { method: 'POST', body: { password: 'pw' } });
    const ck = loginRes.headers.get('set-cookie').split(';')[0];

    // Import Instagram CSV
    const importRes = await j('/import/instagram', {
      method: 'POST',
      body: { csv: META_CSV }
    }, ck);

    assert.equal(importRes.status, 200);
    const result = await importRes.json();
    assert.equal(result.imported, 1);
    assert.equal(result.updated, 0);
    assert.equal(result.errors.length, 0);

    // Verify post exists in DB
    const posts = await j('/posts', {}, ck);
    const data = await posts.json();
    assert.equal(data.length, 1);
    assert.equal(data[0].plataforma, 'instagram');
    assert.equal(data[0].titulo, 'Humantay sunset');
  } finally {
    srv.close();
  }
});

test('API: POST /import/:plataforma without csv field returns error', async () => {
  const db = open(':memory:');
  const auth = makeAuth({ password: 'pw', secret: 's' });
  const srv = createApp(db, auth).listen(0);
  const url = `http://localhost:${srv.address().port}/api`;
  const j = (p, o = {}, c) => fetch(url + p, {
    ...o,
    headers: { 'content-type': 'application/json', cookie: c || '' },
    body: o.body && JSON.stringify(o.body)
  });

  try {
    const loginRes = await j('/login', { method: 'POST', body: { password: 'pw' } });
    const ck = loginRes.headers.get('set-cookie').split(';')[0];

    const importRes = await j('/import/instagram', {
      method: 'POST',
      body: { }
    }, ck);

    assert.equal(importRes.status, 400);
  } finally {
    srv.close();
  }
});

test('API: POST /import/:plataforma with invalid platform', async () => {
  const db = open(':memory:');
  const auth = makeAuth({ password: 'pw', secret: 's' });
  const srv = createApp(db, auth).listen(0);
  const url = `http://localhost:${srv.address().port}/api`;
  const j = (p, o = {}, c) => fetch(url + p, {
    ...o,
    headers: { 'content-type': 'application/json', cookie: c || '' },
    body: o.body && JSON.stringify(o.body)
  });

  try {
    const loginRes = await j('/login', { method: 'POST', body: { password: 'pw' } });
    const ck = loginRes.headers.get('set-cookie').split(';')[0];

    const importRes = await j('/import/invalid_plat', {
      method: 'POST',
      body: { csv: META_CSV }
    }, ck);

    assert.equal(importRes.status, 400);
  } finally {
    srv.close();
  }
});

test('Importer: null metrics stored correctly', () => {
  const db = open(':memory:');

  // CSV with missing metrics
  const sparse_csv = `Post ID,Post Date,Text
001,2024-01-20,Test Post`;

  const result = importCsv(db, 'instagram', sparse_csv);
  assert.equal(result.imported, 1);

  // Verify metrics exist with nulls
  const post = db.prepare('SELECT id FROM posts WHERE external_id = ?').get('001');
  const metrics = db.prepare('SELECT * FROM metrics WHERE post_id = ?').get(post.id);
  assert.ok(metrics);
  assert.equal(metrics.reach, null);
  assert.equal(metrics.plays, null);
  assert.equal(metrics.likes, null);
});

test('Meta: acepta "Title"/"Publish time" y usa Sin título si falta el título', () => {
  const meta = require('../src/adapters/meta');
  const r = meta.parse('Post ID,Title,Publish time,Reach\nx1,Reel Vinicunca,2026-09-01,1200\nx2,,2026-09-02,50\n');
  assert.equal(r.length, 2);
  assert.equal(r[0].titulo, 'Reel Vinicunca');
  assert.equal(r[0].reach, 1200);
  assert.equal(r[1].titulo, 'Sin título');
});
