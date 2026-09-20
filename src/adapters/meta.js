const { parse: parseCsv } = require('csv-parse/sync');

// Meta (Instagram/Facebook) - adapts exports from Meta Business Suite
// Exported columns vary by account/language, but typically include:
// ES: Identificación de la publicación, Tipo de publicación, Fecha de publicación, Texto, Alcance, Impresiones, Guardados, Compartidos, Me gusta, Comentarios, Visitas al perfil, Reproducciones, Retención %
// EN: Post ID, Post Type, Post Date, Text, Reach, Impressions, Saves, Shares, Likes, Comments, Profile Visits, Plays, Retention %

const plataformas = ['instagram', 'facebook'];

function parse(csvText) {
  const records = parseCsv(csvText, { columns: true, skip_empty_lines: true });

  return records.map(row => {
    // Normalize column names to handle both ES and EN exports
    const norm = normalizeHeaders(row);

    if (!norm.external_id) return null;

    return {
      external_id: norm.external_id,
      titulo: norm.titulo || 'Sin título',
      fecha: norm.fecha || null,
      formato: norm.formato || null,
      reach: parseMetric(norm.reach),
      impressions: parseMetric(norm.impressions),
      plays: parseMetric(norm.plays),
      retention: parseMetric(norm.retention), // % promedio visto de la plataforma
      completed_plays: null, // Meta doesn't provide this
      likes: parseMetric(norm.likes),
      comments: parseMetric(norm.comments),
      shares: parseMetric(norm.shares),
      saves: parseMetric(norm.saves),
      profile_visits: parseMetric(norm.profile_visits),
      clicks: parseMetric(norm.clicks),
      conversations: null // Meta doesn't provide via CSV
    };
  }).filter(r => r !== null);
}

function normalizeHeaders(row) {
  const headers = Object.keys(row);
  const result = {};

  // Extract external_id (ES: "Identificación de la publicación", EN: "Post ID")
  const id = headers.find(h =>
    h.toLowerCase().includes('identificaci') ||
    h.toLowerCase().includes('post id') ||
    h === 'Post ID' || h === 'Identificación de la publicación'
  );
  result.external_id = id ? (row[id] || '').toString().trim() : null;

  // Extract titulo (ES: "Texto", EN: "Text" or description)
  const title = headers.find(h =>
    h.toLowerCase() === 'text' ||
    h.toLowerCase() === 'texto' ||
    h.toLowerCase().includes('contenido') ||
    ['title', 'título', 'titulo', 'description', 'descripción', 'descripcion'].includes(h.toLowerCase())
  );
  result.titulo = title ? (row[title] || '').toString().trim().substring(0, 255) : null;

  // Extract fecha (ES: "Fecha de publicación", EN: "Post Date")
  const date = headers.find(h =>
    h.toLowerCase().includes('fecha') ||
    h.toLowerCase().includes('date') ||
    h.toLowerCase().includes('publish time') ||
    h.toLowerCase().includes('hora de publicaci') ||
    h === 'Post Date' || h === 'Fecha de publicación'
  );
  result.fecha = date ? (row[date] || '').toString().trim() : null;

  // Extract formato (post type: Image, Video, Carousel, Story, Reel, etc.)
  const type = headers.find(h =>
    h.toLowerCase().includes('tipo') ||
    h.toLowerCase().includes('type') ||
    h === 'Post Type' || h === 'Tipo de publicación'
  );
  result.formato = type ? mapFormatoMeta((row[type] || '').toString().toLowerCase()) : null;

  // Metrics
  result.reach = findMetric(row, headers, ['reach', 'alcance']);
  result.impressions = findMetric(row, headers, ['impression', 'impresiones']);
  result.plays = findMetric(row, headers, ['plays', 'reproducciones']);
  result.retention = findMetric(row, headers, ['retention', 'retenci']); // Stored as-is (% promedio)
  result.likes = findMetric(row, headers, ['likes', 'me gusta', 'me gustan']);
  result.comments = findMetric(row, headers, ['comment', 'comentarios']);
  result.shares = findMetric(row, headers, ['shares', 'compartidos', 'compartidas']);
  result.saves = findMetric(row, headers, ['saves', 'guardados', 'guardadas']);
  result.profile_visits = findMetric(row, headers, ['profile', 'visitas']);
  result.clicks = findMetric(row, headers, ['clicks', 'clics']);

  return result;
}

function findMetric(row, headers, searchTerms) {
  const col = headers.find(h => {
    const lower = h.toLowerCase();
    return searchTerms.some(term => lower.includes(term));
  });
  return col ? row[col] : null;
}

function mapFormatoMeta(typeStr) {
  if (!typeStr) return null;
  if (typeStr.includes('video')) return 'video';
  if (typeStr.includes('carousel')) return 'carousel';
  if (typeStr.includes('image') || typeStr.includes('foto')) return 'imagen';
  if (typeStr.includes('reel') || typeStr.includes('video corto')) return 'reel';
  if (typeStr.includes('story')) return 'story';
  return null;
}

function parseMetric(val) {
  if (!val) return null;
  const str = String(val).trim();
  if (!str) return null;
  // Remove % sign if present
  const clean = str.replace('%', '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

module.exports = { plataformas, parse };
