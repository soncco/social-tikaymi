const { getAdapter } = require('../adapters');
const { METRICS } = require('../db');
const { snapshotIfChanged } = require('./metrics');

/**
 * importCsv - Import CSV data from a platform
 * @param {Database} db - better-sqlite3 database instance
 * @param {string} plataforma - Platform identifier (instagram, facebook, tiktok, youtube_shorts)
 * @param {string} csvText - Raw CSV text content
 * @returns {object} {imported, updated, skipped, errors[]}
 */
function importCsv(db, plataforma, csvText) {
  const adapter = getAdapter(plataforma);
  if (!adapter) {
    return { imported: 0, updated: 0, skipped: 0, errors: [`Plataforma no soportada: ${plataforma}`] };
  }

  let rows;
  try {
    rows = adapter.parse(csvText);
  } catch (err) {
    return { imported: 0, updated: 0, skipped: 0, errors: [`Error parsing CSV: ${err.message}`] };
  }

  if (!rows || rows.length === 0) {
    return { imported: 0, updated: 0, skipped: 0, errors: ['No se encontraron filas válidas en el CSV'] };
  }

  const result = {
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  // Prepare statements
  const selectPost = db.prepare('SELECT id, objetivo_negocio, objetivo_marketing, objetivo_contenido, audiencia, etapa_embudo, cta, metrica_principal, idioma FROM posts WHERE plataforma = ? AND external_id = ?');
  const insertPost = db.prepare(`
    INSERT INTO posts(
      plataforma, external_id, titulo, fecha, formato,
      objetivo_negocio, objetivo_marketing, objetivo_contenido,
      audiencia, etapa_embudo, cta, metrica_principal, idioma,
      estado
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateMetrics = db.prepare(`
    INSERT INTO metrics(post_id, ${METRICS.join(', ')})
    VALUES(?, ${METRICS.map(() => '?').join(', ')})
    ON CONFLICT(post_id) DO UPDATE SET
      ${METRICS.map(m => `${m}=excluded.${m}`).join(', ')},
      captured_at=CURRENT_TIMESTAMP
  `);

  for (const row of rows) {
    try {
      // Check if post already exists
      const existing = selectPost.get(plataforma, row.external_id);

      if (existing) {
        // Post exists - preserve objectives, update metrics only
        result.updated++;

        // Extract metric values in order
        const metricValues = METRICS.map(m => row[m] ?? null);
        updateMetrics.run(existing.id, ...metricValues);
        snapshotIfChanged(db, existing.id);
      } else {
        // New post - use 'sin_clasificar' for required fields
        result.imported++;

        const r = insertPost.run(
          plataforma,
          row.external_id || null,
          row.titulo || 'Sin título',
          row.fecha || null,
          row.formato || null,
          'sin_clasificar', // objetivo_negocio
          'sin_clasificar', // objetivo_marketing
          'sin_clasificar', // objetivo_contenido
          'sin_clasificar', // audiencia
          'sin_clasificar', // etapa_embudo
          'sin_clasificar', // cta
          'sin_clasificar', // metrica_principal
          'es', // idioma default
          // Un CSV de estadísticas describe una pieza que ya fue publicada. La
          // clasificación pendiente es independiente de su estado editorial.
          'publicado'
        );

        const postId = r.lastInsertRowid;

        // Store metrics for new post
        const metricValues = METRICS.map(m => row[m] ?? null);
        updateMetrics.run(postId, ...metricValues);
        snapshotIfChanged(db, postId);
      }
    } catch (err) {
      result.errors.push(`Error importando ${row.external_id || 'unknown'}: ${err.message}`);
      result.skipped++;
    }
  }

  return result;
}

module.exports = { importCsv };
