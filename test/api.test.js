const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/server');
const { open } = require('../src/db');
const { makeAuth } = require('../src/modules/auth');

const base = { plataforma: 'instagram', titulo: 'Humantay', objetivo_negocio: 'consulta_calificada', objetivo_marketing: 'resolver duda',
  objetivo_contenido: 'responder', audiencia: 'viajeros planificando', etapa_embudo: 'consideracion', cta: 'WhatsApp HUMANTAY', metrica_principal: 'consultas', idioma: 'es' };

test('API: auth, objetivo obligatorio y atribución por código', async () => {
  const srv = createApp(open(':memory:'), makeAuth({ password: 'pw', secret: 's' })).listen(0);
  const url = `http://localhost:${srv.address().port}/api`;
  const j = (p, o = {}, c) => fetch(url + p, { ...o, headers: { 'content-type': 'application/json', cookie: c || '' }, body: o.body && JSON.stringify(o.body) });
  try {
    assert.equal((await j('/posts')).status, 401);
    const login = await j('/login', { method: 'POST', body: { password: 'pw' } });
    const ck = login.headers.get('set-cookie').split(';')[0];
    assert.equal((await j('/posts', { method: 'POST', body: { plataforma: 'instagram', titulo: 'x' } }, ck)).status, 400);
    const p = await (await j('/posts', { method: 'POST', body: { ...base, campaign_code: 'HUMANTAY' } }, ck)).json();
    assert.ok(p.id);
    const l = await (await j('/leads', { method: 'POST', body: { campaign_code: 'HUMANTAY', viajeros: 2 } }, ck)).json();
    assert.equal(l.atribuido, true);
  } finally { srv.close(); }
});
