const test = require('node:test');
const assert = require('node:assert');
const { open } = require('../src/db');
const revisions = require('../src/modules/revisions');
const content = require('../src/modules/content');

test('edición humana crea versión y devuelve el contenido a revisión', () => {
  const db = open(':memory:');
  const post = db.prepare("INSERT INTO posts(plataforma,titulo,objetivo_negocio,objetivo_marketing,objetivo_contenido,audiencia,etapa_embudo,cta,metrica_principal,idioma) VALUES('instagram','Demo','consulta_calificada','x','x','x','consideracion','Escríbenos','consultas','es')").run().lastInsertRowid;
  const id = db.prepare("INSERT INTO generated(post_id,tipo,idioma,contenido,estado) VALUES(?,?,?,?, 'aprobado')").run(post, 'copy', 'es', 'Versión inicial').lastInsertRowid;
  const result = revisions.edit(db, id, { contenido:'Versión corregida', segmento:'copy', motivo:'Ajustar CTA' });
  assert.equal(result.version, 1);
  assert.equal(db.prepare('SELECT estado FROM generated WHERE id=?').get(id).estado, 'revision');
  assert.equal(revisions.versions(db, id).length, 1);
  revisions.feedback(db, id, { segmento:'copy', motivo:'Usar una CTA más concreta' });
  assert.equal(db.prepare('SELECT count(*) n FROM generated_feedback').get().n, 1);
});

test('registra transiciones de lead sin perder el estado anterior', () => {
  const db = open(':memory:');
  const id = db.prepare("INSERT INTO leads(estado) VALUES('nuevo')").run().lastInsertRowid;
  const result = revisions.recordLeadTransition(db, id, 'calificado');
  assert.equal(result.anterior, 'nuevo');
  assert.equal(db.prepare('SELECT estado_anterior,estado_nuevo FROM lead_status_history WHERE lead_id=?').get(id).estado_anterior, 'nuevo');
});

test('la base conserva snapshots independientes de métricas', () => {
  const db = open(':memory:');
  const post = db.prepare("INSERT INTO posts(plataforma,titulo,objetivo_negocio,objetivo_marketing,objetivo_contenido,audiencia,etapa_embudo,cta,metrica_principal,idioma) VALUES('instagram','Demo','consulta_calificada','x','x','x','consideracion','Escríbenos','consultas','es')").run().lastInsertRowid;
  db.prepare('INSERT INTO metrics(post_id,reach,clicks) VALUES(?,?,?)').run(post, 10, 2);
  const row = db.prepare('SELECT * FROM metrics WHERE post_id=?').get(post);
  db.prepare('INSERT INTO metric_snapshots(post_id,snapshot_json) VALUES(?,?)').run(post, JSON.stringify(row));
  db.prepare('UPDATE metrics SET reach=? WHERE post_id=?').run(20, post);
  const snap = JSON.parse(db.prepare('SELECT snapshot_json FROM metric_snapshots WHERE post_id=?').get(post).snapshot_json);
  assert.equal(snap.reach, 10);
});

test('extrae partes estructuradas de un guion para regeneración por clip', () => {
  const text = '### Clip 1\nFunción: gancho\nDuración: 10 segundos\nDiálogo: “Planifica.”\n\n### Clip 2\nFunción: CTA\nDuración: 8 segundos\nDiálogo: “Escríbenos.”';
  const parts = content.parseVideoParts(text);
  assert.equal(parts.length, 2);
  assert.equal(parts[0].funcion, 'gancho');
  assert.equal(parts[1].dialogo, '“Escríbenos.”');
});

test('slide:1 regenera la primera diapositiva, no la segunda', async () => {
  const db = open(':memory:');
  const post = db.prepare("INSERT INTO posts(plataforma,titulo,objetivo_negocio,objetivo_marketing,objetivo_contenido,audiencia,etapa_embudo,cta,metrica_principal,idioma) VALUES('instagram','Demo','consulta_calificada','x','x','x','consideracion','Escríbenos','consultas','es')").run().lastInsertRowid;
  const original = { tipo:'producto', slides:[{layout:'portada',data:{h1:'Uno'}},{layout:'cierre',data:{h2:'Dos'}}] };
  const id = db.prepare("INSERT INTO generated(post_id,tipo,idioma,contenido,estado) VALUES(?,?,?,?, 'revision')").run(post, 'carrusel', 'es', JSON.stringify(original)).lastInsertRowid;
  const result = await revisions.regenerate(db, id, { segmento:'slide:1', instruccion:'Cambiar portada' }, { content:{ generate:async()=>({ contenido:JSON.stringify({ tipo:'producto', slides:[{layout:'portada',data:{h1:'Nueva'}},{layout:'cierre',data:{h2:'No tocar'}}] }) }) } });
  const output = JSON.parse(result.anterior === undefined ? db.prepare('SELECT contenido FROM generated WHERE id=?').get(id).contenido : db.prepare('SELECT contenido FROM generated WHERE id=?').get(id).contenido);
  assert.equal(output.slides[0].data.h1, 'Nueva');
  assert.equal(output.slides[1].data.h2, 'Dos');
});

test('regeneración conserva plan_idea_id cuando no hay publicación asociada', async () => {
  const db = open(':memory:');
  const plan = db.prepare("INSERT INTO editorial_plans(cadence,objetivo_negocio) VALUES('semana','consulta_calificada')").run().lastInsertRowid;
  const idea = db.prepare("INSERT INTO plan_ideas(plan_id,title,platforms,brief_json,evidence,limitations,confidence,position) VALUES(?,?,?,?,?,?,?,?)").run(plan, 'Idea', '[\"instagram\"]', JSON.stringify({ titulo:'Idea', plataforma:'instagram', objetivo_negocio:'consulta_calificada', objetivo_marketing:'x', objetivo_contenido:'x', audiencia:'x', etapa_embudo:'consideracion', cta:'x', metrica_principal:'x', idioma:'es' }), 'x', 'x', 'datos_insuficientes', 1).lastInsertRowid;
  const id = db.prepare("INSERT INTO generated(plan_idea_id,tipo,idioma,contenido,estado) VALUES(?,?,?,?, 'revision')").run(idea, 'copy', 'es', 'Inicial').lastInsertRowid;
  let received;
  await revisions.regenerate(db, id, {}, { content:{ generate:async (_db, input) => { received = input; return { contenido:'Nueva' }; } } });
  assert.equal(received.plan_idea_id, idea);
});
