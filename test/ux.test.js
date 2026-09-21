const test = require('node:test');
const assert = require('node:assert');
const { open } = require('../src/db');
const posts = require('../src/modules/posts');
const { importCsv } = require('../src/modules/importer');
const { analyze } = require('../src/modules/analysis');

const CSV = `Post ID,Post Date,Text,Post Type,Reach,Impressions,Likes
x1,2026-09-01,Machu Picchu tips,Carousel,100,150,10
x2,2026-09-02,Humantay guide,Video,200,250,20`;

test('contenido importado ya publicado participa inmediatamente en análisis', () => {
  const db = open(':memory:');
  importCsv(db, 'instagram', CSV);
  const rows = db.prepare('SELECT estado FROM posts ORDER BY id').all();
  assert.deepEqual(rows.map(x => x.estado), ['publicado', 'publicado']);
});

test('clasificación masiva permite completar campos por etapas', () => {
  const db = open(':memory:');
  importCsv(db, 'instagram', CSV);
  const ids = db.prepare('SELECT id FROM posts ORDER BY id').all().map(x => x.id);
  const first = posts.bulkUpdate(db, ids, { tema: 'cusco', audiencia: 'viajeros planificando' });
  assert.equal(first.updated, 2);
  let row = db.prepare('SELECT tema,audiencia,objetivo_negocio FROM posts WHERE id=?').get(ids[0]);
  assert.deepEqual({ ...row }, { tema:'cusco', audiencia:'viajeros planificando', objetivo_negocio:'sin_clasificar' });
  posts.bulkUpdate(db, ids, { objetivo_negocio:'consulta_calificada', etapa_embudo:'consideracion' });
  row = db.prepare('SELECT objetivo_negocio,etapa_embudo FROM posts WHERE id=?').get(ids[1]);
  assert.deepEqual({ ...row }, { objetivo_negocio:'consulta_calificada', etapa_embudo:'consideracion' });
});

test('clasificación masiva valida selección, campos y vocabularios', () => {
  const db = open(':memory:');
  assert.throws(() => posts.bulkUpdate(db, [], { tema:'cusco' }), /Selecciona/);
  assert.throws(() => posts.bulkUpdate(db, [1], {}), /campo/);
  assert.throws(() => posts.bulkUpdate(db, [1], { estado:'publicado' }), /campo/);
  assert.throws(() => posts.bulkUpdate(db, [1], { idioma:'fr' }), /inválido/);
});

test('clasificación rápida informa campos pendientes y no pisa valores previos salvo autorización', () => {
  const db = open(':memory:');
  importCsv(db, 'instagram', CSV);
  const id = db.prepare('SELECT id FROM posts ORDER BY id').get().id;
  db.prepare("UPDATE posts SET objetivo_negocio='reconocimiento' WHERE id=?").run(id);
  const first = posts.bulkUpdate(db, [id], { objetivo_negocio:'confianza', cta:'Escribir por WhatsApp' });
  assert.equal(first.updated, 1);
  assert.equal(first.remaining, 1);
  assert.equal(first.missing_by_field.objetivo_marketing, 1);
  assert.equal(first.skipped_existing, 1);
  assert.equal(db.prepare('SELECT objetivo_negocio FROM posts WHERE id=?').get(id).objetivo_negocio, 'reconocimiento');
  const second = posts.bulkUpdate(db, [id], { objetivo_negocio:'confianza' }, { overwrite:true });
  assert.equal(second.updated, 1);
  assert.equal(db.prepare('SELECT objetivo_negocio FROM posts WHERE id=?').get(id).objetivo_negocio, 'confianza');
});

test('una corrección manual conserva la auditoría inicial y la marca como modificada', () => {
  const db = open(':memory:');
  importCsv(db, 'instagram', CSV);
  const id = db.prepare('SELECT id FROM posts ORDER BY id').get().id;
  db.prepare("INSERT INTO post_classification_audit(post_id,source,confidence,rationale) VALUES(?,'meta_caption','media','criterio inicial')").run(id);
  posts.bulkUpdate(db, [id], { tema:'machu_picchu' });
  const audit = db.prepare('SELECT rationale,manually_modified_at FROM post_classification_audit WHERE post_id=?').get(id);
  assert.equal(audit.rationale, 'criterio inicial');
  assert.ok(audit.manually_modified_at);
});

test('idioma mixto describe un histórico, pero una publicación nueva debe tener un idioma', () => {
  const db = open(':memory:');
  importCsv(db, 'instagram', CSV);
  const id = db.prepare('SELECT id FROM posts ORDER BY id').get().id;
  posts.bulkUpdate(db, [id], { idioma:'mixto' }, { overwrite:true });
  assert.equal(db.prepare('SELECT idioma FROM posts WHERE id=?').get(id).idioma, 'mixto');
  assert.match(analyze(db).idioma.dato_origen, /es: 1 publicaciones/);
  assert.throws(() => posts.create(db, {
    plataforma:'instagram', titulo:'Nueva', objetivo_negocio:'reconocimiento',
    objetivo_marketing:'atraer', objetivo_contenido:'inspirar', audiencia:'viajeros',
    etapa_embudo:'alcance', cta:'Escribir', metrica_principal:'alcance', idioma:'mixto'
  }), /un solo idioma/);
});
