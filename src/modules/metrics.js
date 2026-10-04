const { METRICS } = require('../db');

function snapshotIfChanged(db, postId) {
  // `metrics.captured_at` cambia en cada importación aunque los valores no
  // hayan cambiado; no lo usamos para decidir si existe un nuevo snapshot.
  const row = db.prepare(`SELECT post_id,${METRICS.join(',')} FROM metrics WHERE post_id=?`).get(postId);
  if (!row) return null;
  const latest = db.prepare('SELECT snapshot_json FROM metric_snapshots WHERE post_id=? ORDER BY id DESC LIMIT 1').get(postId);
  const json = JSON.stringify(row);
  if (latest?.snapshot_json === json) return null;
  const id = db.prepare('INSERT INTO metric_snapshots(post_id,snapshot_json) VALUES(?,?)').run(postId, json).lastInsertRowid;
  return { id: Number(id), post_id: Number(postId) };
}

module.exports = { snapshotIfChanged };
