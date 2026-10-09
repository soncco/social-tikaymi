// Edición de la Biblioteca: información verificada y fotos/videos reales.
// La URL de un recurso no se edita: identifica la autorización (una foto retirada sigue retirada).
const C = require('../constants');
const err = (status, message) => Object.assign(new Error(message), { status });
const text = v => String(v ?? '').trim();

function updateInfo(db, id, body = {}) {
  const current = db.prepare('SELECT * FROM approved_info WHERE id=?').get(id);
  if (!current) throw err(404, 'No existe');
  const next = {
    tipo: body.tipo ?? current.tipo,
    titulo: body.titulo !== undefined ? text(body.titulo) : current.titulo,
    texto: body.texto !== undefined ? text(body.texto) : current.texto,
    fuente: body.fuente !== undefined ? (text(body.fuente) || null) : current.fuente,
    autorizado_publicar: body.autorizado_publicar !== undefined ? (body.autorizado_publicar ? 1 : 0) : current.autorizado_publicar,
  };
  if (!C.INFO_TIPOS.includes(next.tipo)) throw err(400, `tipo inválido: ${next.tipo}`);
  if (!next.titulo || !next.texto) throw err(400, 'titulo y texto son obligatorios');
  db.prepare('UPDATE approved_info SET tipo=?,titulo=?,texto=?,fuente=?,autorizado_publicar=? WHERE id=?')
    .run(next.tipo, next.titulo, next.texto, next.fuente, next.autorizado_publicar, id);
  return db.prepare('SELECT * FROM approved_info WHERE id=?').get(id);
}

function updateAsset(db, id, body = {}) {
  const current = db.prepare('SELECT * FROM assets WHERE id=?').get(id);
  if (!current) throw err(404, 'Recurso inexistente');
  if (body.url !== undefined && body.url !== current.url) throw err(400, 'La URL no se edita: agrega el recurso nuevo y retira el anterior');
  const next = {
    tipo: body.tipo ?? current.tipo,
    descripcion: body.descripcion !== undefined ? (text(body.descripcion) || null) : current.descripcion,
    destino: body.destino !== undefined ? (text(body.destino) || null) : current.destino,
    autorizado_publicar: body.autorizado_publicar !== undefined ? (body.autorizado_publicar === true ? 1 : 0) : current.autorizado_publicar,
  };
  if (!C.ASSET_TIPOS.includes(next.tipo)) throw err(400, `tipo inválido: ${next.tipo}`);
  db.prepare('UPDATE assets SET tipo=?,descripcion=?,destino=?,autorizado_publicar=? WHERE id=?')
    .run(next.tipo, next.descripcion, next.destino, next.autorizado_publicar, id);
  return db.prepare('SELECT * FROM assets WHERE id=?').get(id);
}

module.exports = { updateInfo, updateAsset };
