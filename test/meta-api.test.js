const test = require('node:test');
const assert = require('node:assert');
const meta = require('../src/adapters/meta');
const { syncStats } = require('../src/modules/sync');
const { open } = require('../src/db');

const CRED = { access_token: 't', ig_user_id: 'ig1', app_id: 'a', app_secret: 's' };
const ok = json => ({ ok: true, json: async () => json });
const ins = (name, value) => ({ name, period: 'lifetime', values: [{ value }] });

// Simula Graph API: carrusel C1 acepta todo; reel R1 rechaza `saved` en la petición combinada.
function fakeGraph({ expired = false } = {}) {
  const calls = [];
  const f = async url => {
    calls.push(url);
    const u = new URL(url); const p = u.pathname.split('/').slice(2).join('/');
    if (expired) return ok({ error: { code: 190, message: 'token caducado' } });
    if (p === 'debug_token') return ok({ data: { is_valid: true, expires_at: Math.floor(Date.now() / 1000) + 3 * 86400 } });
    if (p === 'ig1/media') return ok({ data: [
      { id: 'C1', caption: 'Machu Picchu\nmás texto', media_type: 'CAROUSEL_ALBUM', media_product_type: 'FEED', timestamp: '2026-09-20T15:00:00+0000' },
      { id: 'R1', caption: '', media_type: 'VIDEO', media_product_type: 'REELS', timestamp: '2026-09-18T15:00:00+0000' }] });
    const id = p.split('/')[0]; const metrics = u.searchParams.get('metric').split(',');
    if (id === 'R1' && metrics.length > 1) return ok({ error: { code: 100, message: 'metric not supported' } });
    if (id === 'R1' && metrics[0] === 'saved') return ok({ error: { code: 100, message: 'metric not supported' } });
    const vals = { reach: 10, views: 20, saved: 1, shares: 2, likes: 3, comments: 4, total_interactions: 9, profile_visits: 5 };
    return ok({ data: metrics.map(m => ins(m, vals[m])) });
  };
  f.calls = calls; return f;
}

test('fetchStats: views→impressions en carrusel, views→plays en reel; no soportadas quedan NULL', async () => {
  const r = await meta.fetchStats([{ external_id: 'C1', formato: 'carousel' }, { external_id: 'R1', formato: 'reel' }], { credentials: CRED, fetchImpl: fakeGraph() });
  assert.equal(r.ok, true);
  const [c, rl] = r.items;
  assert.equal(c.impressions, 20); assert.equal(c.plays, null); assert.equal(c.saves, 1);
  assert.equal(rl.plays, 20); assert.equal(rl.impressions, null); assert.equal(rl.saves, null); assert.equal(rl.reach, 10);
  assert.equal(c.retention, null); assert.equal(c.clicks, null);
});

test('sin credenciales → ok:false sin llamar a la API', async () => {
  const prev = process.env.META_ACCESS_TOKEN; delete process.env.META_ACCESS_TOKEN;
  const f = fakeGraph();
  const r = await meta.fetchStats(['C1'], { fetchImpl: f });
  if (prev) process.env.META_ACCESS_TOKEN = prev;
  assert.equal(r.ok, false); assert.equal(r.errors[0].code, 'sin_credenciales'); assert.equal(f.calls.length, 0);
});

test('token caducado → credenciales_caducadas', async () => {
  const r = await meta.listRecent({ credentials: CRED, fetchImpl: fakeGraph({ expired: true }) });
  assert.equal(r.ok, false); assert.equal(r.errors[0].code, 'credenciales_caducadas');
});

test('syncStats crea posts sin_clasificar, guarda métricas y avisa de caducidad; 2ª vez omite (1/día)', async () => {
  const db = open(':memory:');
  const a = await syncStats(db, 'instagram', { credentials: CRED, fetchImpl: fakeGraph() });
  assert.equal(a.nuevos, 2); assert.equal(a.ok, true);
  assert.match(a.aviso, /caduca en/);
  const p = db.prepare("SELECT p.titulo, p.formato, p.objetivo_negocio, m.reach FROM posts p JOIN metrics m ON m.post_id=p.id WHERE external_id='C1'").get();
  assert.deepEqual({ ...p }, { titulo: 'Machu Picchu', formato: 'carousel', objetivo_negocio: 'sin_clasificar', reach: 10 });
  const b = await syncStats(db, 'instagram', { credentials: CRED, fetchImpl: fakeGraph() });
  assert.equal(b.omitidos, 2); assert.equal(b.nuevos, 0);
  const c = await syncStats(db, 'instagram', { credentials: CRED, fetchImpl: fakeGraph(), force: true });
  assert.equal(c.actualizados, 2);
});

test('sync no pisa con NULL datos ya importados (clics de CSV) y conserva objetivos del post', async () => {
  const db = open(':memory:');
  await syncStats(db, 'instagram', { credentials: CRED, fetchImpl: fakeGraph() });
  db.prepare("UPDATE metrics SET clicks=7 WHERE post_id=(SELECT id FROM posts WHERE external_id='C1')").run();
  db.prepare("UPDATE posts SET objetivo_negocio='ventas' WHERE external_id='C1'").run();
  await syncStats(db, 'instagram', { credentials: CRED, fetchImpl: fakeGraph(), force: true });
  const r = db.prepare("SELECT p.objetivo_negocio o, m.clicks c FROM posts p JOIN metrics m ON m.post_id=p.id WHERE external_id='C1'").get();
  assert.equal(r.c, 7); assert.equal(r.o, 'ventas');
});

test('plataforma sin conector → 400', async () => {
  await assert.rejects(() => syncStats(open(':memory:'), 'tiktok', {}), /no disponible/);
});

// ---- Facebook (Página) ----
const CRED_FB = { ...CRED, page_id: 'pg1' };
function fakeFb({ noPageToken = false } = {}) {
  const calls = [];
  const f = async url => {
    calls.push(url);
    const u = new URL(url); const p = u.pathname.split('/').slice(2).join('/');
    if (p === 'debug_token') return ok({ data: { is_valid: true, expires_at: Math.floor(Date.now() / 1000) + 40 * 86400 } });
    if (p === 'pg1') return ok(noPageToken ? {} : { access_token: 'PT', id: 'pg1' });
    if (u.searchParams.get('access_token') !== 'PT') return ok({ error: { code: 190, message: 'usa token de página' } });
    if (p === 'pg1/posts') return ok({ data: [
      { id: 'pg1_1', message: 'Cada viaje\nmás', created_time: '2026-09-20T15:00:45+0000', status_type: 'added_photos', attachments: { data: [{ media_type: 'album' }] } }] });
    if (p === 'pg1_1') return ok({ reactions: { summary: { total_count: 4 } }, comments: { summary: { total_count: 2 } } }); // sin `shares`
    if (p === 'pg1_1/insights') return ok({ data: [ins('post_media_view', 9), ins('post_total_media_view_unique', 6), ins('post_clicks', 1), ins('post_total_media_view_unique', 0)] });
    return ok({ error: { code: 100, message: 'x' } });
  };
  f.calls = calls; return f;
}

test('Facebook: usa token de Página, mapea métricas y toma el primer valor de métricas duplicadas', async () => {
  const f = fakeFb();
  const l = await meta.listRecent({ plataforma: 'facebook', credentials: CRED_FB, fetchImpl: f });
  assert.deepEqual(l.items[0], { external_id: 'pg1_1', titulo: 'Cada viaje', fecha: '2026-09-20T15:00:45+0000', formato: 'carousel' });
  const r = await meta.fetchStats(l.items, { plataforma: 'facebook', credentials: CRED_FB, fetchImpl: f });
  const s = r.items[0];
  assert.equal(r.ok, true);
  assert.equal(s.reach, 6); assert.equal(s.impressions, 9); assert.equal(s.plays, null);
  assert.equal(s.likes, 4); assert.equal(s.comments, 2); assert.equal(s.shares, 0); assert.equal(s.clicks, 1);
  assert.equal(s.saves, null); assert.equal(s.profile_visits, null); assert.equal(s.retention, null);
});

test('Facebook: sin token de Página → sin_permiso; sin META_PAGE_ID → sin_credenciales', async () => {
  const a = await meta.listRecent({ plataforma: 'facebook', credentials: CRED_FB, fetchImpl: fakeFb({ noPageToken: true }) });
  assert.equal(a.errors[0].code, 'sin_permiso');
  const prev = process.env.META_PAGE_ID; delete process.env.META_PAGE_ID;
  try {
    const b = await meta.listRecent({ plataforma: 'facebook', credentials: { access_token: 't' }, fetchImpl: fakeFb() });
    assert.equal(b.errors[0].code, 'sin_credenciales');
  } finally { if (prev) process.env.META_PAGE_ID = prev; }
});

test('syncStats facebook crea posts separados de Instagram (no mezcla plataformas)', async () => {
  const db = open(':memory:');
  const r = await syncStats(db, 'facebook', { credentials: CRED_FB, fetchImpl: fakeFb() });
  assert.equal(r.nuevos, 1); assert.equal(r.ok, true);
  const row = db.prepare("SELECT plataforma, formato, objetivo_negocio FROM posts WHERE external_id='pg1_1'").get();
  assert.deepEqual({ ...row }, { plataforma: 'facebook', formato: 'carousel', objetivo_negocio: 'sin_clasificar' });
});

test('renewToken usa fb_exchange_token y devuelve el nuevo; sin credenciales no llama', async () => {
  let url;
  const f = async u => { url = new URL(u); return ok({ access_token: 'NUEVO', expires_in: 5183000 }); };
  const r = await meta.renewToken({ credentials: CRED, fetchImpl: f });
  assert.equal(r.access_token, 'NUEVO');
  assert.equal(url.searchParams.get('grant_type'), 'fb_exchange_token');
  assert.equal(url.searchParams.get('fb_exchange_token'), 't');
  const g = await meta.renewToken({ credentials: { access_token: 't' }, fetchImpl: f });
  if (!process.env.META_APP_ID) assert.equal(g.code, 'sin_credenciales');
});
