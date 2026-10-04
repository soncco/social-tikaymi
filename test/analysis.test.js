const test = require('node:test');
const assert = require('node:assert');
const { open } = require('../src/db');
const { analyze, confianza } = require('../src/modules/analysis');

const base = {
  titulo: 'Humantay', objetivo_negocio: 'consulta_calificada', objetivo_marketing: 'resolver duda',
  objetivo_contenido: 'responder', audiencia: 'viajeros planificando', etapa_embudo: 'consideracion',
  cta: 'WhatsApp HUMANTAY', metrica_principal: 'consultas', idioma: 'es', estado: 'publicado',
};

const COLS = ['plataforma', 'titulo', 'fecha', 'formato', 'idioma', 'tema', 'objetivo_negocio', 'objetivo_marketing',
  'objetivo_contenido', 'audiencia', 'etapa_embudo', 'cta', 'metrica_principal', 'campaign_code', 'estado'];
const MET = ['reach', 'plays', 'retention', 'completed_plays', 'likes', 'saves', 'shares', 'profile_visits', 'clicks', 'conversations'];

function addPost(db, p, m) {
  const row = { ...base, ...p };
  const id = db.prepare(`INSERT INTO posts(${COLS}) VALUES(${COLS.map(() => '?')})`).run(COLS.map(k => row[k] ?? null)).lastInsertRowid;
  if (m) db.prepare(`INSERT INTO metrics(post_id,${MET}) VALUES(${['?', ...MET.map(() => '?')]})`).run([id, ...MET.map(k => m[k] ?? null)]);
  return id;
}
const addLead = (db, post_id, estado) => db.prepare('INSERT INTO leads(post_id,estado) VALUES(?,?)').run(post_id, estado);
const dia = n => new Date(Date.UTC(2026, 0, n)).toISOString().slice(0, 10);

test('NULL no es 0: se ignora y se reporta cobertura', () => {
  const db = open(':memory:');
  addPost(db, { plataforma: 'instagram', fecha: dia(1), formato: 'reel', tema: 'lagunas' }, { retention: 0.8, reach: 1000 });
  addPost(db, { plataforma: 'instagram', fecha: dia(20), formato: 'reel', tema: 'lagunas' }, { retention: null, reach: null });
  const a = analyze(db);
  const at = a.por_plataforma.instagram.atencion;
  assert.equal(at.retention.valor, 0.8, 'la media ignora el NULL en vez de promediarlo como 0');
  assert.equal(at.retention.n_datos, 1);
  assert.equal(at.retention.cobertura, 0.5);
  assert.equal(at.reach.valor, 1000);
  assert.equal(at.plays.valor, null, 'sin ningún dato el valor es null, no 0');
  assert.equal(at.plays.sin_datos, true);
});

test('confianza por umbrales (§6)', () => {
  assert.equal(confianza(4, 30, 10), 'datos_insuficientes', '<5 publicaciones');
  assert.equal(confianza(30, 13, 10), 'datos_insuficientes', '<14 días de período');
  assert.equal(confianza(5, 14, 0), 'senal_inicial');
  assert.equal(confianza(9, 30, 0), 'senal_inicial');
  assert.equal(confianza(10, 30, 0), 'patron_probable');
  assert.equal(confianza(19, 30, 5), 'patron_probable');
  assert.equal(confianza(20, 30, 0), 'patron_probable', '>=20 pero sin leads atribuidos no confirma');
  assert.equal(confianza(20, 30, 1), 'patron_probable', 'un solo lead no confirma un patrón');
  assert.equal(confianza(20, 30, 3), 'patron_confirmado');

  const db = open(':memory:');
  for (let i = 1; i <= 4; i++) addPost(db, { plataforma: 'tiktok', fecha: dia(i * 5), tema: 'lagunas' }, { retention: 0.5 });
  const pocos = analyze(db);
  assert.equal(pocos.confianza, 'datos_insuficientes');
  assert.ok(pocos.recomendaciones.every(r => r.tipo !== 'recomendacion' || r.objetivo === 'calidad de datos'),
    'con datos insuficientes sólo hipótesis sobre rendimiento');

  for (let i = 5; i <= 12; i++) addPost(db, { plataforma: 'tiktok', fecha: dia(i * 2), tema: 'lagunas' }, { retention: 0.5 });
  assert.equal(analyze(db).confianza, 'patron_probable');
});

test('conversión declara sin_datos cuando no hay leads atribuidos', () => {
  const db = open(':memory:');
  for (let i = 1; i <= 6; i++) addPost(db, { plataforma: 'instagram', fecha: dia(i * 3), tema: 'lagunas' }, { saves: 3, shares: 1 });
  db.prepare("INSERT INTO leads(post_id,estado) VALUES(NULL,'cotizado')").run(); // lead sin atribuir
  const a = analyze(db);
  assert.equal(a.conversion.sin_datos, true);
  assert.ok(a.conversion.motivo);
  assert.equal(a.mejores.conversion.sin_datos, true, 'no se declara ganador por conversión sin atribución');
  assert.equal(a.resumen.cotizaciones, 1, 'el lead existe en el resumen aunque no esté atribuido');

  const id = addPost(db, { plataforma: 'instagram', fecha: dia(21), tema: 'lagunas' }, { saves: 9 });
  addLead(db, id, 'reservado');
  addLead(db, id, 'calificado');
  const b = analyze(db);
  assert.equal(b.conversion.sin_datos, false);
  assert.equal(b.conversion.consultas, 2);
  assert.equal(b.conversion.cotizaciones, 1);
  assert.equal(b.conversion.reservas, 1);
  assert.equal(b.conversion.post_a_consulta, 0.2857, '2 consultas / 7 publicaciones, redondeado');
  assert.equal(b.mejores.conversion.post_id, id);
});

test('nunca se suman métricas de plataformas distintas', () => {
  const db = open(':memory:');
  addPost(db, { plataforma: 'instagram', fecha: dia(1), formato: 'reel', tema: 'lagunas' }, { reach: 100, retention: 0.9 });
  addPost(db, { plataforma: 'tiktok', fecha: dia(20), formato: 'reel', tema: 'lagunas' }, { reach: 5000, retention: 0.3 });
  const g = analyze(db).por_formato.reel;
  assert.equal(g.n, 2);
  assert.deepEqual(g.plataformas, ['instagram', 'tiktok']);
  assert.equal(g.atencion.sin_datos, true, 'el grupo mixto no expone métricas agregadas');
  assert.equal(g.intencion.sin_datos, true);
  assert.match(g.atencion.motivo, /plataformas distintas/);
  assert.equal(g.por_plataforma.instagram.atencion.reach.valor, 100);
  assert.equal(g.por_plataforma.tiktok.atencion.reach.valor, 5000);
});

test('sin_clasificar queda pendiente y fuera del análisis por tema', () => {
  const db = open(':memory:');
  addPost(db, { plataforma: 'instagram', fecha: dia(1), tema: 'lagunas' }, { reach: 10 });
  const sc = addPost(db, { plataforma: 'instagram', fecha: dia(2), tema: 'sin_clasificar' }, { reach: 10 });
  addPost(db, { plataforma: 'instagram', fecha: dia(3), tema: null }, { reach: 10 });
  const a = analyze(db);
  assert.deepEqual(Object.keys(a.por_tema), ['lagunas']);
  assert.equal(a.pendientes_clasificacion.length, 2);
  assert.ok(a.pendientes_clasificacion.some(p => p.post_id === sc));
});

test('idioma: sólo es/en/dos_versiones/probar_ambos o datos_insuficientes; sin likes en los rankings', () => {
  const db = open(':memory:');
  for (let i = 1; i <= 4; i++) addPost(db, { plataforma: 'instagram', fecha: dia(i * 2), idioma: 'es', tema: 'lagunas' }, { likes: 999, saves: 1 });
  for (let i = 1; i <= 4; i++) {
    const id = addPost(db, { plataforma: 'instagram', fecha: dia(20 + i), idioma: 'en', tema: 'lagunas' }, { likes: 1, saves: 8 });
    if (i < 3) addLead(db, id, 'calificado');
  }
  const a = analyze(db);
  assert.ok(['es', 'en', 'dos_versiones', 'probar_ambos', 'datos_insuficientes'].includes(a.idioma.recomendacion));
  assert.equal(a.idioma.recomendacion, 'en', 'gana el idioma con más consultas, no con más likes');
  assert.equal(a.mejores.guardados_compartidos.plataforma, 'instagram');
  assert.ok(a.mejores.guardados_compartidos.valor >= 8, 'el ranking usa guardados/compartidos, no me gusta');
  assert.ok(a.recomendaciones.every(r => ['dato_origen', 'objetivo', 'formato_y_por_que', 'cta', 'metrica_exito', 'limitaciones', 'confianza', 'tipo']
    .every(k => k in r)), 'cada recomendación explica dato, objetivo, formato, CTA, métrica y limitaciones');
});
