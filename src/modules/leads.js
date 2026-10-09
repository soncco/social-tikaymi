const C=require('../constants');
const err=(status,message)=>Object.assign(new Error(message),{status});
function create(db,b={}){
  if(b.estado&&!C.LEAD_ESTADOS.includes(b.estado))throw err(400,'estado inválido');
  const code=String(b.campaign_code||'').trim().toUpperCase()||null;
  const post=code&&db.prepare('SELECT id FROM posts WHERE UPPER(campaign_code)=?').get(code);
  const variant=code&&db.prepare('SELECT id FROM ad_variants WHERE code=?').get(code);
  if(post&&variant)throw err(409,'El código coincide con publicación orgánica y anuncio. Corrige el código antes de atribuir.');
  if(b.post_id&&variant)throw err(409,'El código publicitario no puede atribuirse también a un post orgánico');
  if(b.acquired_at&&!/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(b.acquired_at))throw err(400,'Fecha de adquisición inválida');
  const id=db.prepare('INSERT INTO leads(post_id,ad_variant_id,campaign_code,fuente,estado,fecha_viaje,viajeros,notas,country_residence,acquired_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run(b.post_id??post?.id??null,variant?.id??null,code,b.fuente??null,b.estado??'nuevo',b.fecha_viaje??null,b.viajeros??null,b.notas??null,b.country_residence??null,b.acquired_at??new Date().toISOString()).lastInsertRowid;
  return {id:Number(id),atribuido:!!(b.post_id||post||variant),origen:variant?'publicidad':b.post_id||post?'organico':'desconocido',ad_variant_id:variant?.id??null};
}
module.exports={create};
