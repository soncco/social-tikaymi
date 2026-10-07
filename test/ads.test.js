const test = require('node:test');
const assert = require('node:assert/strict');
const { open } = require('../src/db');
const content = require('../src/modules/content');
const revisions = require('../src/modules/revisions');
const review = require('../src/modules/visual-review');
const ads = require('../src/modules/ads');

const TOUR = 'https://tikaymi.com/en/tour/5-day-cusco-sacred-valley-machu-picchu/';
const brief = { titulo:'5-day Cusco, Sacred Valley and Machu Picchu', plataforma:'tiktok', objetivo_negocio:'consulta_calificada', objetivo_marketing:'Dar visibilidad al tour de 5 días',
  objetivo_contenido:'producto', audiencia:'First-time visitors to Peru', etapa_embudo:'consideracion', cta:'Write to Deicy on WhatsApp', metrica_principal:'conversaciones iniciadas', idioma:'en', source_url:TOUR };
const variant = (gancho, extra = {}) => ({ angulo:'Logística resuelta', gancho, cuerpo:'Deicy coordinates trains, tickets and transfers before you arrive.', titulo:'5 days, planned for you', descripcion:'Tailor-made itinerary', ...extra });
const ad = (variantes = [variant('Machu Picchu in 5 days, with trains and tickets coordinated for you.'), variant('Your first trip to Peru, planned day by day with Deicy.', { angulo:'Acompañamiento' })]) =>
  ({ format:'anuncio_meta', version:1, idioma:'en', variantes, warnings:[], pending:[] });
const image = { format:'imagen_unica', version:1, tipo:'producto', plataforma:'instagram', idioma:'en', resource:{ url:'https://fixture.invalid/mapi.jpg' },
  visual:{ headline:'Machu Picchu in 5 days', support:'Trains, tickets and transfers coordinated', visualCta:'Plan with Deicy' }, alt:'Machu Picchu at sunrise', cta:{ text:'Write to Deicy', destination:'' }, warnings:[], pending:[] };

function setup() {
  const db = open(':memory:');
  db.prepare("INSERT INTO site_pages(url,lang,kind,title,description,body_text,content_hash,approved,active) VALUES(?,?,?,?,?,?,?,1,1)")
    .run(TOUR, 'en', 'tour', '5-Day Cusco, Sacred Valley & Machu Picchu', 'Tour of 5 days', 'Machu Picchu Sacred Valley Cusco 5 days. From USD 650 per person.', 'h1');
  db.prepare("INSERT INTO assets(tipo,url,destino,autorizado_publicar) VALUES('foto','https://fixture.invalid/mapi.jpg','Machu Picchu',1)").run();
  return db;
}
// Responde según lo que pide el prompt: la pieza visual primero y luego los textos del anuncio.
function fakeLlm(adResponses, prompts = []) {
  return async (_url, opts) => {
    const prompt = JSON.parse(opts.body).messages[0].content; prompts.push(prompt);
    const text = prompt.includes('"format":"anuncio_meta"') ? JSON.stringify(adResponses.shift()) : JSON.stringify(image);
    return { ok:true, json:async () => ({ content:[{ type:'text', text }] }) };
  };
}
async function withKey(fn) {
  const old = process.env.ANTHROPIC_API_KEY; process.env.ANTHROPIC_API_KEY = 'fixture';
  try { return await fn(); } finally { if (old === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = old; }
}

test('validación del anuncio: límites, precio, urgencia, hashtags y variantes comparables', () => {
  assert.equal(ads.validate(ad(), { idioma:'en' }).ok, true);
  const errors = v => ads.validate(ad([variant('Hook one is fine here.'), v]), { idioma:'en', sourcesText:'From USD 650 per person' }).errors.join(' | ');
  assert.match(errors(variant('x'.repeat(126))), /gancho: 126 caracteres, máximo 125/);
  assert.match(errors(variant('Ok', { titulo:'t'.repeat(41) })), /titulo: 41 caracteres/);
  // El cuerpo largo solo avisa hasta 600; caso real: 373 caracteres bloqueaba todo el anuncio.
  const long = ads.validate(ad([variant('Hook one is fine here.', { cuerpo:'c'.repeat(373) }), variant('Hook two')]), { idioma:'en' });
  assert.equal(long.ok, true);
  assert.match(long.warnings.join(), /cuerpo: 373 caracteres; se recomiendan 350/);
  assert.match(errors(variant('Ok', { cuerpo:'c'.repeat(601) })), /cuerpo: 601 caracteres, máximo 600/);
  assert.match(errors(variant('The cheapest way to see Machu Picchu')), /no compitas por precio/);
  assert.match(errors(variant('Viaje low cost a Cusco')), /no compitas por precio/);
  assert.match(errors(variant('Last spots for July!')), /urgencia/);
  assert.match(errors(variant('Plan Machu Picchu #Cusco')), /hashtags/);
  assert.match(errors(variant('See wa.me/51999 now')), /URL va en el campo/);
  assert.match(errors(variant('Only USD 400 per person')), /precio «USD 400» sin fuente aprobada/);
  assert.equal(errors(variant('From USD 650 per person, fully planned.')), '');
  assert.match(errors(variant('Hook one is fine here.')), /gancho distinto/);
  assert.match(ads.validate(ad([variant('Solo una')]), {}).errors.join(), /variantes: se requieren 2–3/);
  assert.match(ads.validate(ad(), { idioma:'es' }).errors.join(), /idioma: debe ser es/);
  assert.match(ads.validate(ad([variant('A [FALTA DATO: horario]'), variant('B')]), { ready:true }).errors.join(), /contiene \[FALTA DATO/);
});

test('paquete Anuncio Meta: visual + textos con códigos, WhatsApp y UTM; sin copies orgánicos y en revisión', async () => {
  const db = setup(), prompts = [];
  try {
    const result = await withKey(() => content.generatePackage(db, { brief, extra:'anuncio_meta' }, { fetchImpl:fakeLlm([ad()], prompts) }));
    assert.equal(prompts.length, 2, 'una llamada para la imagen y otra para el anuncio; ninguna para copies orgánicos');
    assert.match(prompts[1], /Contenido principal ya decidido[\s\S]*Machu Picchu in 5 days/);
    assert.match(prompts[1], /USD 650/);
    const rows = db.prepare('SELECT tipo,plataforma,estado,contenido FROM generated WHERE package_id=? ORDER BY id').all(result.id);
    assert.deepEqual(rows.map(r => [r.tipo, r.plataforma, r.estado]), [['imagen_unica', 'instagram', 'revision'], ['anuncio_meta', null, 'revision']]);
    const saved = JSON.parse(rows[1].contenido);
    assert.equal(saved.codigo_base, 'ADEN001');
    assert.deepEqual(saved.variantes.map(v => v.campaign_code), ['ADEN001A', 'ADEN001B']);
    assert.deepEqual(saved.ubicaciones, ['facebook', 'instagram']);
    assert.equal(saved.boton, 'Send WhatsApp message');
    assert.match(saved.variantes[0].mensaje_whatsapp, /^Hi Deicy, I saw the ad for 5-Day Cusco, Sacred Valley & Machu Picchu .* Code: ADEN001A$/);
    const url = new URL(saved.variantes[1].url_destino);
    assert.equal(url.origin + url.pathname, TOUR);
    assert.deepEqual(Object.fromEntries(url.searchParams), { utm_source:'meta', utm_medium:'paid_social', utm_campaign:'aden001', utm_content:'b' });
    assert.equal(saved.variantes[0].texto_principal, `${saved.variantes[0].gancho}\n\n${saved.variantes[0].cuerpo}`);
    assert.equal(JSON.parse(rows[0].contenido).copies, undefined);
    assert.equal(result.copy.tipo, 'anuncio_meta');
    const warned = await withKey(() => content.generatePackage(db, { brief, extra:'anuncio_meta' }, { fetchImpl:fakeLlm([ad([variant('Long body hook.', { cuerpo:'c'.repeat(373) }), variant('Short body hook.')])]) }));
    assert.match(JSON.parse(warned.additional.contenido).warnings.join(), /373 caracteres; se recomiendan 350/);

    const second = await withKey(() => content.generatePackage(db, { brief, extra:'anuncio_meta' }, { fetchImpl:fakeLlm([ad()]) }));
    assert.equal(JSON.parse(second.additional.contenido).codigo_base, 'ADEN003');

    const adId = db.prepare("SELECT id FROM generated WHERE tipo='anuncio_meta' AND package_id=?").get(result.id).id;
    assert.equal(content.setEstado(db, adId, 'aprobado').estado, 'aprobado');
    const broken = structuredClone(saved); broken.variantes[0].gancho = 'Trains at [FALTA DATO: horario]';
    revisions.edit(db, adId, { contenido:JSON.stringify(broken), motivo:'prueba' });
    assert.throws(() => content.setEstado(db, adId, 'aprobado'), /contiene \[FALTA DATO/);
  } finally { db.close(); }
});

test('anuncio con precio inventado se repara una vez y, si persiste, no se guarda', async () => {
  const db = setup();
  try {
    const invented = ad([variant('Only USD 400 for 5 days in Peru.'), variant('Plan your first trip with Deicy.')]);
    const prompts = [];
    await assert.rejects(withKey(() => content.generatePackage(db, { brief, extra:'anuncio_meta' }, { fetchImpl:fakeLlm([invented, invented], prompts) })), /Anuncio inválido.*USD 400.*revisión fallida/);
    assert.match(prompts.at(-1), /Reparación acotada[\s\S]*USD 400/);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM generated').get().n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM content_packages').get().n, 0);
  } finally { db.close(); }
});

test('carrusel como visual del anuncio y regeneración que conserva los códigos de campaña', async () => {
  const db = setup();
  try {
    const slides = [{ layout:'portada', data:{ eyebrow:'Peru', h1:'Machu Picchu in 5 days', imageUrl:'https://fixture.invalid/mapi.jpg' } }, { layout:'ficha', data:{ eyebrow:'The trip', h2:'What Deicy coordinates', meta:[{ k:'Days', v:'5' }], body:'Trains, tickets and transfers.' } }, { layout:'cierre', data:{ eyebrow:'Next step', h2:'Plan your dates', body:'Share your travel dates with Deicy.', ctaText:'Write to Deicy' } }];
    const fetchImpl = async (_url, opts) => {
      const prompt = JSON.parse(opts.body).messages[0].content;
      const text = prompt.includes('"format":"anuncio_meta"') ? JSON.stringify(ad()) : JSON.stringify({ tipo:'producto', slides });
      return { ok:true, json:async () => ({ content:[{ type:'text', text }] }) };
    };
    const result = await withKey(() => content.generatePackage(db, { brief, extra:'anuncio_meta', ad_visual:'carrusel' }, { fetchImpl }));
    assert.equal(result.primary.tipo, 'carrusel');
    const adId = result.additional.id;
    const regenerated = ad([variant('A new hook about trains and tickets in Cusco.'), variant('Another new hook about your first trip.'), variant('A third angle on tailored days.', { angulo:'Días a medida' })]);
    await withKey(() => revisions.regenerate(db, adId, { segmento:'pieza', instruccion:'Más concreto' }, { content, fetchImpl:fakeLlm([regenerated]) }));
    const after = JSON.parse(db.prepare('SELECT contenido FROM generated WHERE id=?').get(adId).contenido);
    assert.deepEqual(after.variantes.map(v => v.campaign_code), ['ADEN001A', 'ADEN001B', 'ADEN001C']);
    assert.equal(new URL(after.variantes[0].url_destino).pathname, new URL(TOUR).pathname, 'el tour del brief se conserva al regenerar');
    await assert.rejects(content.generatePackage(db, { brief, extra:'anuncio_meta', ad_visual:'guion' }), /imagen única o carrusel/);
  } finally { db.close(); }
});

test('sin tour aprobado el anuncio queda con el enlace como dato pendiente', async () => {
  const db = setup();
  try {
    db.prepare("UPDATE site_pages SET kind='blog'").run();
    const result = await withKey(() => content.generatePackage(db, { brief:{ ...brief, source_url:undefined }, extra:'anuncio_meta' }, { fetchImpl:fakeLlm([ad()]) }));
    const saved = JSON.parse(result.additional.contenido);
    assert.equal(saved.variantes[0].url_destino, null);
    assert.match(saved.pending.join(), /página del tour/);
    assert.match(result.package.pending.join(), /página del tour/);
    assert.match(JSON.parse(db.prepare('SELECT pending_json FROM generated WHERE id=?').get(result.additional.id).pending_json).join(), /página del tour/);
  } finally { db.close(); }
});
