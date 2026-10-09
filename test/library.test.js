const test = require('node:test');
const assert = require('node:assert/strict');
const { open } = require('../src/db');
const library = require('../src/modules/library');

test('biblioteca: editar información conserva lo no enviado y valida tipo y textos', () => {
  const db = open(':memory:');
  const id = db.prepare("INSERT INTO approved_info(tipo,titulo,texto,autorizado_publicar,fuente) VALUES('servicio','Tour 5 días','Texto',1,'Deicy')").run().lastInsertRowid;
  const row = library.updateInfo(db, id, { titulo:'  Tour Cusco 5 días ', texto:'Incluye tren' });
  assert.deepEqual([row.titulo, row.texto, row.fuente, row.autorizado_publicar], ['Tour Cusco 5 días', 'Incluye tren', 'Deicy', 1]);
  assert.equal(library.updateInfo(db, id, { autorizado_publicar:false, fuente:'' }).fuente, null);
  assert.equal(db.prepare('SELECT autorizado_publicar FROM approved_info WHERE id=?').get(id).autorizado_publicar, 0);
  assert.throws(() => library.updateInfo(db, id, { texto:'  ' }), /obligatorios/);
  assert.throws(() => library.updateInfo(db, id, { tipo:'otro_invalido' }), /tipo inválido/);
  assert.throws(() => library.updateInfo(db, 999, {}), /No existe/);
  db.close();
});

test('biblioteca: editar recurso cambia descripción y destino, pero nunca la URL', () => {
  const db = open(':memory:');
  const url = 'https://res.cloudinary.com/tikaymi/image/upload/x.jpg';
  const id = db.prepare("INSERT INTO assets(tipo,url,descripcion,autorizado_publicar) VALUES('foto',?,'Cloudinary · pegada en borrador #20',1)").run(url).lastInsertRowid;
  const row = library.updateAsset(db, id, { descripcion:'City Tour · Qoricancha', destino:'Cusco', url });
  assert.deepEqual([row.descripcion, row.destino, row.url, row.autorizado_publicar], ['City Tour · Qoricancha', 'Cusco', url, 1]);
  assert.equal(library.updateAsset(db, id, { autorizado_publicar:false }).autorizado_publicar, 0);
  assert.throws(() => library.updateAsset(db, id, { url:'https://otra.invalid/y.jpg' }), /URL no se edita/);
  assert.throws(() => library.updateAsset(db, 999, {}), /inexistente/);
  db.close();
});
