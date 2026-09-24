const test = require('node:test');
const assert = require('node:assert');
const { open } = require('../src/db');
const content = require('../src/modules/content');

const base = {
  plataforma: 'instagram', titulo: 'Humantay', objetivo_negocio: 'consulta_calificada', objetivo_marketing: 'resolver duda',
  objetivo_contenido: 'responder', audiencia: 'viajeros planificando', etapa_embudo: 'consideracion',
  cta: 'WhatsApp HUMANTAY', metrica_principal: 'consultas', idioma: 'es',
};

function db() {
  const d = open(':memory:');
  const cols = Object.keys(base);
  d.prepare(`INSERT INTO posts(${cols}) VALUES(${cols.map(() => '?')})`).run(cols.map(k => base[k]));
  return d;
}

// Publicación sin objetivo (se inserta saltando la validación del módulo posts)
function postSinObjetivo(d) {
  d.prepare("INSERT INTO posts(id,plataforma,titulo,objetivo_negocio,objetivo_marketing,objetivo_contenido,audiencia,etapa_embudo,cta,metrica_principal,idioma) VALUES(99,'instagram','Sin objetivo','','','','','','','','es')").run();
  return 99;
}

const aprobada = (d, extra = {}) => d.prepare('INSERT INTO approved_info(tipo,titulo,texto,autorizado_publicar,fuente) VALUES(?,?,?,?,?)')
  .run(extra.tipo ?? 'servicio', extra.titulo ?? 'Tour Humantay', extra.texto ?? 'Salida 4:30 am desde Cusco, incluye desayuno.', extra.autorizado_publicar ?? 1, extra.fuente ?? 'ficha oficial');

const fakeFetch = (texto = 'Copy generado', captura = {}) => async (url, opts) => {
  captura.url = url; captura.opts = opts; captura.body = JSON.parse(opts.body);
  return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: texto }] }) };
};

const conClave = async fn => {
  const prev = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'sk-test';
  try { return await fn(); } finally { prev === undefined ? delete process.env.ANTHROPIC_API_KEY : (process.env.ANTHROPIC_API_KEY = prev); }
};

test('rechaza 400 si la publicación no tiene objetivo, audiencia, etapa, CTA ni métrica', async () => {
  const d = db();
  aprobada(d);
  const id = postSinObjetivo(d);
  await conClave(async () => {
    await assert.rejects(
      () => content.generate(d, { post_id: id, tipo: 'copy', idioma: 'es' }, { fetchImpl: fakeFetch() }),
      e => e.status === 400 && /obligatorios/.test(e.message));
  });
});

test('rechaza 400 si el idioma no es es|en (una pieza, un solo idioma)', async () => {
  const d = db();
  aprobada(d);
  await conClave(async () => {
    await assert.rejects(
      () => content.generate(d, { post_id: 1, tipo: 'copy', idioma: 'qu' }, { fetchImpl: fakeFetch() }),
      e => e.status === 400 && /idioma/.test(e.message));
  });
});

test('422 si no hay información aprobada de Tikaymi', async () => {
  const d = db();
  await conClave(async () => {
    await assert.rejects(
      () => content.generate(d, { post_id: 1, tipo: 'copy', idioma: 'es' }, { fetchImpl: fakeFetch() }),
      e => e.status === 422 && /información aprobada/i.test(e.message));
  });
});

test('503 con mensaje claro si falta ANTHROPIC_API_KEY', async () => {
  const d = db();
  aprobada(d);
  const prev = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    await assert.rejects(
      () => content.generate(d, { post_id: 1, tipo: 'copy', idioma: 'es' }, { fetchImpl: fakeFetch() }),
      e => e.status === 503 && /ANTHROPIC_API_KEY/.test(e.message));
  } finally { if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev; }
});

test('el prompt solo lleva información autorizada y prohíbe inventar', async () => {
  const d = db();
  aprobada(d, { titulo: 'Precio Humantay', texto: 'USD 60 por persona', tipo: 'precio', autorizado_publicar: 1 });
  aprobada(d, { titulo: 'Borrador interno', texto: 'DESCUENTO SECRETO NO AUTORIZADO', tipo: 'otro', autorizado_publicar: 0 });
  d.prepare("INSERT INTO assets(tipo,url,descripcion,destino) VALUES('foto','https://x/1.jpg','Laguna al amanecer','Humantay')").run();
  const cap = {};
  await conClave(() => content.generate(d, { post_id: 1, tipo: 'copy', idioma: 'es' }, { fetchImpl: fakeFetch('Copy', cap) }));

  const enviado = cap.body.system + '\n' + cap.body.messages[0].content;
  assert.ok(enviado.includes('USD 60 por persona'), 'incluye la info autorizada');
  assert.ok(!enviado.includes('DESCUENTO SECRETO NO AUTORIZADO'), 'nunca incluye info no autorizada');
  assert.ok(enviado.includes('https://x/1.jpg'), 'incluye los recursos reales');
  assert.match(enviado, /Nunca inventes precios, disponibilidad, horarios, servicios, resultados, reseñas, testimonios, estadísticas ni condiciones de viaje/);
  assert.equal(cap.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(cap.opts.headers['x-api-key'], 'sk-test');
  assert.equal(cap.body.model, process.env.ANTHROPIC_MODEL || 'claude-sonnet-5');
});

test('el contenido generado queda siempre en revisión y se aprueba a mano', async () => {
  const d = db();
  aprobada(d);
  const out = await conClave(() => content.generate(d, { post_id: 1, tipo: 'copy', idioma: 'es' }, { fetchImpl: fakeFetch('Copy listo') }));
  assert.equal(out.estado, 'revision');
  const fila = d.prepare('SELECT * FROM generated WHERE id=?').get(out.id);
  assert.equal(fila.estado, 'revision');
  assert.equal(fila.contenido, 'Copy listo');

  assert.deepEqual(content.setEstado(d, out.id, 'aprobado'), { id: out.id, estado: 'aprobado' });
  assert.throws(() => content.setEstado(d, out.id, 'publicado'), e => e.status === 400);
});

test('carrusel: valida 3-5 diapositivas con los layouts del constructor', async () => {
  const d = db();
  aprobada(d);
  const json = JSON.stringify({ tipo: 'informativo', slides: [
    { layout: 'portada', data: { titulo: 'Humantay' } },
    { layout: 'pasos', data: { titulo: 'Cómo llegar' } },
    { layout: 'cierre', data: { titulo: 'Escríbenos' } },
  ] });
  const out = await conClave(() => content.generate(d, { post_id: 1, tipo: 'carrusel', idioma: 'es' }, { fetchImpl: fakeFetch('```json\n' + json + '\n```') }));
  const exportado = JSON.parse(out.contenido);
  assert.equal(exportado.app, 'tikaymi-constructor-carruseles');
  assert.equal(exportado.slides.length, 3);
  assert.equal(out.estado, 'revision');
});

test('prompt de carrusel exige el esquema real de cada layout', async () => {
  const d = db();
  aprobada(d);
  const cap = {};
  await conClave(() => content.generate(d, { post_id:1, tipo:'carrusel', idioma:'es' }, { fetchImpl: fakeFetch('{"tipo":"informativo","slides":[{"layout":"portada","data":{"h1":"x"}},{"layout":"cierre","data":{"h2":"y"}}]}', cap) }));
  assert.match(cap.body.messages[0].content, /route:\[\{d,t\}\]/);
  assert.match(cap.body.messages[0].content, /No uses campos genéricos titulo\/texto/);
});

test('registra el límite 429 de la API', async () => {
  const d = db();
  aprobada(d);
  const errores = [];
  const orig = console.error;
  console.error = (...a) => errores.push(a.join(' '));
  try {
    await conClave(async () => {
      await assert.rejects(
        () => content.generate(d, { post_id: 1, tipo: 'copy', idioma: 'es' },
          { fetchImpl: async () => ({ ok: false, status: 429, text: async () => 'rate limit' }) }),
        e => e.status === 429);
    });
  } finally { console.error = orig; }
  assert.ok(errores.some(m => m.includes('429')));
});

test('prompt_flow contempla clips de ~10 s, fotos por clip y voz/subtítulos', async () => {
  const d = db();
  aprobada(d);
  const cap = {};
  await conClave(() => content.generate(d, { post_id: 1, tipo: 'prompt_flow', idioma: 'en' }, { fetchImpl: fakeFetch('prompts', cap) }));
  const p = cap.body.messages[0].content;
  assert.match(p, /~10 segundos/);
  assert.match(p, /fotografía de referencia/);
  assert.match(p, /subtítulos/);
  assert.match(p, /Killa no es obligatoria/);
  assert.match(cap.body.system, /inglés/);
  assert.match(cap.body.system, /Deicy Ayala/);
  assert.match(cap.body.system, /enciclopédico/);
});

test('testimonios: sin testimonio autorizado la IA no puede inventarlos', async () => {
  const d = db();
  aprobada(d);
  const cap = {};
  await conClave(() => content.generate(d, { post_id: 1, tipo: 'copy', idioma: 'es' }, { fetchImpl: fakeFetch('x', cap) }));
  assert.match(cap.body.messages[0].content, /no hay ninguno autorizado/);
});
