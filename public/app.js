'use strict';
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let K = {}, tab = 'panel';
const FAM = { atencion: 'Atención', intencion: 'Intención', negocio: 'Negocio' };
const CONF = { datos_insuficientes: 'Datos insuficientes', senal_inicial: 'Señal inicial', patron_probable: 'Patrón probable', patron_confirmado: 'Patrón confirmado' };
const TIPO = { observado: 'Observado', interpretacion: 'Interpretación', recomendacion: 'Recomendación', hipotesis: 'Hipótesis' };
const TABS = { panel: 'Panel', objetivos: 'Objetivos', posts: 'Publicaciones', importar: 'Importar CSV', leads: 'Leads', aprendizajes: 'Aprendizajes', calendario: 'Calendario', enlaces: 'Enlaces', carrusel: 'Carrusel', info: 'Info aprobada', generar: 'Generar', ia: 'IA' };
const LBL = k => String(k).replace(/_/g, ' ');
const opts = (list, sel) => list.map(o => `<option value="${esc(o)}"${o === sel ? ' selected' : ''}>${esc(LBL(o))}</option>`).join('');

function toast(t, err) { const d = document.createElement('div'); if (err) d.className = 'err'; d.textContent = t; $('#msg').append(d); setTimeout(() => d.remove(), 4000); }
async function api(path, method = 'GET', body) {
  const r = await fetch('/api' + path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401) { showLogin(); throw new Error('Sesión requerida'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || 'Error ' + r.status), { status: r.status });
  return j;
}
const guard = fn => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message, true); } };
const formData = f => Object.fromEntries([...new FormData(f)].filter(([, v]) => v !== ''));

function showLogin() {
  $('#top').hidden = true;
  $('#view').innerHTML = `<form class="card login" id="lf"><img src="tikaymi-logo.png" alt="Tikaymi"><h2>Tikaymi Lab</h2><label>Contraseña<input type="password" name="password" required autofocus></label><p><button>Entrar</button></p></form>`;
  $('#lf').onsubmit = guard(async e => {
    e.preventDefault();
    const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData(e.target)) });
    if (!r.ok) throw new Error('Contraseña incorrecta');
    start();
  });
}

async function start() {
  K = await api('/constants');
  $('#top').hidden = false;
  $('#tabs').innerHTML = Object.entries(TABS).map(([k, v]) => `<button data-t="${k}">${v}</button>`).join('');
  go(tab);
}
$('#tabs').onclick = e => { const t = e.target.dataset?.t; if (t) go(t); };
$('#logout').onclick = guard(async () => { await fetch('/api/logout', { method: 'POST' }); showLogin(); });
function go(t) {
  tab = t;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  $('#view').innerHTML = '<p>Cargando…</p>';
  guard(views[t])();
}

/* ---------- Panel ---------- */
const badgeC = c => c ? `<span class="badge c-${esc(c)}">${esc(CONF[c] || LBL(c))}</span>` : '';
const badgeT = t => t ? `<span class="badge t-${esc(t)}">${esc(TIPO[t] || LBL(t))}</span>` : '';
const num = v => (typeof v === 'number' && isFinite(v)) ? v : null;
const fmt = v => num(v) === null ? '—' : (Number.isInteger(v) ? v : v.toFixed(2));

function groups(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data.map(g => [g.grupo ?? g.nombre ?? g.clave ?? g.key ?? g.label ?? '?', g]);
  if (typeof data === 'object') return Object.entries(data).map(([k, g]) => [k, g]);
  return [];
}
function famBars(g) {
  return ['atencion', 'intencion', 'negocio'].map(f => {
    const m = g?.[f]; if (!m || typeof m !== 'object') return '';
    const ents = Object.entries(m).filter(([, v]) => num(v) !== null);
    if (!ents.length) return '';
    const max = Math.max(...ents.map(([, v]) => v), 1e-9);
    return `<div class="fam-${f}"><small><span class="badge" style="background:var(--f)">${FAM[f]}</span></small>` +
      ents.map(([k, v]) => `<div class="bar"><span class="lbl">${esc(LBL(k))}</span><span class="track"><span class="fill" style="display:block;width:${Math.max(2, v / max * 100)}%"></span></span><b>${fmt(v)}</b></div>`).join('') + '</div>';
  }).join('');
}
function section(title, data) {
  const gs = groups(data);
  return `<div class="card"><h3 style="margin-top:0">${esc(title)}</h3>` + (gs.length ? gs.map(([k, g]) =>
    `<div class="grp"><strong>${esc(LBL(k))} <small>n=${esc(g?.n ?? '?')}</small></strong> ${badgeC(g?.confianza)}${famBars(g)}</div>`).join('') : '<p class="mute">Sin datos.</p>') + '</div>';
}
function recCard(r) {
  const rows = [['Dato de origen', 'dato_origen'], ['Objetivo', 'objetivo'], ['Formato y por qué', 'formato_y_por_que'], ['CTA', 'cta'], ['Métrica de éxito', 'metrica_exito'], ['Limitaciones', 'limitaciones']];
  return `<div class="card rec">${badgeT(r.tipo)}${badgeC(r.confianza)}<dl>` + rows.filter(([, k]) => r[k] != null).map(([l, k]) => `<dt>${l}</dt><dd>${esc(r[k])}</dd>`).join('') + '</dl></div>';
}
function best(m) {
  const gs = groups(m);
  return gs.length ? `<div class="card"><h3 style="margin-top:0">Mejores</h3>` + gs.map(([k, v]) =>
    `<p><b>${esc(LBL(k))}:</b> ${esc(typeof v === 'object' && v ? (v.titulo ?? v.grupo ?? v.nombre ?? JSON.stringify(v)) : v)}</p>`).join('') + '</div>' : '';
}
async function panel() {
  const [a, al, co] = await Promise.all([api('/analysis'), api('/alerts').catch(() => []), api('/cohorts').catch(() => ({}))]);
  const r = a.resumen || {};
  const conv = a.conversion || {};
  const kp = (l, v) => `<div class="card kpi fam-negocio"><small>${l}</small><b>${esc(v ?? '—')}</b></div>`;
  $('#view').innerHTML = `<h2>Panel <a href="/api/report.md" download="informe-tikaymi.md" style="font-size:14px;font-weight:400">Descargar informe (.md)</a></h2>
  <div class="grid">${kp('Objetivo del período', r.objetivo_actual ? LBL(r.objetivo_actual.objetivo_negocio ?? r.objetivo_actual) : 'Sin objetivo')}${kp('Publicaciones', r.publicaciones)}${kp('Consultas', r.consultas)}${kp('Cotizaciones', r.cotizaciones)}${kp('Reservas', r.reservas)}</div>
  ${conv.sin_datos ? '<div class="warn"><b>Sin datos de conversión.</b> No hay leads atribuidos a publicaciones (campaign_code); no se puede afirmar qué contenido convierte. Solo se muestran métricas de atención e intención.</div>' : ''}
  <div class="card legend"><span class="fam-atencion"><i style="background:var(--teal)"></i>Atención (alcance, vistas, likes)</span><span class="fam-intencion"><i style="background:var(--ocre)"></i>Intención (clics, guardados, mensajes)</span><span class="fam-negocio"><i style="background:var(--terra)"></i>Negocio (consultas, cotizaciones, reservas)</span> ${badgeC(a.confianza)}</div>
  <h3>Recomendaciones prioritarias</h3>${(a.recomendaciones || []).map(recCard).join('') || '<p>Sin recomendaciones todavía.</p>'}
  ${section('Por plataforma', a.por_plataforma)}${section('Por formato', a.por_formato)}${section('Por idioma', a.por_idioma)}${section('Por tema', a.por_tema)}${section('Por CTA', a.por_cta)}
  ${conv.sin_datos ? '' : section('Conversión', conv)}${best(a.mejores)}
  <h3>Alertas</h3><div class="card">${(al || []).length ? al.map(x => `<p><span class="badge">${esc(LBL(x.tipo))}</span> ${esc(x.mensaje)}</p>`).join('') : '<p class="mute">Sin alertas.</p>'}</div>
  <h3>Cohortes de leads (por semana)</h3><div class="card tablewrap">${Object.keys(co || {}).length ? `<table><tr><th>Semana</th><th>Total</th><th>Por estado</th><th>Tasa cotizado/reservado</th></tr>${Object.entries(co).map(([w, c]) => `<tr><td>${esc(w)}</td><td>${esc(c.total)}</td><td>${esc(Object.entries(c.por_estado || {}).map(([k, v]) => LBL(k) + ': ' + v).join(', '))}</td><td>${c.datos_suficientes && num(c.tasa_a_cotizado_reservado) !== null ? esc((c.tasa_a_cotizado_reservado * 100).toFixed(1)) + '%' : 'datos insuficientes (n&lt;5)'}</td></tr>`).join('')}</table>` : '<p class="mute">Sin leads: datos insuficientes.</p>'}</div>
  <p><button id="themes">Clasificar temas</button></p>`;
  $('#themes').onclick = guard(async () => { const t = await api('/themes/auto', 'POST'); toast(`Temas clasificados: ${t.classified} de ${t.total}`); go('panel'); });
}

/* ---------- Objetivos ---------- */
async function objetivos() {
  const list = await api('/objectives');
  $('#view').innerHTML = `<h2>Objetivos de negocio</h2><form class="card form" id="f">
  <label>Período<input name="periodo" placeholder="2026-10" required></label>
  <label>Objetivo de negocio<select name="objetivo_negocio">${opts(K.OBJETIVOS_NEGOCIO)}</select></label>
  <label>Meta<input name="meta" placeholder="Ej. 20 consultas"></label><div><button>Guardar</button></div></form>
  <div class="card tablewrap"><table><tr><th>Período</th><th>Objetivo</th><th>Meta</th></tr>${list.map(o => `<tr><td>${esc(o.periodo)}</td><td>${esc(LBL(o.objetivo_negocio))}</td><td>${esc(o.meta)}</td></tr>`).join('')}</table></div>`;
  $('#f').onsubmit = guard(async e => { e.preventDefault(); await api('/objectives', 'POST', formData(e.target)); toast('Objetivo guardado'); go('objetivos'); });
}

/* ---------- Publicaciones ---------- */
const TXT = { titulo: 'Título', objetivo_marketing: 'Objetivo de marketing', audiencia: 'Audiencia', cta: 'CTA', metrica_principal: 'Métrica principal', formato: 'Formato', tema: 'Tema', campaign_code: 'Campaign code', external_id: 'ID externo', fecha: 'Fecha' };
const SEL = { plataforma: 'PLATAFORMAS', objetivo_negocio: 'OBJETIVOS_NEGOCIO', objetivo_contenido: 'OBJETIVOS_CONTENIDO', etapa_embudo: 'ETAPAS', idioma: 'IDIOMAS', estado: 'POST_ESTADOS' };
const REQ = ['plataforma', 'titulo', 'objetivo_negocio', 'objetivo_marketing', 'objetivo_contenido', 'audiencia', 'etapa_embudo', 'cta', 'metrica_principal', 'idioma'];
const SC = 'sin_clasificar';
function postFields(p = {}) {
  const h = [];
  for (const k of ['plataforma', 'titulo', 'objetivo_negocio', 'objetivo_marketing', 'objetivo_contenido', 'audiencia', 'etapa_embudo', 'cta', 'metrica_principal', 'idioma', 'estado', 'fecha', 'formato', 'tema', 'campaign_code', 'external_id']) {
    const req = REQ.includes(k) ? ' required' : '';
    const star = req ? ' *' : '';
    if (SEL[k]) {
      const list = K[SEL[k]] || [];
      const cur = p[k];
      const extra = cur && !list.includes(cur) ? `<option value="${esc(cur)}" selected>${esc(cur)} (pendiente)</option>` : '';
      h.push(`<label>${esc(LBL(k))}${star}<select name="${k}"${req}>${req ? '<option value="">— elegir —</option>' : ''}${extra}${opts(list, cur)}</select></label>`);
    } else h.push(`<label>${TXT[k] || k}${star}<input name="${k}" value="${esc(p[k])}"${req}${k === 'fecha' ? ' type="date"' : ''}></label>`);
  }
  return h.join('');
}
const isPend = p => Object.values(p).some(v => v === SC);
async function posts() {
  const list = await api('/posts');
  $('#view').innerHTML = `<h2>Publicaciones</h2><form class="card form" id="f"><h3 class="full" style="margin:0">Nueva publicación</h3>${postFields()}<div class="full"><button>Crear</button></div></form>
  <div id="pl"></div>`;
  $('#f').onsubmit = guard(async e => { e.preventDefault(); await api('/posts', 'POST', formData(e.target)); toast('Publicación creada'); go('posts'); });
  const pend = list.filter(isPend);
  $('#pl').innerHTML = (pend.length ? `<div class="warn"><b>${pend.length}</b> publicación(es) pendientes de clasificar (${SC}). Edítalas abajo.</div>` : '') +
    `<div class="card tablewrap"><table><tr><th>Fecha</th><th>Plataforma</th><th>Título</th><th>Objetivo</th><th>Alcance</th><th>Plays</th><th>Likes</th><th>Guardados</th><th></th></tr>` +
    list.map(p => `<tr class="${isPend(p) ? 'pend' : ''}"><td>${esc(p.fecha)}</td><td>${esc(p.plataforma)}</td><td>${esc(p.titulo)}${isPend(p) ? ' <span class="badge" style="background:var(--terra)">Pendiente de clasificar</span>' : ''}</td><td>${esc(LBL(p.objetivo_negocio))}</td><td>${esc(p.reach ?? '—')}</td><td>${esc(p.plays ?? '—')}</td><td>${esc(p.likes ?? '—')}</td><td>${esc(p.saves ?? '—')}</td><td><button class="ghost" data-e="${esc(p.id)}">Editar</button></td></tr>`).join('') + '</table></div>';
  $('#pl').onclick = e => {
    const id = e.target.dataset?.e; if (!id) return;
    const p = list.find(x => String(x.id) === id);
    $('#f').outerHTML = `<form class="card form" id="f"><h3 class="full" style="margin:0">Editar #${esc(p.id)}</h3>${postFields(p)}<div class="full"><button>Guardar</button> <button type="button" class="ghost" onclick="go('posts')">Cancelar</button></div></form>`;
    $('#f').onsubmit = guard(async ev => { ev.preventDefault(); await api('/posts/' + encodeURIComponent(id), 'PUT', formData(ev.target)); toast('Actualizada'); go('posts'); });
    $('#f').scrollIntoView();
  };
}

/* ---------- Importar ---------- */
async function importar() {
  $('#view').innerHTML = `<h2>Importar CSV</h2><form class="card form" id="f"><label>Plataforma<select name="p">${opts(K.PLATAFORMAS)}</select></label><label>Archivo CSV<input type="file" name="file" accept=".csv,text/csv" required></label><div><button>Importar</button></div></form><pre id="out" class="card"></pre>`;
  $('#f').onsubmit = guard(async e => {
    e.preventDefault();
    const f = e.target.file.files[0]; if (!f) return;
    const csv = await f.text();
    const r = await api('/import/' + encodeURIComponent(e.target.p.value), 'POST', { csv });
    $('#out').textContent = JSON.stringify(r, null, 2); toast('Importación completa');
  });
}

/* ---------- Leads ---------- */
async function leads() {
  const list = await api('/leads');
  $('#view').innerHTML = `<h2>Leads</h2><form class="card form" id="f"><label>Campaign code<input name="campaign_code"></label><label>Fuente<input name="fuente" placeholder="whatsapp, web…"></label>
  <label>Estado<select name="estado">${opts(K.LEAD_ESTADOS)}</select></label><label>Fecha de viaje<input type="date" name="fecha_viaje"></label><label>Viajeros<input type="number" min="1" name="viajeros"></label><label>Notas<input name="notas"></label><div><button>Registrar lead</button></div></form>
  <div class="card tablewrap"><table><tr><th>#</th><th>Campaign</th><th>Fuente</th><th>Viaje</th><th>Viajeros</th><th>Notas</th><th>Atribuido</th><th>Estado</th></tr>${list.map(l => `<tr><td>${esc(l.id)}</td><td>${esc(l.campaign_code)}</td><td>${esc(l.fuente)}</td><td>${esc(l.fecha_viaje)}</td><td>${esc(l.viajeros)}</td><td>${esc(l.notas)}</td><td>${l.post_id ? 'Sí' : 'No'}</td><td><select data-l="${esc(l.id)}">${opts(K.LEAD_ESTADOS, l.estado)}</select></td></tr>`).join('')}</table></div>`;
  $('#f').onsubmit = guard(async e => {
    e.preventDefault();
    const d = formData(e.target); if (d.viajeros) d.viajeros = Number(d.viajeros);
    const r = await api('/leads', 'POST', d);
    toast(r.atribuido ? 'Lead registrado y atribuido' : 'Lead registrado sin atribución (campaign_code no coincide)'); go('leads');
  });
  $('#view').onchange = guard(async e => { const id = e.target.dataset?.l; if (!id) return; await api('/leads/' + encodeURIComponent(id), 'PUT', { estado: e.target.value }); toast('Estado actualizado'); });
}

/* ---------- Aprendizajes ---------- */
async function aprendizajes() {
  const [list, ps] = await Promise.all([api('/learnings'), api('/posts')]);
  $('#view').innerHTML = `<h2>Aprendizajes</h2><form class="card form" id="f"><label class="full">Aprendizaje<textarea name="texto" rows="3" required></textarea></label>
  <label>Publicación (opcional)<select name="post_id"><option value="">—</option>${ps.map(p => `<option value="${esc(p.id)}">#${esc(p.id)} ${esc(p.titulo)}</option>`).join('')}</select></label><div><button>Guardar</button></div></form>
  ${list.map(l => `<div class="card">${esc(l.texto)}<br><small class="mute">${l.post_id ? 'Post #' + esc(l.post_id) : ''} ${esc(l.creado ?? l.created_at ?? '')}</small></div>`).join('')}`;
  $('#f').onsubmit = guard(async e => { e.preventDefault(); const d = formData(e.target); if (d.post_id) d.post_id = Number(d.post_id); await api('/learnings', 'POST', d); toast('Guardado'); go('aprendizajes'); });
}

/* ---------- Proveedor de IA ---------- */
async function ia() {
  const st = await api('/llm');
  $('#view').innerHTML = `<h2>Proveedor de IA</h2>
  <p class="mute">Elige qué modelo genera el contenido. Las claves API se configuran solo en el archivo <code>.env</code> (nunca aquí).</p>
  ${st.proveedores.map(p => `<form class="card form" data-p="${esc(p.id)}">
    <label class="full"><b>${esc(p.label)}</b> ${p.id === st.activo.provider ? '<span class="badge">ACTIVO</span>' : ''}
    <small class="mute">${p.configurado ? '✔ clave configurada' : '✘ falta ' + esc(p.clave_env) + ' en .env'}</small></label>
    <label>Modelo<input name="model" value="${esc(p.modelo)}"></label>
    <div><button>${p.id === st.activo.provider ? 'Guardar modelo' : 'Usar este proveedor'}</button></div></form>`).join('')}`;
  document.querySelectorAll('form[data-p]').forEach(f => f.onsubmit = guard(async e => {
    e.preventDefault(); await api('/llm', 'PUT', { provider: f.dataset.p, model: new FormData(f).get('model') }); toast('Proveedor actualizado'); go('ia');
  }));
}

/* ---------- Calendario editorial ---------- */
const ESTADOS = ['borrador', 'revision', 'aprobado', 'programado', 'publicado', 'analizado'];
async function calendario() {
  const list = await api('/posts');
  const col = e => list.filter(p => (p.estado || 'borrador') === e);
  $('#view').innerHTML = `<h2>Calendario editorial</h2>` + ESTADOS.map((e, i) => {
    const ps = col(e);
    return `<div class="card"><h3 style="margin-top:0">${esc(LBL(e))} <small>(${ps.length})</small></h3>` + (ps.length ? ps.map(p =>
      `<p>${i > 0 ? `<button class="ghost" data-id="${esc(p.id)}" data-to="${esc(ESTADOS[i - 1])}">&larr; ${esc(LBL(ESTADOS[i - 1]))}</button> ` : ''}<b>${esc(p.titulo)}</b> <small class="mute">${esc(p.plataforma)} ${esc(p.fecha)}</small>${i < ESTADOS.length - 1 ? ` <button data-id="${esc(p.id)}" data-to="${esc(ESTADOS[i + 1])}">${esc(LBL(ESTADOS[i + 1]))} &rarr;</button>` : ''}</p>`).join('') : '<p class="mute">Sin publicaciones.</p>') + '</div>';
  }).join('');
  $('#view').onclick = guard(async e => {
    const { id, to } = e.target.dataset || {}; if (!id || !to) return;
    if (to === 'aprobado' && !confirm('¿Confirmas que una persona revisó y aprueba esta publicación? La aprobación debe ser humana.')) return;
    await api('/posts/' + encodeURIComponent(id), 'PUT', { estado: to });
    toast('Estado: ' + LBL(to)); go('calendario');
  });
}

/* ---------- Enlaces ---------- */
async function enlaces() {
  $('#view').innerHTML = `<h2>Enlaces rastreables</h2><form class="card form" id="f"><label>Campaign code *<input name="campaign_code" required></label>
  <label>Plataforma<select name="plataforma"><option value="">—</option>${opts(K.PLATAFORMAS)}</select></label>
  <label>URL del sitio<input name="site_url" type="url" placeholder="https://…"></label><label>WhatsApp<input name="whatsapp" placeholder="51999999999"></label><div><button>Generar</button></div></form><div id="out"></div>`;
  $('#f').onsubmit = guard(async e => {
    e.preventDefault();
    const r = await api('/links', 'POST', formData(e.target));
    $('#out').innerHTML = Object.entries(r).map(([k, v]) => `<div class="card"><small>${esc(LBL(k))}</small><br><code>${esc(v)}</code> <button class="ghost" data-c="${esc(k)}">Copiar</button></div>`).join('');
    $('#out').onclick = guard(async ev => {
      const k = ev.target.dataset?.c; if (!k) return;
      await navigator.clipboard.writeText(String(r[k])); toast('Copiado');
    });
  });
}

/* ---------- Carrusel ---------- */
const SLIDES_EJ = [{ layout: 'portada', data: {} }, { layout: 'cierre', data: {} }];
async function carrusel() {
  $('#view').innerHTML = `<h2>Exportar carrusel</h2><form class="card form" id="f"><label>Tipo<select name="tipo"><option value="producto">producto</option><option value="informativo">informativo</option></select></label>
  <label class="full">Slides (JSON [{layout, data}])<textarea name="slides" rows="14" spellcheck="false">${esc(JSON.stringify(SLIDES_EJ, null, 2))}</textarea></label>
  <div class="full"><button>Exportar y descargar JSON</button></div></form>
  <p class="mute">Carga el archivo descargado en «Tikaymi - Constructor de Carruseles.html» con el botón «Cargar JSON».</p>`;
  $('#f').onsubmit = guard(async e => {
    e.preventDefault();
    let slides; try { slides = JSON.parse(e.target.slides.value); } catch { throw new Error('JSON de slides inválido'); }
    const tipo = e.target.tipo.value;
    const r = await api('/export/carousel', 'POST', { tipo, slides });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' }));
    a.download = `tikaymi-${tipo}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('JSON descargado');
  });
}

/* ---------- Info aprobada ---------- */
async function info() {
  const [list, assets] = await Promise.all([api('/approved-info'), api('/assets')]);
  $('#view').innerHTML = `<h2>Información aprobada</h2><p class="mute">La generación usa solo esta información. Marca «autorizado para publicar» únicamente si se puede difundir.</p>
  <form class="card form" id="fi"><label>Tipo *<select name="tipo">${opts(K.INFO_TIPOS)}</select></label><label>Título *<input name="titulo" required></label>
  <label class="full">Texto *<textarea name="texto" rows="3" required></textarea></label><label>Fuente<input name="fuente"></label>
  <label><input type="checkbox" name="autorizado_publicar"> Autorizado para publicar</label><div><button>Agregar</button></div></form>
  <div class="card tablewrap"><table><tr><th>Tipo</th><th>Título</th><th>Texto</th><th>Fuente</th><th>Publicar</th><th></th></tr>${list.map(i => `<tr><td>${esc(LBL(i.tipo))}</td><td>${esc(i.titulo)}</td><td>${esc(i.texto)}</td><td>${esc(i.fuente)}</td><td><input type="checkbox" data-ai="${esc(i.id)}"${i.autorizado_publicar ? ' checked' : ''}></td><td><button class="ghost" data-di="${esc(i.id)}">Borrar</button></td></tr>`).join('') || '<tr><td colspan="6">Sin información aprobada.</td></tr>'}</table></div>
  <h2>Fotos y videos</h2><form class="card form" id="fa"><label>Tipo *<select name="tipo">${opts(K.ASSET_TIPOS)}</select></label><label>URL *<input name="url" required></label>
  <label>Descripción<input name="descripcion"></label><label>Destino<input name="destino" placeholder="reels, carrusel…"></label><div><button>Agregar</button></div></form>
  <div class="card tablewrap"><table><tr><th>Tipo</th><th>URL</th><th>Descripción</th><th>Destino</th><th></th></tr>${assets.map(a => `<tr><td>${esc(a.tipo)}</td><td>${esc(a.url)}</td><td>${esc(a.descripcion)}</td><td>${esc(a.destino)}</td><td><button class="ghost" data-da="${esc(a.id)}">Borrar</button></td></tr>`).join('') || '<tr><td colspan="5">Sin recursos.</td></tr>'}</table></div>`;
  $('#fi').onsubmit = guard(async e => { e.preventDefault(); const d = formData(e.target); d.autorizado_publicar = e.target.autorizado_publicar.checked; await api('/approved-info', 'POST', d); toast('Agregado'); go('info'); });
  $('#fa').onsubmit = guard(async e => { e.preventDefault(); await api('/assets', 'POST', formData(e.target)); toast('Agregado'); go('info'); });
  $('#view').onchange = guard(async e => { const id = e.target.dataset?.ai; if (!id) return; await api('/approved-info/' + encodeURIComponent(id), 'PUT', { autorizado_publicar: e.target.checked }); toast('Actualizado'); });
  $('#view').onclick = guard(async e => {
    const { di, da } = e.target.dataset || {};
    if (di && confirm('¿Borrar esta información?')) { await api('/approved-info/' + encodeURIComponent(di), 'DELETE'); go('info'); }
    if (da && confirm('¿Borrar este recurso?')) { await api('/assets/' + encodeURIComponent(da), 'DELETE'); go('info'); }
  });
}

/* ---------- Generar ---------- */
const GEN_ERR = { 400: 'Faltan datos en la publicación o petición', 422: 'No hay información aprobada: agrégala en «Info aprobada»', 503: 'Falta configurar ANTHROPIC_API_KEY en el servidor' };
async function generar() {
  const [ps, gens] = await Promise.all([api('/posts'), api('/generated')]);
  $('#view').innerHTML = `<h2>Generar contenido</h2><form class="card form" id="f"><label>Publicación *<select name="post_id" required><option value="">— elegir —</option>${ps.map(p => `<option value="${esc(p.id)}">#${esc(p.id)} ${esc(p.titulo)}</option>`).join('')}</select></label>
  <label>Tipo de contenido<select name="tipo">${opts(K.CONTENIDO_TIPOS)}</select></label><label>Idioma<select name="idioma">${opts(K.IDIOMAS)}</select></label><div><button>Generar</button></div></form><div id="gerr"></div>
  <h3>Contenido generado</h3>${gens.map(g => `<div class="card"><small class="mute">#${esc(g.id)} · post ${esc(g.post_id)} · ${esc(LBL(g.tipo))} · ${esc(g.idioma)}</small> <span class="badge">${esc(LBL(g.estado))}</span>
  <pre style="white-space:pre-wrap">${esc(g.contenido)}</pre>
  <button data-g="${esc(g.id)}" data-s="aprobado">Aprobar</button> <button class="ghost" data-g="${esc(g.id)}" data-s="rechazado">Rechazar</button> <button class="ghost" data-cp="${esc(g.id)}">Copiar</button>${g.tipo === 'carrusel' && g.estado === 'aprobado' ? ` <button class="ghost" data-dl="${esc(g.id)}">Descargar JSON</button>` : ''}</div>`).join('') || '<p class="mute">Nada generado todavía.</p>'}`;
  $('#f').onsubmit = async e => {
    e.preventDefault(); $('#gerr').innerHTML = '';
    const d = formData(e.target); d.post_id = Number(d.post_id);
    const btn = e.target.querySelector('button'); btn.disabled = true;
    try { await api('/generate', 'POST', d); toast('Generado, queda en revisión'); go('generar'); }
    catch (er) {
      const code = er.status;
      $('#gerr').innerHTML = `<div class="warn"><b>No se pudo generar${code ? ' (' + esc(code) + ')' : ''}.</b> ${esc(er.message)}${GEN_ERR[code] ? '<br>' + esc(GEN_ERR[code]) : ''}</div>`;
    } finally { btn.disabled = false; }
  };
  $('#view').onclick = guard(async e => {
    const { g, s, cp, dl } = e.target.dataset || {};
    if (g && s) {
      if (s === 'aprobado' && !confirm('¿Confirmas que una persona revisó y aprueba este contenido?')) return;
      await api('/generated/' + encodeURIComponent(g), 'PUT', { estado: s }); toast('Estado: ' + s); go('generar');
    }
    const item = gens.find(x => String(x.id) === (cp || dl));
    if (cp && item) { await navigator.clipboard.writeText(item.contenido); toast('Copiado'); }
    if (dl && item) {
      let j; try { j = JSON.parse(item.contenido); } catch { throw new Error('El contenido no es JSON válido'); }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(j, null, 2)], { type: 'application/json' }));
      a.download = `tikaymi-${j.tipo || 'carrusel'}-${item.id}.json`;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
  });
}

const views = { panel, objetivos, posts, importar, leads, aprendizajes, calendario, enlaces, carrusel, info, generar, ia };
window.go = go;
api('/constants').then(start).catch(() => showLogin());
