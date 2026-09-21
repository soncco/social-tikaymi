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

// ---------------------------------------------------------------------------
// Conector oficial (Graph API). Sólo lectura; credenciales sólo por env (ver README.md).
// ---------------------------------------------------------------------------
const GRAPH = () => `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v23.0'}`;
const err = (code, message) => ({ ok: false, items: [], missing: [], errors: [{ external_id: null, code, message }] });
const creds = c => ({
  token: c?.access_token ?? process.env.META_ACCESS_TOKEN,
  igUser: c?.ig_user_id ?? process.env.META_IG_USER_ID,
  appId: c?.app_id ?? process.env.META_APP_ID,
  secret: c?.app_secret ?? process.env.META_APP_SECRET,
  pageId: c?.page_id ?? process.env.META_PAGE_ID,
});

async function graph(path, params, { fetchImpl = fetch, signal } = {}) {
  const url = `${GRAPH()}/${path}?${new URLSearchParams(params)}`;
  const res = await fetchImpl(url, { signal });
  const body = await res.json();
  if (body.error) {
    const e = Object.assign(new Error(body.error.message), { code: body.error.code, sub: body.error.error_subcode });
    e.expired = body.error.code === 190;
    throw e;
  }
  return body;
}

// Lista las publicaciones recientes de la cuenta de Instagram (sólo datos básicos, sin métricas).
async function listRecent({ credentials, limit = 25, signal, fetchImpl, plataforma } = {}) {
  if (plataforma === 'facebook') return fbListRecent({ credentials, limit, signal, fetchImpl });
  const { token, igUser } = creds(credentials);
  if (!token || !igUser) return err('sin_credenciales', 'Faltan META_ACCESS_TOKEN o META_IG_USER_ID');
  try {
    const d = await graph(`${igUser}/media`, { fields: 'id,caption,media_type,media_product_type,timestamp', limit, access_token: token }, { fetchImpl, signal });
    return { ok: true, items: d.data.map(m => ({
      external_id: m.id, titulo: (m.caption || '').split('\n')[0].slice(0, 255) || 'Sin título',
      fecha: m.timestamp, formato: formatoApi(m),
    })), missing: [], errors: [] };
  } catch (e) {
    return err(e.expired ? 'credenciales_caducadas' : 'api_error', e.message);
  }
}

function formatoApi(m) {
  if (m.media_product_type === 'REELS') return 'reel';
  if (m.media_product_type === 'STORY') return 'story';
  if (m.media_type === 'CAROUSEL_ALBUM') return 'carousel';
  if (m.media_type === 'VIDEO') return 'video';
  if (m.media_type === 'IMAGE') return 'imagen';
  return null;
}

const INSIGHT_METRICS = ['reach', 'views', 'saved', 'shares', 'likes', 'comments', 'total_interactions', 'profile_visits'];

// Una petición con todas las métricas; si Meta rechaza alguna para ese tipo de publicación,
// se piden una a una y las no soportadas quedan NULL (nunca 0 ni proxy).
async function insightsFor(id, token, opts) {
  const values = {};
  const grab = d => d.data.forEach(m => { values[m.name] = m.values?.[0]?.value ?? m.total_value?.value ?? null; });
  try {
    grab(await graph(`${id}/insights`, { metric: INSIGHT_METRICS.join(','), access_token: token }, opts));
  } catch (e) {
    if (e.expired || e.code !== 100) throw e;
    for (const m of INSIGHT_METRICS) {
      try { grab(await graph(`${id}/insights`, { metric: m, access_token: token }, opts)); } catch (e2) { if (e2.expired || e2.code !== 100) throw e2; }
    }
  }
  return values;
}

// Cumple el contrato de README.md. Meta retiró `impressions` (v22+) y `plays`: `views` los reemplaza,
// así que se guarda en `plays` para Reels/video y en `impressions` para el resto. `retention` queda NULL.
async function fetchStats(items, { credentials, signal, fetchImpl, plataforma } = {}) {
  if (plataforma === 'facebook') return fbFetchStats(items, { credentials, signal, fetchImpl });
  const { token } = creds(credentials);
  if (!token) return err('sin_credenciales', 'Falta META_ACCESS_TOKEN');
  const out = { ok: true, items: [], missing: [], errors: [], rate: null };
  for (const it of items) {
    const { external_id, formato } = typeof it === 'string' ? { external_id: it } : it;
    try {
      const v = await insightsFor(external_id, token, { fetchImpl, signal });
      const video = formato === 'reel' || formato === 'video';
      out.items.push({
        external_id, captured_at: new Date().toISOString(),
        reach: v.reach ?? null, impressions: video ? null : (v.views ?? null), plays: video ? (v.views ?? null) : null,
        retention: null, completed_plays: null,
        likes: v.likes ?? null, comments: v.comments ?? null, shares: v.shares ?? null, saves: v.saved ?? null,
        profile_visits: v.profile_visits ?? null, clicks: null, conversations: null,
      });
    } catch (e) {
      out.ok = false;
      out.errors.push({ external_id, code: e.expired ? 'credenciales_caducadas' : 'api_error', message: e.message });
      if (e.expired) break; // sin token válido no tiene sentido seguir
    }
  }
  return out;
}

// Estado del token (debug_token). Sirve para avisar antes de que caduque.
async function tokenStatus({ credentials, fetchImpl } = {}) {
  const { token, appId, secret } = creds(credentials);
  if (!token || !appId || !secret) return { ok: false, code: 'sin_credenciales' };
  try {
    const d = (await graph('debug_token', { input_token: token, access_token: `${appId}|${secret}` }, { fetchImpl })).data;
    // expires_at=0 significa "sin caducidad conocida"; aun así el acceso a datos (data_access_expires_at)
    // exige reautorizar en esa fecha. Se avisa con la más cercana de las dos.
    const iso = t => (t ? new Date(t * 1000).toISOString() : null);
    const fechas = [iso(d.expires_at), iso(d.data_access_expires_at)].filter(Boolean).sort();
    const expires_at = fechas[0] ?? null;
    return { ok: !!d.is_valid, valid: !!d.is_valid, expires_at, data_access_expires_at: iso(d.data_access_expires_at),
      dias_restantes: expires_at ? Math.floor((Date.parse(expires_at) - Date.now()) / 864e5) : null };
  } catch (e) {
    return { ok: false, code: e.expired ? 'credenciales_caducadas' : 'api_error', message: e.message };
  }
}

// ---------------------------------------------------------------------------
// Facebook (Página). Leer publicaciones exige un token de PÁGINA, que se obtiene del token de
// usuario de larga duración y no caduca mientras éste siga vigente.
// ---------------------------------------------------------------------------
async function pageToken(c, opts) {
  const { token, pageId } = creds(c);
  if (!token || !pageId) return { error: err('sin_credenciales', 'Faltan META_ACCESS_TOKEN o META_PAGE_ID') };
  try {
    const d = await graph(pageId, { fields: 'access_token', access_token: token }, opts);
    if (!d.access_token) return { error: err('sin_permiso', 'Meta no devolvió token de Página: ¿eres administrador de la Página?') };
    return { token: d.access_token, pageId };
  } catch (e) {
    return { error: err(e.expired ? 'credenciales_caducadas' : 'api_error', e.message) };
  }
}

async function fbListRecent({ credentials, limit, signal, fetchImpl }) {
  const opts = { fetchImpl, signal };
  const pt = await pageToken(credentials, opts);
  if (pt.error) return pt.error;
  try {
    const d = await graph(`${pt.pageId}/posts`, { fields: 'id,message,created_time,status_type,attachments{media_type}', limit, access_token: pt.token }, opts);
    return { ok: true, items: d.data.map(p => ({
      external_id: p.id, titulo: (p.message || '').split('\n')[0].slice(0, 255) || 'Sin título',
      fecha: p.created_time, formato: formatoFb(p),
    })), missing: [], errors: [] };
  } catch (e) {
    return err(e.expired ? 'credenciales_caducadas' : 'api_error', e.message);
  }
}

function formatoFb(p) {
  const t = p.attachments?.data?.[0]?.media_type;
  if (t === 'album') return 'carousel';
  if (t === 'video') return p.status_type === 'added_video' ? 'video' : 'reel';
  if (t === 'photo') return 'imagen';
  return null;
}

const FB_INSIGHTS = ['post_media_view', 'post_total_media_view_unique', 'post_clicks'];

// `views` (post_media_view) → plays en video/reel, impressions en el resto (igual que Instagram).
// Reacciones (todas) → likes. `shares` sólo aparece en la respuesta cuando hay alguno; ausente = 0.
// Meta duplica algunas métricas con otro desglose: se toma el primer valor. profile_visits/retention: NULL.
async function fbFetchStats(items, { credentials, signal, fetchImpl }) {
  const opts = { fetchImpl, signal };
  const pt = await pageToken(credentials, opts);
  if (pt.error) return pt.error;
  const out = { ok: true, items: [], missing: [], errors: [], rate: null };
  for (const it of items) {
    const { external_id, formato } = typeof it === 'string' ? { external_id: it } : it;
    try {
      const post = await graph(external_id, { fields: 'reactions.summary(true).limit(0),comments.summary(true).limit(0),shares', access_token: pt.token }, opts);
      const v = {};
      const grab = d => d.data.forEach(m => { if (!(m.name in v)) v[m.name] = m.values?.[0]?.value ?? null; });
      try {
        grab(await graph(`${external_id}/insights`, { metric: FB_INSIGHTS.join(','), access_token: pt.token }, opts));
      } catch (e) {
        if (e.expired || e.code !== 100) throw e;
        for (const m of FB_INSIGHTS) { try { grab(await graph(`${external_id}/insights`, { metric: m, access_token: pt.token }, opts)); } catch (e2) { if (e2.expired || e2.code !== 100) throw e2; } }
      }
      const video = formato === 'reel' || formato === 'video';
      out.items.push({
        external_id, captured_at: new Date().toISOString(),
        reach: v.post_total_media_view_unique ?? null,
        impressions: video ? null : (v.post_media_view ?? null), plays: video ? (v.post_media_view ?? null) : null,
        retention: null, completed_plays: null,
        likes: post.reactions?.summary?.total_count ?? null, comments: post.comments?.summary?.total_count ?? null,
        shares: post.shares?.count ?? 0, saves: null, profile_visits: null,
        clicks: v.post_clicks ?? null, conversations: null,
      });
    } catch (e) {
      out.ok = false;
      out.errors.push({ external_id, code: e.expired ? 'credenciales_caducadas' : 'api_error', message: e.message });
      if (e.expired) break;
    }
  }
  return out;
}

// Cambia el token vigente por uno nuevo de larga duración (~60 días). Meta sólo lo acepta si el token
// actual sigue válido; si ya caducó hay que generar uno nuevo en el Graph API Explorer.
async function renewToken({ credentials, fetchImpl } = {}) {
  const { token, appId, secret } = creds(credentials);
  if (!token || !appId || !secret) return { ok: false, code: 'sin_credenciales' };
  try {
    const d = await graph('oauth/access_token', { grant_type: 'fb_exchange_token', client_id: appId, client_secret: secret, fb_exchange_token: token }, { fetchImpl });
    return { ok: true, access_token: d.access_token, expires_in: d.expires_in ?? null };
  } catch (e) {
    return { ok: false, code: e.expired ? 'credenciales_caducadas' : 'api_error', message: e.message };
  }
}

module.exports = { renewToken, plataformas, parse, listRecent, fetchStats, tokenStatus };
