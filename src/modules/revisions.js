// Correcciones humanas y versionado de borradores. Cada edición vuelve a revisión.
const { isCloudinaryPhoto } = require('../../public/visual-contract');
const ads = require('./ads');
const paid = require('./paid');
const err = (status, message) => Object.assign(new Error(message), { status });

// URLs de foto de una pieza visual: imagen única (resource.url) o carrusel (imageUrl, antes/después y galería).
function photoUrls(tipo, contenido) {
  let json; try { json = JSON.parse(contenido); } catch { return []; }
  if (tipo === 'imagen_unica') return [json?.resource?.url].filter(Boolean);
  if (tipo !== 'carrusel' || !Array.isArray(json?.slides)) return [];
  return json.slides.flatMap(s => { const d = s?.data || {}; return [d.imageUrl, d.beforeUrl, d.afterUrl, ...(Array.isArray(d.photos) ? d.photos.map(p => p?.imageUrl) : [])]; }).filter(Boolean);
}

// Pegar una foto de Cloudinary de Tikaymi es la autorización humana: queda registrada en Biblioteca
// para trazabilidad. Una URL ya registrada no se toca, así una foto retirada sigue retirada.
function registerPastedPhotos(db, id, tipo, contenido) {
  const urls = [...new Set(photoUrls(tipo, contenido).filter(isCloudinaryPhoto))];
  const exists = db.prepare('SELECT 1 FROM assets WHERE url=?');
  const insert = db.prepare("INSERT INTO assets(tipo,url,descripcion,autorizado_publicar) VALUES('foto',?,?,1)");
  return urls.filter(url => !exists.get(url)).map(url => (insert.run(url, `Cloudinary · pegada en borrador #${id}`), url));
}

function getGenerated(db, id) {
  const row = db.prepare('SELECT * FROM generated WHERE id=?').get(id);
  if (!row) throw err(404, 'No existe el contenido generado');
  return row;
}

function versions(db, id) {
  getGenerated(db, id);
  return db.prepare('SELECT * FROM generated_revisions WHERE generated_id=? ORDER BY version DESC').all(id);
}

function feedback(db, id, { segmento = null, motivo } = {}) {
  getGenerated(db, id);
  if (!String(motivo || '').trim()) throw err(400, 'motivo es obligatorio');
  const result = db.prepare('INSERT INTO generated_feedback(generated_id,segmento,motivo) VALUES(?,?,?)')
    .run(id, segmento, String(motivo).trim());
  return { id: Number(result.lastInsertRowid), generated_id: Number(id), segmento, motivo: String(motivo).trim() };
}

function edit(db, id, { contenido, segmento = null, motivo } = {}) {
  const current = getGenerated(db, id);
  if (!String(contenido || '').trim()) throw err(400, 'contenido es obligatorio');
  if (!String(motivo || '').trim()) throw err(400, 'motivo es obligatorio');
  if(current.tipo==='anuncio_meta'){
    let before,after;try{before=JSON.parse(current.contenido);after=JSON.parse(contenido);}catch{throw err(422,'Anuncio: JSON inválido');}
    const validation=ads.validate(after,{ready:true});
    if(!validation.ok)throw err(422,validation.errors.join('; '));
    for(const previous of before.variantes||[]){const next=after.variantes.find(v=>v.id===previous.id);if(next&&next.campaign_code!==previous.campaign_code)throw err(409,`Conserva el código ${previous.campaign_code} de la variante ${previous.id}`);}
    if(JSON.stringify(before.precio)!==JSON.stringify(after.precio))throw err(409,'El precio del anuncio no se cambia en el JSON. Actualiza el brief y el visual con condiciones confirmadas.');
  }
  return db.transaction(() => {
    const version = (db.prepare('SELECT COALESCE(MAX(version),0) n FROM generated_revisions WHERE generated_id=?').get(id).n || 0) + 1;
    const revisionId = db.prepare('INSERT INTO generated_revisions(generated_id,version,contenido,segmento,motivo) VALUES(?,?,?,?,?)')
      .run(id, version, String(contenido), segmento, String(motivo).trim()).lastInsertRowid;
    db.prepare("UPDATE generated SET contenido=?, estado='revision' WHERE id=?").run(String(contenido), id);
    if(current.tipo==='anuncio_meta'){
      paid.syncVariants(db,id);
      db.prepare("UPDATE ad_campaigns SET status='contenido_revision' WHERE generated_id=? AND status IN ('creatividad_aprobada','campana_preparada')").run(id);
    }
    const fotos_registradas = registerPastedPhotos(db, id, current.tipo, String(contenido));
    return { id: Number(id), revision_id: Number(revisionId), version, estado: 'revision', segmento, motivo: String(motivo).trim(), anterior: current.contenido, fotos_registradas };
  })();
}

function recordLeadTransition(db, id, estado) {
  const current = db.prepare('SELECT estado FROM leads WHERE id=?').get(id);
  if (!current) throw err(404, 'No existe el lead');
  if (!estado) throw err(400, 'estado es obligatorio');
  return db.transaction(() => {
    db.prepare('INSERT INTO lead_status_history(lead_id,estado_anterior,estado_nuevo) VALUES(?,?,?)').run(id, current.estado, estado);
    db.prepare('UPDATE leads SET estado=? WHERE id=?').run(estado, id);
    return { id: Number(id), estado, anterior: current.estado };
  })();
}

async function regenerate(db, id, { segmento = 'pieza', automatic_visual_repair = false, instruccion = 'Corrige la pieza manteniendo el mensaje y CTA; entrega una versión completa lista para revisión.' } = {}, { content, fetchImpl } = {}) {
  const current = getGenerated(db, id);
  if (!content?.generate) throw err(500, 'Generador no disponible');
  if(automatic_visual_repair===true){
    if(!['imagen_unica','carrusel'].includes(current.tipo))throw err(400,'La reparación visual automática solo aplica a imagen o carrusel');
    const result=db.prepare('UPDATE generated SET visual_repair_used=1 WHERE id=? AND visual_repair_used=0').run(id);
    if(!result.changes)throw err(409,'Ya se usó la corrección automática. Acorta el campo indicado y guarda una corrección humana.');
  }
  const pack=current.package_id ? db.prepare('SELECT brief_json FROM content_packages WHERE id=?').get(current.package_id) : null;
  // Un anuncio regenerado conserva sus códigos de campaña: los leads ya registrados siguen atribuidos.
  let adBase; if (current.tipo === 'anuncio_meta') try { adBase = JSON.parse(current.contenido).codigo_base; } catch { adBase = undefined; }
  const packBrief = pack ? JSON.parse(pack.brief_json) : undefined;
  const generated = await content.generate(db, {
    post_id: current.post_id, plan_idea_id: current.plan_idea_id || undefined, tipo: current.tipo, idioma: current.idioma,
    brief:packBrief, precio:packBrief?.precio || undefined, ad_profile:packBrief?.ad_profile,
    platform_override:current.plataforma || undefined, ad_base:adBase,
    source_content: current.contenido, strict: ['imagen_unica','carrusel','guion','prompt_flow'].includes(current.tipo),
    repair_feedback: `Segmento a corregir: ${segmento}\nMotivo: ${instruccion}`
  }, { fetchImpl, save: false, repair: false });
  let replacement = generated.contenido;
  if(current.tipo==='imagen_unica') {
    const before=JSON.parse(current.contenido), after=JSON.parse(replacement);
    if(before.copies) after.copies=before.copies;
    replacement=JSON.stringify(after,null,2);
  }
  // Los carruseles tienen un contrato estructurado: si se solicita slide:N,
  // reemplazamos solo esa diapositiva y conservamos las demás versiones.
  const match = String(segmento).match(/^slide:(\d+)$/i);
  if (match && current.tipo === 'carrusel') {
    try {
      const before = JSON.parse(current.contenido);
      const after = JSON.parse(generated.contenido);
      const index = Number(match[1]) - 1;
      if (!Array.isArray(before.slides) || !after.slides?.[index] || !before.slides[index]) throw err(422, 'La diapositiva solicitada no existe en el carrusel');
      before.slides[index] = after.slides[index];
      replacement = JSON.stringify(before, null, 2);
    } catch (e) {
      if (e.status) throw e;
      throw err(502, 'No se pudo regenerar estructuralmente la diapositiva');
    }
  }
  const clipMatch = String(segmento).match(/^clip:(\d+)$/i);
  if (clipMatch && (current.tipo === 'guion' || current.tipo === 'prompt_flow')) {
    const before = content.splitVideoClips(current.contenido);
    const after = content.splitVideoClips(generated.contenido);
    const index = Number(clipMatch[1]) - 1;
    if (!before[index] || !after[index]) throw err(422, 'El clip solicitado no existe en el guion');
    const beforeStart = current.contenido.indexOf(before[index].text);
    const afterStart = generated.contenido.indexOf(after[index].text);
    const replacementText = generated.contenido.slice(afterStart, afterStart + after[index].text.length);
    const heading = current.contenido.slice(Math.max(0, current.contenido.lastIndexOf('\n', beforeStart - 2) + 1), beforeStart);
    const start = beforeStart - heading.length;
    const nextStart = before[index + 1] ? current.contenido.indexOf(before[index + 1].text) : current.contenido.length;
    replacement = `${current.contenido.slice(0, start)}${heading}${replacementText}${current.contenido.slice(nextStart)}`;
  }
  const saved = edit(db, id, { contenido: replacement, segmento, motivo: instruccion });
  if (Array.isArray(generated.pending) && ['copy','anuncio_meta'].includes(current.tipo)) db.prepare('UPDATE generated SET pending_json=? WHERE id=?').run(JSON.stringify(generated.pending), id);
  return saved;
}

module.exports = { versions, feedback, edit, recordLeadTransition, regenerate };
