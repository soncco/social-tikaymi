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
