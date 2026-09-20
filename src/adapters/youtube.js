const { parse: parseCsv } = require('csv-parse/sync');

// YouTube Studio - adapts exports from YouTube Creator Studio (Shorts)
// Typical columns: Video ID, Upload Date, Video Title, Watch Time (minutes),
// Average View Duration (%), Impressions, Click-through Rate,
// Average Percentage Viewed (%), Likes, Comments, Shares, etc.

const plataformas = ['youtube_shorts'];

function parse(csvText) {
  const records = parseCsv(csvText, { columns: true, skip_empty_lines: true });

  return records.map(row => {
    const norm = normalizeHeaders(row);

    if (!norm.external_id) return null;

    return {
      external_id: norm.external_id,
      titulo: norm.titulo || 'Sin título',
      fecha: norm.fecha || null,
      formato: 'video',
      reach: null, // YouTube doesn't report "reach"
      impressions: parseMetric(norm.impressions),
      plays: parseMetric(norm.plays), // solo vistas reales; watch time no es sustituto
      // YouTube's "Average Percentage Viewed" = % promedio visto
      retention: parseMetric(norm.avg_percentage_viewed), // Stored as % directly
      completed_plays: null, // YouTube doesn't provide raw completed count via CSV
      likes: parseMetric(norm.likes),
      comments: parseMetric(norm.comments),
      shares: parseMetric(norm.shares),
      saves: null, // YouTube doesn't have "saves" concept
      profile_visits: null, // YouTube tracks "subscribers gained" not general profile visits
      clicks: parseMetric(norm.clicks),
      conversations: null // YouTube doesn't provide via CSV
    };
  }).filter(r => r !== null);
}

function normalizeHeaders(row) {
  const headers = Object.keys(row);
  const result = {};

  // Extract external_id (usually "Video ID")
  const id = headers.find(h =>
    h.toLowerCase().includes('video id') ||
    h.toLowerCase().includes('vid') ||
    h === 'Video ID'
  );
  result.external_id = id ? (row[id] || '').toString().trim() : null;

  // Extract titulo (usually "Video Title" or "Title")
  const title = headers.find(h =>
    h.toLowerCase().includes('title') ||
    h.toLowerCase().includes('name') ||
    h === 'Video Title'
  );
  result.titulo = title ? (row[title] || '').toString().trim().substring(0, 255) : null;

  // Extract fecha (usually "Upload Date" or similar)
  const date = headers.find(h =>
    h.toLowerCase().includes('date') ||
    h.toLowerCase().includes('upload') ||
    h === 'Upload Date'
  );
  result.fecha = date ? (row[date] || '').toString().trim() : null;

  // Metrics
  result.impressions = findMetric(row, headers, ['impression']);

  // YouTube retention = "Average percentage viewed" (% promedio visto). Se guarda tal cual en `retention`;
  // no es comparable con la retención de otras plataformas. Watch time NO se usa como proxy de reproducciones.
  result.avg_percentage_viewed = findMetric(row, headers, ['average percentage viewed', 'avg percentage viewed']);
  result.plays = findMetric(row, headers, ['views']);

  result.likes = findMetric(row, headers, ['likes']);
  result.comments = findMetric(row, headers, ['comment']);
  result.shares = findMetric(row, headers, ['share']);
  result.clicks = findMetric(row, headers, ['click']);

  return result;
}

function findMetric(row, headers, searchTerms) {
  const col = headers.find(h => {
    const lower = h.toLowerCase();
    return searchTerms.some(term => lower.includes(term));
  });
  return col ? row[col] : null;
}

function parseMetric(val) {
  if (!val) return null;
  const str = String(val).trim();
  if (!str) return null;
  // Remove % sign, commas, and other common formatting
  const clean = str.replace(/[%,]/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

module.exports = { plataformas, parse };
