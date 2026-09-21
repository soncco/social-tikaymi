const test = require('node:test');
const assert = require('node:assert/strict');
const { open } = require('../src/db');
const site = require('../src/modules/site');
const planner = require('../src/modules/planner');
const content = require('../src/modules/content');
const { createApp } = require('../src/server');
const { makeAuth } = require('../src/modules/auth');

const URL = 'https://tikaymi.com/blog/palcoyo-vs-vinicunca/';
const EN = 'https://tikaymi.com/en/blog/palcoyo-vs-vinicunca/';
const xml = `<?xml version="1.0"?><urlset><url><loc>${URL}</loc></url><url><loc>${EN}</loc></url><url><loc>https://evil.example/unsafe</loc></url></urlset>`;
const html = title => `<html><head><meta name="description" content="Compara rutas reales en Perú"></head><body><nav>Menú</nav><main><h1>${title}</h1><p>Compara Palcoyo y Vinicunca antes de elegir tu ruta.</p></main></body></html>`;
const mock = (title, fail = false) => async url => {
  if (url === site.SITEMAP) return { ok:true, url, text:async () => xml };
  if (fail && url === URL) return { ok:false, status:500, url };
  return { ok:true, url, text:async () => html(title) };
};

test('sitemap acepta solo URLs HTTPS del dominio y reconoce pares de idioma', () => {
  const pages = site.parseSitemap(xml);
  assert.equal(pages.length, 2);
  assert.deepEqual(pages.map(p => p.lang), ['es','en']);
  assert.equal(pages[0].kind, 'blog');
});

test('copia local se actualiza manualmente y retira aprobación solo cuando cambia el contenido', async () => {
  const db = open(':memory:');
  const first = await site.sync(db, { fetchImpl:mock('Palcoyo o Vinicunca') });
  assert.equal(first.created, 2);
  assert.equal(site.status(db).pages.total, 2);
  site.approve(db, URL, true);
  const same = await site.sync(db, { fetchImpl:mock('Palcoyo o Vinicunca') });
  assert.equal(same.unchanged, 2);
  assert.equal(db.prepare('SELECT approved FROM site_pages WHERE url=?').get(URL).approved, 1);
  const changed = await site.sync(db, { fetchImpl:mock('Palcoyo y Vinicunca: diferencias') });
  assert.equal(changed.changed, 2);
  assert.equal(db.prepare('SELECT approved FROM site_pages WHERE url=?').get(URL).approved, 0);
  site.approve(db, URL, true);
  const partial = await site.sync(db, { fetchImpl:mock('Otra versión', true) });
  assert.equal(partial.failed, 1);
  assert.equal(db.prepare('SELECT approved FROM site_pages WHERE url=?').get(URL).approved, 1, 'un fallo no borra ni cambia la copia anterior');
  db.close();
});

test('el plan usa el catálogo local sin acceder a la red y conserva el vínculo a la fuente', async () => {
  const db = open(':memory:');
  await site.sync(db, { fetchImpl:mock('Palcoyo o Vinicunca') });
  const draft = planner.preview(db, { cadence:'semana' });
  assert.equal(draft.ideas[1].source_url, URL);
  assert.equal(draft.ideas[1].brief.idioma, 'es');
  assert.match(draft.ideas[1].limitations, /pendiente de revisión/);
  const saved = await planner.create(db, { cadence:'semana' });
  assert.equal(saved.ideas[1].source_url, URL);
  db.close();
});

test('solo una página web aprobada puede entrar al prompt de generación', async () => {
  const db = open(':memory:');
  await site.sync(db, { fetchImpl:mock('Palcoyo o Vinicunca') });
  const post = { plataforma:'instagram', titulo:'Palcoyo o Vinicunca', objetivo_negocio:'consulta_calificada',
    objetivo_marketing:'comparar rutas', objetivo_contenido:'comparar', audiencia:'viajeros', etapa_embudo:'consideracion',
    cta:'Escríbenos', metrica_principal:'conversaciones', idioma:'es', source_url:URL };
  assert.throws(() => content.buildPrompt(db, { post, tipo:'copy', idioma:'es' }), /información aprobada/);
  site.approve(db, URL, true);
  const prompt = content.buildPrompt(db, { post, tipo:'copy', idioma:'es' }).prompt;
  assert.match(prompt, /página web aprobada/);
  assert.match(prompt, /palcoyo-vs-vinicunca/);
  assert.doesNotMatch(prompt, /Menú/);
  db.close();
});

test('una URL retirada del sitemap se archiva sin borrar su ficha', async () => {
  const db = open(':memory:');
  await site.sync(db, { fetchImpl:mock('Ruta') });
  site.approve(db, EN, true);
  const onlySpanish = async url => url === site.SITEMAP
    ? { ok:true, url, text:async () => `<?xml version="1.0"?><urlset><url><loc>${URL}</loc></url></urlset>` }
    : { ok:true, url, text:async () => html('Ruta') };
  const result = await site.sync(db, { fetchImpl:onlySpanish });
  assert.equal(result.removed, 1);
  assert.equal(site.status(db).pages.total, 1);
  assert.deepEqual(db.prepare('SELECT active,approved FROM site_pages WHERE url=?').get(EN), { active:0, approved:0 });
  db.close();
});

test('API del sitio expone la copia local y guarda aprobación autenticada', async () => {
  const db = open(':memory:');
  await site.sync(db, { fetchImpl:mock('Ruta') });
  const server = createApp(db, makeAuth({ password:'pw', secret:'s' })).listen(0);
  const base = `http://localhost:${server.address().port}/api`;
  try {
    assert.equal((await fetch(base + '/site/status')).status, 401);
    const login = await fetch(base + '/login', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ password:'pw' }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const options = { headers:{ cookie, 'content-type':'application/json' } };
    const pages = await (await fetch(base + '/site/pages?lang=es', options)).json();
    assert.equal(pages.length, 1);
    const result = await fetch(base + '/site/approve', { ...options, method:'PUT', body:JSON.stringify({ url:URL, approved:true }) });
    assert.equal(result.status, 200);
    assert.equal(db.prepare('SELECT approved FROM site_pages WHERE url=?').get(URL).approved, 1);
  } finally { server.close(); db.close(); }
});
