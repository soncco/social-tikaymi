const { createHash } = require('node:crypto');
const hash = content => createHash('sha256').update(content).digest('hex');
function record(db,id,{contenido,errors}={}) {
  const current=db.prepare('SELECT * FROM generated WHERE id=?').get(id);
  const fail=(message,status=422)=>{throw Object.assign(new Error(message),{status});};
  if(!current)fail('Borrador inexistente',404);
  if(!['imagen_unica','carrusel'].includes(current.tipo))fail('Solo se validan piezas visuales');
  if(current.contenido!==contenido)fail('El contenido cambió. Guarda y vuelve a comprobar la composición.');
  if(!Array.isArray(errors) || errors.some(e=>typeof e!=='string'))fail('errors debe ser una lista de textos');
  db.prepare('INSERT INTO visual_render_checks(generated_id,content_hash,ok,errors_json) VALUES(?,?,?,?) ON CONFLICT(generated_id) DO UPDATE SET content_hash=excluded.content_hash,ok=excluded.ok,errors_json=excluded.errors_json,checked_at=CURRENT_TIMESTAMP').run(id,hash(contenido),errors.length?0:1,JSON.stringify(errors));
  if(errors.length && current.estado==='aprobado')db.prepare("UPDATE generated SET estado='revision' WHERE id=?").run(id);
  return {ok:errors.length===0,errors};
}
function ready(db,id,contenido) {
  const row=db.prepare('SELECT * FROM visual_render_checks WHERE generated_id=?').get(id);
  return !!row?.ok && row.content_hash===hash(contenido);
}
function inspect(db,row){
  const check=db.prepare('SELECT * FROM visual_render_checks WHERE generated_id=?').get(row.id);
  if(!check || check.content_hash!==hash(row.contenido))return {estado:'pendiente',errors:[]};
  return {estado:check.ok?'comprobado':'revision_fallida',errors:JSON.parse(check.errors_json)};
}
module.exports={record,ready,inspect};
