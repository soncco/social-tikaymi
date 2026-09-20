const { parse: parseCsv } = require('csv-parse/sync');

// TikTok Studio - adapts exports from TikTok Creator Studio
// Typical columns: Video ID, Post Date, Video Title, Description, Video Type,
// Completion Rate, Average Watch Time, Plays, Likes, Comments, Shares, Saves,
// Profile Visits, Click-through Rate, Followers Gained, etc.

const plataformas = ['tiktok'];

function parse(csvText) {
  const records = parseCsv(csvText, { columns: true, skip_empty_lines: true });

  return records.map(row => {
    const norm = normalizeHeaders(row);

    if (!norm.external_id) return null;

    return {
      external_id: norm.external_id,
      titulo: norm.titulo || 'Sin título',
      fecha: norm.fecha || null,
      formato: 'video', // TikTok is always short video format
      reach: null, // TikTok doesn't report "reach" the same way
      impressions: parseMetric(norm.impressions), // "Impressions" in some exports
      plays: parseMetric(norm.plays),
      // TikTok's "Completion Rate" = % of viewers who watched the full video
      retention: parseMetric(norm.completion_rate), // Store as % directly
      completed_plays: null, // TikTok provides completion rate % instead
      likes: parseMetric(norm.likes),
      comments: parseMetric(norm.comments),
      shares: parseMetric(norm.shares),
      saves: parseMetric(norm.saves),
      profile_visits: parseMetric(norm.profile_visits),
      clicks: parseMetric(norm.clicks),
      conversations: null // TikTok doesn't provide via CSV
    };
  }).filter(r => r !== null);
}

function normalizeHeaders(row) {
  const headers = Object.keys(row);
  const result = {};

  // Extract external_id (usually "Video ID" or similar)
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

  // Extract fecha (usually "Post Date" or similar)
  const date = headers.find(h =>
    h.toLowerCase().includes('date') ||
    h.toLowerCase().includes('fecha') ||
    h === 'Post Date'
  );
  result.fecha = date ? (row[date] || '').toString().trim() : null;

  // Metrics
  result.impressions = findMetric(row, headers, ['impression']);
  result.plays = findMetric(row, headers, ['plays', 'video plays', 'views']);

  // TikTok's "Completion Rate" or "Finish Rate" - percentage of viewers who watched to end
  result.completion_rate = findMetric(row, headers, ['completion', 'finish rate']);

  result.likes = findMetric(row, headers, ['likes']);
  result.comments = findMetric(row, headers, ['comment']);
  result.shares = findMetric(row, headers, ['share']);
  result.saves = findMetric(row, headers, ['save']);
  result.profile_visits = findMetric(row, headers, ['profile', 'visits']);
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
  // Remove % sign if present
  const clean = str.replace('%', '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

module.exports = { plataformas, parse };
