// Correcciones humanas y versionado de borradores. Cada edición vuelve a revisión.
const err = (status, message) => Object.assign(new Error(message), { status });

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
  return db.transaction(() => {
    const version = (db.prepare('SELECT COALESCE(MAX(version),0) n FROM generated_revisions WHERE generated_id=?').get(id).n || 0) + 1;
    const revisionId = db.prepare('INSERT INTO generated_revisions(generated_id,version,contenido,segmento,motivo) VALUES(?,?,?,?,?)')
      .run(id, version, String(contenido), segmento, String(motivo).trim()).lastInsertRowid;
    db.prepare("UPDATE generated SET contenido=?, estado='revision' WHERE id=?").run(String(contenido), id);
    return { id: Number(id), revision_id: Number(revisionId), version, estado: 'revision', segmento, motivo: String(motivo).trim(), anterior: current.contenido };
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

async function regenerate(db, id, { segmento = 'pieza', instruccion = 'Corrige la pieza manteniendo el mensaje y CTA; entrega una versión completa lista para revisión.' } = {}, { content, fetchImpl } = {}) {
  const current = getGenerated(db, id);
  if (!content?.generate) throw err(500, 'Generador no disponible');
  const generated = await content.generate(db, {
    post_id: current.post_id, plan_idea_id: current.plan_idea_id || undefined, tipo: current.tipo, idioma: current.idioma,
    source_content: current.contenido, strict: current.tipo === 'carrusel' || current.tipo === 'guion' || current.tipo === 'prompt_flow',
    repair_feedback: `Segmento a corregir: ${segmento}\nMotivo: ${instruccion}`
  }, { fetchImpl, save: false, repair: false });
  let replacement = generated.contenido;
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
  return edit(db, id, { contenido: replacement, segmento, motivo: instruccion });
}

module.exports = { versions, feedback, edit, recordLeadTransition, regenerate };
