// Copia local de páginas públicas de Tikaymi. Solo se actualiza por acción manual.
const crypto = require('node:crypto');
const cheerio = require('cheerio');

const SITEMAP = 'https://tikaymi.com/sitemap.xml';
const MAX_PAGES = 250;
const MAX_HTML = 2_000_000;
const err = (message, status = 400) => Object.assign(new Error(message), { status });
let running = false;

function pageType(path) {
  const parts = path.split('/').filter(Boolean).filter(x => x !== 'en');
  if (parts[0] === 'tour') return 'tour';
  if (parts[0] === 'blog' && parts.length > 1) return 'blog';
  if (['evento', 'event'].includes(parts[0]) && parts.length > 1) return 'evento';
  if (['destino', 'destinos', 'destination', 'destinations'].includes(parts[0])) return 'destino';
  return 'institucional';
}

function parseSitemap(xml) {
  const $ = cheerio.load(xml, { xmlMode:true });
  const out = [];
  $('url').each((_, el) => {
    const raw = $(el).find('loc').first().text().trim();
    let u;
    try { u = new URL(raw); } catch { return; }
    if (u.protocol !== 'https:' || u.hostname !== 'tikaymi.com' || u.username || u.password || u.search || u.hash) return;
    out.push({ url:u.href, lang:u.pathname.startsWith('/en/') ? 'en' : 'es', kind:pageType(u.pathname), lastmod:$(el).find('lastmod').first().text().trim() || null });
  });
  if (!out.length || out.length > MAX_PAGES) throw err('El sitemap no contiene una lista de páginas válida o excede el límite seguro', 502);
  return [...new Map(out.map(x => [x.url, x])).values()];
}

function extract(html, url) {
  const $ = cheerio.load(html);
  $('script,style,noscript,nav,footer,header,form,aside').remove();
  const title = ($('main h1').first().text() || $('h1').first().text() || $('title').first().text()).replace(/\s+/g, ' ').trim().slice(0, 300);
  const description = ($('meta[name="description"]').attr('content') || $('main p').first().text() || '').replace(/\s+/g, ' ').trim().slice(0, 600);
  const main = $('main').length ? $('main') : $('body');
  const body = main.find('h1,h2,h3,p,li').map((_, el) => $(el).text().replace(/\s+/g, ' ').trim()).get()
    .filter(x => x.length > 12).filter((x, i, a) => a.indexOf(x) === i).join('\n').slice(0, 9000);
  if (!title || !body) throw err(`No se pudo extraer contenido de ${url}`, 502);
  const content_hash = crypto.createHash('sha256').update([title,description,body].join('\n')).digest('hex');
  return { title, description, body_text:body, content_hash };
}

async function fetchText(url, fetchImpl) {
  let current = url;
  let res;
  for (let redirect = 0; redirect < 4; redirect++) {
    res = await fetchImpl(current, { redirect:'manual', signal:AbortSignal.timeout(15000), headers:{ 'user-agent':'TikaymiMarketingIntelligence/1.0 (+https://tikaymi.com)' } });
    if (![301,302,303,307,308].includes(res.status)) break;
    const location = res.headers?.get('location');
    if (!location) throw err('Redirección sin destino', 502);
    const next = new URL(location, current);
    if (next.protocol !== 'https:' || next.hostname !== 'tikaymi.com') throw err('La redirección salió de tikaymi.com', 502);
    current = next.href;
  }
  if ([301,302,303,307,308].includes(res.status)) throw err('Demasiadas redirecciones', 502);
  if (!res.ok) throw err(`La web respondió ${res.status} para ${url}`, 502);
  const final = new URL(res.url || current);
  if (final.protocol !== 'https:' || final.hostname !== 'tikaymi.com') throw err('La redirección salió de tikaymi.com', 502);
  if (Number(res.headers?.get('content-length')) > MAX_HTML) throw err('Página demasiado grande para la copia local', 502);
  const body = await res.text();
  if (body.length > MAX_HTML) throw err('Página demasiado grande para la copia local', 502);
  return body;
}

async function sync(db, { fetchImpl = globalThis.fetch } = {}) {
  if (running) throw err('Ya hay una actualización web en curso', 409);
  running = true;
  const id = db.prepare('INSERT INTO site_syncs DEFAULT VALUES').run().lastInsertRowid;
  const totals = { found:0, fetched:0, created:0, changed:0, unchanged:0, failed:0, removed:0 };
  try {
    const pages = parseSitemap(await fetchText(SITEMAP, fetchImpl));
    const previous = db.prepare('SELECT count(*) n FROM site_pages WHERE active=1').get().n;
    if (previous > 20 && pages.length < previous / 2) throw err('El sitemap parece incompleto; se conservó la copia anterior', 502);
    totals.found = pages.length;
    const existing = db.prepare('SELECT content_hash,approved FROM site_pages WHERE url=?');
    const insert = db.prepare(`INSERT INTO site_pages(url,lang,kind,title,description,body_text,content_hash,sitemap_lastmod,approved)
      VALUES(@url,@lang,@kind,@title,@description,@body_text,@content_hash,@lastmod,0)`);
    const update = db.prepare(`UPDATE site_pages SET lang=@lang,kind=@kind,title=@title,description=@description,
      body_text=@body_text,content_hash=@content_hash,sitemap_lastmod=@lastmod,fetched_at=CURRENT_TIMESTAMP,active=1,
      approved=CASE WHEN content_hash=@content_hash THEN approved ELSE 0 END,
      changed_at=CASE WHEN content_hash=@content_hash THEN changed_at ELSE CURRENT_TIMESTAMP END WHERE url=@url`);
    let next = 0;
    const worker = async () => {
      while (next < pages.length) {
        const p = pages[next++];
        try {
          const html = await fetchText(p.url, fetchImpl);
          const data = { ...p, ...extract(html, p.url) };
          const old = existing.get(p.url);
          if (!old) { insert.run(data); totals.created++; }
          else { update.run(data); old.content_hash === data.content_hash ? totals.unchanged++ : totals.changed++; }
          totals.fetched++;
        } catch (e) {
          totals.failed++;
          console.error('[site] página omitida:', p.url, e.message);
        }
      }
    };
    await Promise.all(Array.from({ length:6 }, worker));
    const currentUrls = new Set(pages.map(p => p.url));
    const archive = db.prepare('UPDATE site_pages SET active=0,approved=0 WHERE url=?');
    for (const row of db.prepare('SELECT url FROM site_pages WHERE active=1').all()) {
      if (!currentUrls.has(row.url)) { archive.run(row.url); totals.removed++; }
    }
    db.prepare(`UPDATE site_syncs SET completed_at=CURRENT_TIMESTAMP,found=@found,fetched=@fetched,
      created=@created,changed=@changed,unchanged=@unchanged,failed=@failed,removed=@removed WHERE id=@id`).run({ ...totals, id });
    return { id, ...totals };
  } catch (e) {
    db.prepare('UPDATE site_syncs SET completed_at=CURRENT_TIMESTAMP,error=? WHERE id=?').run(e.message, id);
    throw e;
  } finally { running = false; }
}

async function refreshPage(db, url, { fetchImpl = globalThis.fetch } = {}) {
  let parsed;
  try { parsed = new URL(String(url || '')); } catch { throw err('URL de página inválida'); }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'tikaymi.com' || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw err('Solo se pueden actualizar páginas HTTPS de tikaymi.com');
  }
  const pageUrl=parsed.href;
  const previous=db.prepare('SELECT * FROM site_pages WHERE url=? AND active=1').get(pageUrl);
  if(!previous)throw err('La página no existe o está archivada',404);
  if(running)throw err('Ya hay una actualización web en curso',409);
  running=true;
  try {
    const page=extract(await fetchText(pageUrl,fetchImpl),pageUrl);
    const changed=previous.content_hash!==page.content_hash;
    db.prepare(`UPDATE site_pages SET title=@title,description=@description,body_text=@body_text,content_hash=@content_hash,
      fetched_at=CURRENT_TIMESTAMP,approved=CASE WHEN content_hash=@content_hash THEN approved ELSE 0 END,
      changed_at=CASE WHEN content_hash=@content_hash THEN changed_at ELSE CURRENT_TIMESTAMP END
      WHERE url=@url AND active=1`).run({...page,url:pageUrl});
    return {url:pageUrl,title:page.title,changed,approved:changed?false:!!previous.approved};
  } finally { running=false; }
}

function status(db) {
  return { latest:db.prepare('SELECT * FROM site_syncs ORDER BY id DESC LIMIT 1').get() || null,
    pages:db.prepare('SELECT count(*) total, sum(CASE WHEN approved=1 THEN 1 ELSE 0 END) approved FROM site_pages WHERE active=1').get() };
}

function list(db, { lang = 'es', kind } = {}) {
  if (!['es','en'].includes(lang)) throw err('Idioma inválido');
  if (kind && !['tour','blog','evento','destino','institucional'].includes(kind)) throw err('Tipo de página inválido');
  return db.prepare(`SELECT url,lang,kind,title,description,substr(body_text,1,600) excerpt,
    sitemap_lastmod,fetched_at,approved,changed_at FROM site_pages
    WHERE active=1 AND lang=? AND (? IS NULL OR kind=?) ORDER BY kind,title LIMIT 150`).all(lang, kind || null, kind || null);
}

function approve(db, url, approved) {
  const r = db.prepare('UPDATE site_pages SET approved=? WHERE url=? AND active=1').run(approved === true ? 1 : 0, url);
  if (!r.changes) throw err('La página no existe', 404);
  return { url, approved:approved === true };
}

// Aprobación explícita de varias fichas. Se acepta una lista de URLs o filtros
// controlados por tipo/idioma; nunca se aprueba contenido archivado.
function approveBatch(db, { urls, kinds, languages, approved = true } = {}) {
  const allowedKinds = ['tour','blog','evento','destino','institucional'];
  const allowedLanguages = ['es','en'];
  const selectedKinds = kinds?.length ? [...new Set(kinds)] : null;
  const selectedLanguages = languages?.length ? [...new Set(languages)] : null;
  if (selectedKinds && selectedKinds.some(k => !allowedKinds.includes(k))) throw err('Tipo de página inválido');
  if (selectedLanguages && selectedLanguages.some(l => !allowedLanguages.includes(l))) throw err('Idioma inválido');
  const list = urls?.length ? [...new Set(urls)] : null;
  if (!list && !selectedKinds && !selectedLanguages) throw err('Indica URLs o filtros para aprobar páginas');
  if (list && list.length > MAX_PAGES) throw err(`No se pueden aprobar más de ${MAX_PAGES} páginas por lote`);
  let result;
  if (list) {
    const placeholders = list.map(() => '?').join(',');
    result = db.prepare(`UPDATE site_pages SET approved=? WHERE active=1 AND url IN (${placeholders})`).run(approved === true ? 1 : 0, ...list);
  } else {
    const where = ['active=1']; const params = [];
    if (selectedKinds) { where.push(`kind IN (${selectedKinds.map(() => '?').join(',')})`); params.push(...selectedKinds); }
    if (selectedLanguages) { where.push(`lang IN (${selectedLanguages.map(() => '?').join(',')})`); params.push(...selectedLanguages); }
    result = db.prepare(`UPDATE site_pages SET approved=? WHERE ${where.join(' AND ')}`).run(approved === true ? 1 : 0, ...params);
  }
  return { approved: approved === true, updated: result.changes };
}

module.exports = { SITEMAP, parseSitemap, extract, sync, refreshPage, status, list, approve, approveBatch };
