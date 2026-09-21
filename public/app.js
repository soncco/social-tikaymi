'use strict';

const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const SC = 'sin_clasificar';
const NAV = {
  inicio: ['⌂', 'Inicio'],
  rendimiento: ['↗', 'Rendimiento'],
  contenido: ['▤', 'Contenido'],
  consultas: ['◎', 'Consultas'],
  configuracion: ['⚙', 'Configuración'],
};
const LABELS = {
  consulta_calificada:'Consulta calificada', cotizacion:'Cotización', reserva:'Reserva', reconocimiento:'Reconocimiento', confianza:'Construir confianza', seguimiento:'Captar interesados',
  alcance:'Alcance', interaccion:'Interacción', consideracion:'Consideración', intencion:'Intención', revision:'En revisión', publicado:'Publicado', programado:'Programado', analizado:'Analizado', borrador:'Borrador', aprobado:'Aprobado',
  instagram:'Instagram', facebook:'Facebook', tiktok:'TikTok', youtube_shorts:'YouTube Shorts', datos_insuficientes:'Datos insuficientes', senal_inicial:'Señal inicial', patron_probable:'Patrón probable', patron_confirmado:'Patrón confirmado',
  observado:'Dato observado', interpretacion:'Interpretación', recomendacion:'Recomendación', hipotesis:'Hipótesis', es:'Español', en:'Inglés', mixto:'Español e inglés', sin_clasificar:'Sin clasificar',
};
const ESTADOS = ['borrador', 'revision', 'aprobado', 'programado', 'publicado', 'analizado'];
let K = {};
let route = { section: 'inicio', sub: '' };
let latestPosts = [];

const label = k => LABELS[k] || String(k ?? '').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
const opts = (list, selected, blank = false) => (blank ? '<option value="">— No cambiar —</option>' : '') + (list || []).map(v => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(label(v))}</option>`).join('');
const formData = form => Object.fromEntries([...new FormData(form)].filter(([,v]) => v !== ''));
const number = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
const metricValue = v => number(v) !== null ? v : number(v?.valor) !== null ? v.valor : null;
const fmt = v => {
  const n = metricValue(v);
  if (n === null) return '—';
  return new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1, notation: Math.abs(n) >= 10000 ? 'compact' : 'standard' }).format(n);
};
const confidence = c => c ? `<span class="badge c-${esc(c)}">${esc(label(c))}</span>` : '';
const typeBadge = t => t ? `<span class="badge t-${esc(t)}">${esc(label(t))}</span>` : '';

function toast(message, error = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (error ? ' err' : '');
  el.textContent = message;
  $('#msg').append(el);
  setTimeout(() => el.remove(), 4500);
}
async function api(path, method = 'GET', body) {
  const res = await fetch('/api' + path, { method, headers: body ? { 'Content-Type':'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401) { showLogin(); throw new Error('Tu sesión terminó. Vuelve a ingresar.'); }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error || `Error ${res.status}`), { status: res.status });
  return json;
}
const guard = fn => async (...args) => { try { await fn(...args); } catch (e) { toast(e.message, true); } };

function pageHead(eyebrow, title, description, actions = '') {
  return `<div class="page-head"><div><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1>${description ? `<p>${esc(description)}</p>` : ''}</div>${actions ? `<div class="head-actions">${actions}</div>` : ''}</div>`;
}
function subnav(items, active) {
  return `<div class="subnav">${Object.entries(items).map(([id, text]) => `<button data-sub="${esc(id)}" class="${id === active ? 'on' : ''}">${esc(text)}</button>`).join('')}</div>`;
}
function empty(symbol, title, text, action = '') {
  return `<div class="card empty"><span class="symbol">${symbol}</span><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
}

function showLogin() {
  $('#shell').hidden = true;
  $('#login-view').hidden = false;
  $('#login-view').innerHTML = `<form class="card login-card" id="login-form">
    <div class="login-brand"><img src="tikaymi-logo.png" alt="Tikaymi"><h1>Marketing Intelligence</h1><p>Convierte datos de contenido en decisiones comerciales.</p></div>
    <label>Contraseña<input type="password" name="password" required autofocus autocomplete="current-password"></label>
    <button class="primary" style="width:100%;margin-top:16px">Ingresar</button>
  </form>`;
  $('#login-form').onsubmit = guard(async e => {
    e.preventDefault();
    const res = await fetch('/api/login', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(formData(e.target)) });
    if (!res.ok) throw new Error('Contraseña incorrecta');
    await start();
  });
}

async function start(constants) {
  K = constants || await api('/constants');
  $('#login-view').hidden = true;
  $('#shell').hidden = false;
  $('#tabs').innerHTML = Object.entries(NAV).map(([id,[ico,text]]) => `<button class="nav-link" data-go="${id}"><span class="ico">${ico}</span>${text}</button>`).join('');
  const hash = location.hash.replace('#','').split('/');
  go(NAV[hash[0]] ? hash[0] : 'inicio', hash[1] || '', false);
}

function go(section, sub = '', push = true) {
  route = { section, sub };
  if (push) location.hash = section + (sub ? '/' + sub : '');
  document.querySelectorAll('#tabs [data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === section));
  $('.sidebar').classList.remove('open');
  $('#view').innerHTML = '<div class="card"><p class="muted">Preparando la información…</p></div>';
  guard(VIEWS[section] || VIEWS.inicio)(sub);
}

document.addEventListener('click', e => {
  const goEl = e.target.closest('[data-go]');
  if (goEl) { e.preventDefault(); go(goEl.dataset.go, goEl.dataset.to || ''); }
  const subEl = e.target.closest('[data-sub]');
  if (subEl) { e.preventDefault(); go(route.section, subEl.dataset.sub); }
});
$('#menu').onclick = () => $('.sidebar').classList.toggle('open');
$('#logout').onclick = guard(async () => { await fetch('/api/logout', { method:'POST' }); showLogin(); });
window.addEventListener('hashchange', () => {
  const [section, sub] = location.hash.replace('#','').split('/');
  if (section && (section !== route.section || (sub || '') !== route.sub)) go(section, sub || '', false);
});

/* Inicio ---------------------------------------------------------------- */
function preparationRow(ok, title, detail) {
  return `<div class="progress-item ${ok ? 'ok' : 'todo'}"><span class="status">${ok ? '✓' : '!'}</span><span><b>${esc(title)}</b><small>${esc(detail)}</small></span></div>`;
}
function chooseNext({ objectives, posts, pending, leads, approved }) {
  if (!objectives.length) return { n:1, title:'Define el objetivo de este período', text:'Dile al sistema qué resultado comercial buscas antes de evaluar contenido.', go:'configuracion', to:'objetivo', cta:'Definir objetivo' };
  if (!posts.length) return { n:2, title:'Conecta tus publicaciones', text:'Sincroniza Instagram o Facebook para obtener métricas reales.', go:'configuracion', to:'datos', cta:'Conectar datos' };
  if (pending) return { n:3, title:`Revisa ${pending} publicaciones pendientes`, text:'Clasifícalas en grupo para comparar temas, objetivos y llamados a la acción.', go:'contenido', to:'publicaciones', cta:'Revisar publicaciones' };
  if (!leads.length) return { n:4, title:'Empieza a rastrear consultas', text:'Crea un enlace o palabra clave y registra las consultas que lleguen.', go:'consultas', to:'rastreo', cta:'Configurar rastreo' };
  if (!approved.length) return { n:5, title:'Prepara la biblioteca aprobada', text:'Añade servicios, precios o testimonios verificados antes de generar contenido.', go:'configuracion', to:'biblioteca', cta:'Agregar información' };
  return { n:6, title:'Convierte un hallazgo en contenido', text:'Elige una recomendación basada en datos y prepara la siguiente pieza.', go:'contenido', to:'generar', cta:'Crear contenido' };
}
function platformSummary(name, group) {
  const a = group?.atencion || {}, i = group?.intencion || {}, b = group?.negocio || {};
  return `<div class="card platform-card"><div class="platform-head"><span class="platform-name">${esc(label(name))}</span>${confidence(group?.confianza)}</div>
    <div class="mini-metrics"><div><small>Alcance</small><b>${fmt(a.reach)}</b></div><div><small>Intención</small><b>${fmt((metricValue(i.saves)||0) + (metricValue(i.shares)||0) + (metricValue(i.clicks)||0))}</b></div><div><small>Consultas</small><b>${fmt(b.consultas)}</b></div></div>
    <small class="muted">${esc(group?.n || 0)} publicaciones analizadas</small></div>`;
}
async function inicio() {
  const [analysis, posts, leads, objectives, approved, assets, llm] = await Promise.all([
    api('/analysis'), api('/posts'), api('/leads'), api('/objectives'), api('/approved-info'), api('/assets'), api('/llm')
  ]);
  latestPosts = posts;
  const pending = posts.filter(isPending).length;
  const configured = llm.proveedores.some(p => p.id === llm.activo.provider && p.configurado);
  const next = chooseNext({ objectives, posts, pending, leads, approved:approved.filter(x => x.autorizado_publicar) });
  const r = analysis.resumen || {};
  $('#view').innerHTML = `<section class="card hero"><div class="hero-content"><p class="eyebrow">Tu centro de decisiones</p><h1>De las métricas a la próxima acción</h1><p>Tikaymi conecta el rendimiento de tus publicaciones con consultas, cotizaciones y reservas. No necesitas interpretar cada número por tu cuenta.</p></div></section>
    <div class="grid cols-4">
      <div class="card kpi attention"><small>Publicaciones analizadas</small><strong>${fmt(r.publicaciones)}</strong></div>
      <div class="card kpi intent"><small>Consultas calificadas</small><strong>${fmt(r.consultas)}</strong></div>
      <div class="card kpi business"><small>Cotizaciones</small><strong>${fmt(r.cotizaciones)}</strong></div>
      <div class="card kpi business"><small>Reservas</small><strong>${fmt(r.reservas)}</strong></div>
    </div>
    <section class="card next-action"><span class="step-number">${next.n}</span><div class="copy"><p class="eyebrow">Siguiente mejor acción</p><h3>${esc(next.title)}</h3><p>${esc(next.text)}</p></div><button class="primary" data-go="${next.go}" data-to="${next.to}">${esc(next.cta)} →</button></section>
    <div class="grid cols-2">
      <section class="card"><h3>Estado de preparación</h3><p class="muted small">Completa estos elementos para obtener recomendaciones más fiables.</p><div class="progress-list">
        ${preparationRow(!!objectives.length, 'Objetivo del período', objectives.length ? label(objectives[0].objetivo_negocio) : 'Aún no está definido')}
        ${preparationRow(!!posts.length, 'Datos de redes', posts.length ? `${posts.length} publicaciones conectadas` : 'Sin publicaciones conectadas')}
        ${preparationRow(!pending && !!posts.length, 'Clasificación', pending ? `${pending} publicaciones necesitan contexto` : posts.length ? 'Todo está clasificado' : 'Pendiente de conectar datos')}
        ${preparationRow(!!leads.length, 'Registro de consultas', leads.length ? `${leads.length} consultas registradas` : 'Aún no se puede medir conversión')}
        ${preparationRow(approved.some(x => x.autorizado_publicar), 'Información aprobada', approved.length ? `${approved.filter(x => x.autorizado_publicar).length} elementos autorizados` : 'Necesaria para generar contenido')}
        ${preparationRow(!!assets.length, 'Fotos y videos', assets.length ? `${assets.length} recursos disponibles` : 'Biblioteca visual vacía')}
        ${preparationRow(configured, 'Asistente de IA', configured ? `${label(llm.activo.provider)} configurado` : 'Falta una clave válida')}
      </div></section>
      <section><h3>Rendimiento por plataforma</h3>${Object.entries(analysis.por_plataforma || {}).map(([k,g]) => platformSummary(k,g)).join('') || empty('↗','Todavía no hay rendimiento','Conecta una plataforma para comenzar.')}</section>
    </div>
    <section><div class="page-head" style="margin:28px 0 12px"><div><h2 style="margin:0">Lo más importante ahora</h2><p>Recomendaciones explicadas con su evidencia y nivel de confianza.</p></div><button class="secondary" data-go="rendimiento">Ver análisis completo</button></div>
    ${(analysis.recomendaciones || []).slice(0,2).map(insightCard).join('') || empty('◇','Sin recomendaciones todavía','Necesitamos publicaciones con métricas para encontrar patrones.')}</section>`;
}

/* Rendimiento ----------------------------------------------------------- */
function insightCard(r) {
  return `<article class="card insight ${esc(r.tipo || '')}"><div class="insight-head"><div>${typeBadge(r.tipo)} ${confidence(r.confianza)}</div></div><dl>
    <dt>Qué observamos</dt><dd>${esc(r.dato_origen)}</dd>
    <dt>Qué proponemos</dt><dd>${esc(r.formato_y_por_que)}</dd>
    <dt>Objetivo</dt><dd>${esc(label(r.objetivo))}</dd>
    <dt>Llamado a la acción</dt><dd>${esc(r.cta)}</dd>
    <dt>Cómo medirlo</dt><dd>${esc(r.metrica_exito)}</dd>
    <dt>Ten en cuenta</dt><dd>${esc(r.limitaciones)}</dd></dl>
    <div class="actions"><button class="secondary small-btn" data-go="contenido" data-to="generar">Usar para crear contenido</button></div></article>`;
}
function metricBars(family, kind) {
  if (!family || family.sin_datos) return `<p class="muted small">${esc(family?.motivo || 'Sin datos disponibles.')}</p>`;
  const entries = Object.entries(family).filter(([,v]) => metricValue(v) !== null);
  if (!entries.length) return '<p class="muted small">Sin métricas disponibles.</p>';
  const max = Math.max(...entries.map(([,v]) => metricValue(v)), 1);
  return entries.map(([k,v]) => `<div class="bar-row ${kind}"><span>${esc(label(k))}</span><span class="track"><span class="fill" style="display:block;width:${Math.max(2, metricValue(v)/max*100)}%"></span></span><b>${fmt(v)} ${v?.cobertura != null ? `<span class="coverage">${Math.round(v.cobertura*100)}%</span>` : ''}</b></div>`).join('');
}
function breakdown(title, data) {
  const groups = Object.entries(data || {});
  if (!groups.length) return '';
  return `<h2>${esc(title)}</h2><div class="grid cols-2">${groups.map(([name,g]) => `<article class="card"><div class="platform-head"><h3>${esc(label(name))}</h3>${confidence(g.confianza)}</div><p class="muted small">${g.n || 0} publicaciones</p><h4>Atención</h4>${metricBars(g.atencion,'attention')}<h4 style="margin-top:14px">Intención</h4>${metricBars(g.intencion,'intent')}</article>`).join('')}</div>`;
}
async function rendimiento(sub = 'resumen') {
  sub = sub || 'resumen';
  const nav = { resumen:'Resumen e insights', comparaciones:'Comparaciones', alertas:'Alertas y aprendizaje' };
  const [a, alerts, cohorts, learnings] = await Promise.all([api('/analysis'), api('/alerts'), api('/cohorts'), api('/learnings')]);
  let body = '';
  if (sub === 'comparaciones') {
    body = `${breakdown('Por plataforma',a.por_plataforma)}${breakdown('Por formato',a.por_formato)}${breakdown('Por idioma',a.por_idioma)}${breakdown('Por tema',a.por_tema)}${breakdown('Por llamado a la acción',a.por_cta)}` || empty('▥','Sin comparaciones','Clasifica publicaciones para comparar grupos.');
  } else if (sub === 'alertas') {
    body = `<div class="grid cols-2"><section><h2>Alertas</h2>${alerts.length ? alerts.map(x => `<div class="notice"><b>${esc(label(x.tipo))}</b><br>${esc(x.mensaje)}</div>`).join('') : empty('✓','Todo en orden','No hay alertas activas.')}</section>
      <section><h2>Aprendizajes registrados</h2><form class="card form" id="learning-form"><label class="full">¿Qué aprendimos?<textarea name="texto" rows="3" required placeholder="Ej. Las guías prácticas generan más conversaciones que las piezas inspiracionales."></textarea></label><div class="form-actions"><button class="primary">Guardar aprendizaje</button></div></form>${learnings.map(l => `<div class="card"><p>${esc(l.texto)}</p><small class="muted">${esc(l.fecha || l.created_at || '')}</small></div>`).join('')}</section></div>
      <h2>Cohortes de consultas</h2><div class="card tablewrap"><table><thead><tr><th>Semana</th><th>Total</th><th>Estados</th><th>Avance comercial</th></tr></thead><tbody>${Object.entries(cohorts || {}).map(([w,c]) => `<tr><td>${esc(w)}</td><td>${c.total}</td><td>${esc(Object.entries(c.por_estado || {}).map(([k,v]) => label(k)+': '+v).join(' · '))}</td><td>${c.datos_suficientes ? fmt(c.tasa_a_cotizado_reservado*100)+'%' : 'Datos insuficientes'}</td></tr>`).join('') || '<tr><td colspan="4">Todavía no hay consultas para agrupar.</td></tr>'}</tbody></table></div>`;
  } else {
    const r = a.resumen || {};
    body = `<div class="grid cols-4"><div class="card kpi attention"><small>Publicaciones</small><strong>${fmt(r.publicaciones)}</strong></div><div class="card kpi intent"><small>Consultas</small><strong>${fmt(r.consultas)}</strong></div><div class="card kpi business"><small>Cotizaciones</small><strong>${fmt(r.cotizaciones)}</strong></div><div class="card kpi business"><small>Reservas</small><strong>${fmt(r.reservas)}</strong></div></div>
      ${a.conversion?.sin_datos ? '<div class="notice"><b>Aún no se puede medir conversión.</b> Registra consultas con su código de campaña para relacionarlas con publicaciones.</div>' : ''}
      <h2>Recomendaciones prioritarias</h2>${(a.recomendaciones || []).map(insightCard).join('') || empty('◇','Sin recomendaciones','Faltan datos para producir recomendaciones responsables.')}`;
  }
  $('#view').innerHTML = pageHead('Resultados', 'Rendimiento', 'Entiende qué atrae atención, qué demuestra intención y qué produce negocio.', `<a class="btn secondary" href="/api/report.md" download="informe-tikaymi.md">Descargar informe</a>`) + subnav(nav,sub) + body;
  const lf = $('#learning-form');
  if (lf) lf.onsubmit = guard(async e => { e.preventDefault(); await api('/learnings','POST',formData(e.target)); toast('Aprendizaje guardado'); go('rendimiento','alertas'); });
}

/* Contenido ------------------------------------------------------------- */
const REQUIRED = ['plataforma','titulo','objetivo_negocio','objetivo_marketing','objetivo_contenido','audiencia','etapa_embudo','cta','metrica_principal','idioma'];
const SELECTS = { plataforma:'PLATAFORMAS', objetivo_negocio:'OBJETIVOS_NEGOCIO', objetivo_contenido:'OBJETIVOS_CONTENIDO', etapa_embudo:'ETAPAS', idioma:'IDIOMAS_HISTORICOS', estado:'POST_ESTADOS' };
const FIELD_LABELS = { titulo:'Título', plataforma:'Plataforma', objetivo_negocio:'Objetivo de negocio', objetivo_marketing:'Objetivo de marketing', objetivo_contenido:'Propósito del contenido', audiencia:'Audiencia', etapa_embudo:'Etapa del viaje', cta:'Llamado a la acción', metrica_principal:'Métrica que define el éxito', idioma:'Idioma', estado:'Estado editorial', fecha:'Fecha', formato:'Formato', tema:'Tema o destino', campaign_code:'Código de rastreo', external_id:'ID externo' };
const isPending = p => ['objetivo_negocio','objetivo_marketing','objetivo_contenido','audiencia','etapa_embudo','cta','metrica_principal','idioma'].some(k => !p[k] || p[k] === SC);
function postFields(p = {}) {
  return ['plataforma','titulo','objetivo_negocio','objetivo_marketing','objetivo_contenido','audiencia','etapa_embudo','cta','metrica_principal','idioma','fecha','formato','tema','campaign_code','estado'].map(k => {
    const req = REQUIRED.includes(k) ? ' required' : '';
    if (SELECTS[k]) {
      const list = k === 'idioma' && !p.id ? K.IDIOMAS : K[SELECTS[k]] || []; const current = p[k];
      const extra = current && !list.includes(current) ? `<option value="${esc(current)}" selected>Pendiente de clasificar</option>` : '';
      return `<label>${esc(FIELD_LABELS[k])}${req ? ' *' : ''}<select name="${k}"${req}>${req && !current ? '<option value="">— Elegir —</option>' : ''}${extra}${opts(list,current)}</select></label>`;
    }
    return `<label>${esc(FIELD_LABELS[k])}${req ? ' *' : ''}<input name="${k}" value="${esc(p[k])}"${k === 'fecha' ? ' type="date"' : ''}${req}></label>`;
  }).join('');
}
function bulkPanel(pending) {
  return `<section class="card" id="bulk-card"><div class="page-head" style="margin:0 0 14px"><div><h3>Clasificación rápida</h3><p>Selecciona publicaciones y aplica únicamente los campos que tengan en común. Puedes hacerlo en varias tandas.</p></div><span class="badge warn">${pending} pendientes</span></div>
    <form class="form" id="bulk-form"><label>Objetivo de negocio<select name="objetivo_negocio">${opts(K.OBJETIVOS_NEGOCIO,null,true)}</select></label><label>Propósito del contenido<select name="objetivo_contenido">${opts(K.OBJETIVOS_CONTENIDO,null,true)}</select></label><label>Etapa del viaje<select name="etapa_embudo">${opts(K.ETAPAS,null,true)}</select></label><label>Idioma<select name="idioma">${opts(K.IDIOMAS,null,true)}</select></label><label>Objetivo de marketing<input name="objetivo_marketing" placeholder="Ej. resolver una duda frecuente"></label><label>Audiencia<input name="audiencia" placeholder="Ej. viajeros que planean visitar Cusco"></label><label>Llamado a la acción<input name="cta" placeholder="Ej. Escribe HUMANTAY por WhatsApp"></label><label>Métrica principal<input name="metrica_principal" placeholder="Ej. conversaciones"></label><label>Tema o destino<input name="tema" placeholder="Ej. machu_picchu"></label><div class="form-actions"><button class="primary">Aplicar a seleccionadas</button><span id="selection-count" class="muted small">0 seleccionadas</span></div></form></section>`;
}
async function contentPosts() {
  const posts = (await api('/posts')).sort((a,b) => Number(isPending(b)) - Number(isPending(a)));
  latestPosts = posts;
  const pending = posts.filter(isPending).length;
  $('#content-body').innerHTML = `${pending ? `<div class="notice"><b>${pending} publicaciones necesitan contexto.</b> Sus métricas sí participan en el resumen por plataforma, pero no en comparaciones por objetivo o audiencia.</div>${bulkPanel(pending)}` : '<div class="notice info"><b>Clasificación al día.</b> Todas las publicaciones tienen el contexto mínimo para compararlas.</div>'}
    <p class="muted small">Las etiquetas «inferida» son una lectura retrospectiva del texto publicado, no el objetivo original confirmado por Tikaymi. Abre Editar para revisar cada criterio.</p>
    <div class="card tablewrap"><div class="table-tools"><label class="check"><input type="checkbox" id="select-all"> Seleccionar pendientes</label><button class="secondary small-btn" id="auto-themes">Sugerir temas por título</button></div><table><thead><tr><th></th><th>Publicación</th><th>Estado</th><th>Alcance</th><th>Vistas</th><th>Guardados</th><th></th></tr></thead><tbody>${posts.map(p => `<tr data-row="${p.id}"><td><input type="checkbox" class="post-check" value="${p.id}" aria-label="Seleccionar ${esc(p.titulo)}"></td><td><span class="post-title">${esc(p.titulo)}</span><span class="post-meta">${esc(label(p.plataforma))} · ${esc((p.fecha || '').slice(0,10))} ${isPending(p) ? '· <span class="badge warn">Pendiente</span>' : ''} ${p.classification_source ? '· <span class="badge info">Inferida</span>' : ''}</span></td><td><span class="badge">${esc(label(p.estado))}</span></td><td class="metric-value">${fmt(p.reach)}</td><td class="metric-value">${fmt(p.plays)}</td><td class="metric-value">${fmt(p.saves)}</td><td><button class="tertiary small-btn edit-post" data-id="${p.id}">Editar</button></td></tr>`).join('') || '<tr><td colspan="7">No hay publicaciones todavía.</td></tr>'}</tbody></table></div>`;
  const updateCount = () => { const n = document.querySelectorAll('.post-check:checked').length; if ($('#selection-count')) $('#selection-count').textContent = `${n} seleccionada${n === 1 ? '' : 's'}`; document.querySelectorAll('tr[data-row]').forEach(tr => tr.classList.toggle('selected', !!tr.querySelector('input:checked'))); };
  $('#select-all').onchange = e => { document.querySelectorAll('.post-check').forEach((c,i) => c.checked = e.target.checked && isPending(posts[i])); updateCount(); };
  document.querySelectorAll('.post-check').forEach(c => c.onchange = updateCount);
  $('#auto-themes').onclick = guard(async () => { const r = await api('/themes/auto','POST'); toast(`${r.classified} temas sugeridos`); go('contenido','publicaciones'); });
  document.querySelectorAll('.edit-post').forEach(b => b.onclick = () => contentEditor(posts.find(p => String(p.id) === b.dataset.id)));
  const bulk = $('#bulk-form');
  if (bulk) bulk.onsubmit = guard(async e => { e.preventDefault(); const ids = [...document.querySelectorAll('.post-check:checked')].map(x => Number(x.value)); const fields = formData(e.target); const r = await api('/posts/bulk','PUT',{ ids, fields }); toast(`${r.updated} publicaciones actualizadas`); go('contenido','publicaciones'); });
}
function contentEditor(post = {}) {
  $('#content-body').innerHTML = `<form class="card form" id="post-form"><div class="full"><p class="eyebrow">${post.id ? 'Editar publicación' : 'Nueva publicación'}</p><h2 style="margin:0">${post.id ? esc(post.titulo) : 'Define la intención antes de crear'}</h2><p class="muted">Estos datos permiten medir la pieza por el resultado que busca, no solo por sus likes.</p>${post.classification_source ? `<div class="notice info"><b>Clasificación inferida (${esc(post.classification_confidence)}).</b> ${esc(post.classification_rationale)}</div>` : ''}</div>${postFields(post)}<div class="form-actions"><button class="primary">${post.id ? 'Guardar cambios' : 'Crear publicación'}</button><button type="button" class="secondary" id="cancel-edit">Cancelar</button></div></form>`;
  $('#cancel-edit').onclick = () => go('contenido','publicaciones');
  $('#post-form').onsubmit = guard(async e => { e.preventDefault(); await api(post.id ? '/posts/'+post.id : '/posts', post.id ? 'PUT' : 'POST', formData(e.target)); toast(post.id ? 'Publicación actualizada' : 'Publicación creada'); go('contenido','publicaciones'); });
}
async function contentCalendar() {
  const posts = await api('/posts'); latestPosts = posts;
  $('#content-body').innerHTML = `<div class="notice info">El calendario organiza el trabajo editorial. La app nunca publica automáticamente y pide confirmación humana antes de aprobar.</div><div class="kanban">${ESTADOS.map((state,i) => { const list = posts.filter(p => (p.estado || 'borrador') === state); return `<section class="kanban-col"><h3>${esc(label(state))}<span>${list.length}</span></h3>${list.map(p => `<article class="kanban-card"><b>${esc(p.titulo)}</b><small class="muted">${esc(label(p.plataforma))} · ${esc((p.fecha || '').slice(0,10))}</small><div class="kanban-actions">${i ? `<button class="tertiary move" data-id="${p.id}" data-state="${ESTADOS[i-1]}">←</button>` : '<span></span>'}${i < ESTADOS.length-1 ? `<button class="tertiary move" data-id="${p.id}" data-state="${ESTADOS[i+1]}">→</button>` : ''}</div></article>`).join('')}</section>`; }).join('')}</div>`;
  document.querySelectorAll('.move').forEach(b => b.onclick = guard(async () => { if (b.dataset.state === 'aprobado' && !confirm('¿Confirmas que una persona revisó y aprueba esta publicación?')) return; await api('/posts/'+b.dataset.id,'PUT',{ estado:b.dataset.state }); toast('Estado actualizado'); go('contenido','calendario'); }));
}
async function contentGenerate() {
  const [posts, generated, info] = await Promise.all([api('/posts'),api('/generated'),api('/approved-info')]); latestPosts = posts;
  $('#content-body').innerHTML = `${!info.some(x => x.autorizado_publicar) ? '<div class="notice"><b>Antes de generar:</b> agrega información verificada y autorízala para publicación en Configuración → Biblioteca.</div>' : ''}<form class="card form" id="generate-form"><div class="full"><h3>Crear a partir de una publicación</h3><p class="muted">El asistente usará el objetivo, la audiencia y únicamente la información aprobada.</p></div><label>Publicación de referencia<select name="post_id" required><option value="">— Elegir —</option>${posts.filter(p => !isPending(p)).map(p => `<option value="${p.id}">${esc(p.titulo)}</option>`).join('')}</select></label><label>Qué necesitas<select name="tipo">${opts(K.CONTENIDO_TIPOS)}</select></label><label>Idioma<select name="idioma">${opts(K.IDIOMAS)}</select></label><div class="form-actions"><button class="primary">Generar borrador</button></div></form>
    <h2>Borradores generados</h2>${generated.map(g => `<article class="card"><div class="platform-head"><small class="muted">${esc(label(g.tipo))} · ${esc(label(g.idioma))} · publicación #${g.post_id}</small><span class="badge">${esc(label(g.estado))}</span></div><pre>${esc(g.contenido)}</pre><button class="primary small-btn gen-state" data-id="${g.id}" data-state="aprobado">Aprobar</button> <button class="secondary small-btn gen-state" data-id="${g.id}" data-state="rechazado">Rechazar</button> <button class="tertiary small-btn copy-gen" data-id="${g.id}">Copiar</button>${g.tipo === 'carrusel' && g.estado === 'aprobado' ? ` <button class="secondary small-btn download-gen" data-id="${g.id}">Descargar para el constructor</button>` : ''}</article>`).join('') || empty('✦','Aún no hay borradores','Cuando existan suficientes datos e información aprobada, podrás generarlos aquí.')}`;
  $('#generate-form').onsubmit = guard(async e => { e.preventDefault(); const d = formData(e.target); d.post_id = Number(d.post_id); const b=e.target.querySelector('button'); b.disabled=true; try { await api('/generate','POST',d); toast('Borrador generado; requiere revisión humana'); go('contenido','generar'); } finally { b.disabled=false; } });
  document.querySelectorAll('.gen-state').forEach(b => b.onclick = guard(async () => { if (b.dataset.state === 'aprobado' && !confirm('¿Confirmas que una persona revisó este contenido?')) return; await api('/generated/'+b.dataset.id,'PUT',{ estado:b.dataset.state }); toast('Estado actualizado'); go('contenido','generar'); }));
  document.querySelectorAll('.copy-gen').forEach(b => b.onclick = guard(async () => { const item=generated.find(x=>String(x.id)===b.dataset.id); await navigator.clipboard.writeText(item.contenido); toast('Contenido copiado'); }));
  document.querySelectorAll('.download-gen').forEach(b => b.onclick = () => { const item=generated.find(x=>String(x.id)===b.dataset.id); const blob=new Blob([item.contenido],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`tikaymi-carrusel-${item.id}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500); });
}
async function contenido(sub = 'publicaciones') {
  sub = sub || 'publicaciones';
  $('#view').innerHTML = pageHead('Planificación y producción','Contenido','Clasifica lo publicado, prepara nuevas piezas y controla su aprobación.',`<button class="primary" id="new-post">+ Nueva publicación</button>`) + subnav({ publicaciones:'Publicaciones', generar:'Crear con IA', calendario:'Calendario editorial' },sub) + '<div id="content-body"></div>';
  $('#new-post').onclick = () => contentEditor();
  if (sub === 'generar') await contentGenerate(); else if (sub === 'calendario') await contentCalendar(); else await contentPosts();
}

/* Consultas ------------------------------------------------------------- */
async function leadsView() {
  const leads = await api('/leads');
  $('#consultas-body').innerHTML = `<div class="grid cols-3"><div class="card kpi business"><small>Total registradas</small><strong>${leads.length}</strong></div><div class="card kpi intent"><small>Calificadas</small><strong>${leads.filter(l=>['calificado','cotizado','reservado'].includes(l.estado)).length}</strong></div><div class="card kpi business"><small>Reservas</small><strong>${leads.filter(l=>l.estado==='reservado').length}</strong></div></div>
    <form class="card form" id="lead-form"><div class="full"><h3>Registrar una consulta</h3><p class="muted">El código permite saber qué publicación produjo el contacto.</p></div><label>Código de la campaña<input name="campaign_code" placeholder="Ej. HUMANTAY-SEP"></label><label>Origen<input name="fuente" placeholder="WhatsApp, sitio web…"></label><label>Estado<select name="estado">${opts(K.LEAD_ESTADOS)}</select></label><label>Fecha de viaje<input type="date" name="fecha_viaje"></label><label>Número de viajeros<input type="number" min="1" name="viajeros"></label><label>Notas<input name="notas" placeholder="Interés, dudas, presupuesto…"></label><div class="form-actions"><button class="primary">Registrar consulta</button></div></form>
    <div class="card tablewrap"><table><thead><tr><th>Consulta</th><th>Viaje</th><th>Atribución</th><th>Estado</th></tr></thead><tbody>${leads.map(l=>`<tr><td><b>${esc(l.fuente || 'Sin origen')}</b><div class="post-meta">${esc(l.notas || '')}</div></td><td>${esc(l.fecha_viaje || '—')} · ${esc(l.viajeros || '—')} viajeros</td><td>${l.post_id ? '<span class="badge success">Atribuida</span>' : '<span class="badge warn">Sin atribuir</span>'}<div class="post-meta">${esc(l.campaign_code || 'Sin código')}</div></td><td><select class="lead-state" data-id="${l.id}">${opts(K.LEAD_ESTADOS,l.estado)}</select></td></tr>`).join('') || '<tr><td colspan="4">Todavía no hay consultas registradas.</td></tr>'}</tbody></table></div>`;
  $('#lead-form').onsubmit = guard(async e => { e.preventDefault(); const d=formData(e.target); if(d.viajeros)d.viajeros=Number(d.viajeros); const r=await api('/leads','POST',d); toast(r.atribuido?'Consulta registrada y atribuida':'Consulta guardada; el código no coincide con una publicación'); go('consultas','leads'); });
  document.querySelectorAll('.lead-state').forEach(s => s.onchange = guard(async () => { await api('/leads/'+s.dataset.id,'PUT',{estado:s.value}); toast('Estado actualizado'); }));
}
function trackingView() {
  $('#consultas-body').innerHTML = `<div class="grid cols-2"><section class="card"><h3>Crea un enlace rastreable</h3><p class="muted">Usa un código distinto por campaña para reconocer las consultas que produce.</p><form class="form" id="links-form"><label>Código de campaña *<input name="campaign_code" required placeholder="HUMANTAY-SEP"></label><label>Plataforma<select name="plataforma"><option value="">— Elegir —</option>${opts(K.PLATAFORMAS)}</select></label><label class="full">URL de destino<input name="site_url" type="url" placeholder="https://tikaymi.com/..."></label><label class="full">Número de WhatsApp<input name="whatsapp" placeholder="51999999999"></label><div class="form-actions"><button class="primary">Crear enlaces</button></div></form></section><section><div class="card soft"><h3>¿Cómo funciona?</h3><ol><li>Crea un código fácil de reconocer.</li><li>Úsalo en el enlace o mensaje de la publicación.</li><li>Registra el mismo código cuando llegue una consulta.</li><li>Tikaymi podrá relacionar contenido con resultados comerciales.</li></ol></div><div id="links-output"></div></section></div>`;
  $('#links-form').onsubmit = guard(async e=>{ e.preventDefault(); const r=await api('/links','POST',formData(e.target)); $('#links-output').innerHTML=Object.entries(r).map(([k,v])=>`<div class="card"><small class="muted">${esc(label(k))}</small><p style="word-break:break-all">${esc(v)}</p><button class="secondary small-btn copy-link" data-value="${esc(v)}">Copiar</button></div>`).join(''); document.querySelectorAll('.copy-link').forEach(b=>b.onclick=guard(async()=>{await navigator.clipboard.writeText(b.dataset.value);toast('Enlace copiado');})); });
}
async function consultas(sub = 'leads') {
  sub = sub || 'leads';
  $('#view').innerHTML = pageHead('Del interés al negocio','Consultas','Registra contactos y descubre qué contenido contribuye a cotizaciones y reservas.') + subnav({ leads:'Consultas y estados', rastreo:'Enlaces y rastreo' },sub) + '<div id="consultas-body"></div>';
  if(sub==='rastreo') trackingView(); else await leadsView();
}

/* Configuración --------------------------------------------------------- */
async function objectiveView() {
  const list=await api('/objectives');
  $('#config-body').innerHTML=`<div class="grid cols-2"><form class="card form" id="objective-form"><div class="full"><h3>Objetivo del período</h3><p class="muted">Este será el criterio principal para evaluar recomendaciones.</p></div><label>Período<input name="periodo" value="${new Date().toISOString().slice(0,7)}" required></label><label>Resultado buscado<select name="objetivo_negocio">${opts(K.OBJETIVOS_NEGOCIO)}</select></label><label class="full">Meta concreta<input name="meta" placeholder="Ej. 20 consultas calificadas"></label><div class="form-actions"><button class="primary">Guardar objetivo</button></div></form><section><h3>Historial</h3>${list.map(o=>`<div class="card"><div class="platform-head"><b>${esc(o.periodo)}</b><span class="badge">${esc(label(o.objetivo_negocio))}</span></div><p class="muted" style="margin:8px 0 0">${esc(o.meta || 'Sin meta numérica')}</p></div>`).join('')||empty('◎','Sin objetivos','Define el primer objetivo del negocio.')}</section></div>`;
  $('#objective-form').onsubmit=guard(async e=>{e.preventDefault();await api('/objectives','POST',formData(e.target));toast('Objetivo guardado');go('configuracion','objetivo');});
}
function showSyncResult(r) { $('#sync-output').innerHTML=`<div class="notice ${r.ok?'info':'danger'}"><b>${r.ok?'Sincronización completa':'Sincronización con errores'}</b><br>${r.nuevos} nuevas · ${r.actualizados} actualizadas · ${r.omitidos} omitidas${r.aviso?'<br>'+esc(r.aviso):''}</div>`; }
function dataView() {
  $('#config-body').innerHTML=`<div class="grid cols-2"><section class="card"><h3>Sincronizar Meta</h3><p class="muted">Trae publicaciones y métricas de Instagram o Facebook. Solo lectura: no publica nada.</p><label>Plataforma<select id="sync-platform"><option value="instagram">Instagram</option><option value="facebook">Facebook</option></select></label><label class="check" style="margin:12px 0"><input type="checkbox" id="force-sync"> Forzar actualización antes de 20 horas</label><button class="primary" id="sync-button">Sincronizar ahora</button><div id="sync-output" style="margin-top:15px"></div></section><section class="card"><h3>Importar archivo CSV</h3><p class="muted">Úsalo para TikTok, YouTube Shorts o exportaciones manuales.</p><form id="csv-form"><label>Plataforma<select name="platform">${opts(K.PLATAFORMAS)}</select></label><label style="margin-top:12px">Archivo CSV<input type="file" name="file" accept=".csv,text/csv" required></label><button class="primary" style="margin-top:15px">Importar archivo</button></form><div id="csv-output" style="margin-top:15px"></div></section></div><div class="card soft"><h3>Qué ocurre después</h3><p>Las publicaciones importadas se reconocen como contenido ya publicado. Si les falta objetivo, audiencia o CTA, aparecerán en Contenido para clasificarlas en grupo. Sus métricas por plataforma estarán disponibles de inmediato.</p></div>`;
  $('#sync-button').onclick=guard(async()=>{const b=$('#sync-button');b.disabled=true;b.textContent='Sincronizando…';try{const r=await api('/sync/'+$('#sync-platform').value,'POST',{force:$('#force-sync').checked});showSyncResult(r);}finally{b.disabled=false;b.textContent='Sincronizar ahora';}});
  $('#csv-form').onsubmit=guard(async e=>{e.preventDefault();const file=e.target.file.files[0];const r=await api('/import/'+e.target.platform.value,'POST',{csv:await file.text()});$('#csv-output').innerHTML=`<div class="notice info">${r.imported} nuevas · ${r.updated} actualizadas · ${r.errors.length} errores</div>`;});
}
async function libraryView() {
  const [info,assets]=await Promise.all([api('/approved-info'),api('/assets')]);
  $('#config-body').innerHTML=`<div class="notice info"><b>Fuente de verdad:</b> el asistente solo puede usar información autorizada aquí. Nunca debe inventar precios, servicios o testimonios.</div><div class="grid cols-2"><section><form class="card form" id="info-form"><div class="full"><h3>Información verificada</h3></div><label>Tipo<select name="tipo">${opts(K.INFO_TIPOS)}</select></label><label>Título<input name="titulo" required></label><label class="full">Contenido<textarea name="texto" rows="3" required></textarea></label><label>Fuente<input name="fuente" placeholder="Documento, persona o URL"></label><label class="check"><input type="checkbox" name="autorizado_publicar"> Autorizada para publicar</label><div class="form-actions"><button class="primary">Agregar información</button></div></form>${info.map(i=>`<article class="card"><div class="platform-head"><b>${esc(i.titulo)}</b><span class="badge">${esc(label(i.tipo))}</span></div><p>${esc(i.texto)}</p><label class="check"><input class="info-auth" data-id="${i.id}" type="checkbox"${i.autorizado_publicar?' checked':''}> Autorizada para publicar</label><button class="tertiary small-btn delete-info" data-id="${i.id}">Eliminar</button></article>`).join('')}</section><section><form class="card form" id="asset-form"><div class="full"><h3>Fotos y videos reales</h3></div><label>Tipo<select name="tipo">${opts(K.ASSET_TIPOS)}</select></label><label>URL<input name="url" type="url" required></label><label>Descripción<input name="descripcion"></label><label>Destino o uso<input name="destino" placeholder="Machu Picchu, reels…"></label><div class="form-actions"><button class="primary">Agregar recurso</button></div></form>${assets.map(a=>`<article class="card"><div class="platform-head"><b>${esc(a.descripcion||a.tipo)}</b><span class="badge">${esc(label(a.tipo))}</span></div><p class="muted small" style="word-break:break-all">${esc(a.url)}</p><button class="tertiary small-btn delete-asset" data-id="${a.id}">Eliminar</button></article>`).join('')}</section></div>`;
  $('#info-form').onsubmit=guard(async e=>{e.preventDefault();const d=formData(e.target);d.autorizado_publicar=e.target.autorizado_publicar.checked;await api('/approved-info','POST',d);toast('Información agregada');go('configuracion','biblioteca');});
  $('#asset-form').onsubmit=guard(async e=>{e.preventDefault();await api('/assets','POST',formData(e.target));toast('Recurso agregado');go('configuracion','biblioteca');});
  document.querySelectorAll('.info-auth').forEach(x=>x.onchange=guard(async()=>{await api('/approved-info/'+x.dataset.id,'PUT',{autorizado_publicar:x.checked});toast('Autorización actualizada');}));
  document.querySelectorAll('.delete-info').forEach(b=>b.onclick=guard(async()=>{if(confirm('¿Eliminar esta información?')){await api('/approved-info/'+b.dataset.id,'DELETE');go('configuracion','biblioteca');}}));
  document.querySelectorAll('.delete-asset').forEach(b=>b.onclick=guard(async()=>{if(confirm('¿Eliminar este recurso?')){await api('/assets/'+b.dataset.id,'DELETE');go('configuracion','biblioteca');}}));
}
async function aiView() {
  const st=await api('/llm');
  $('#config-body').innerHTML=`<div class="notice info">Las claves se guardan únicamente en el archivo <code>.env</code>. Esta pantalla solo elige el proveedor y el modelo.</div><div class="grid cols-3">${st.proveedores.map(p=>`<form class="card" data-provider="${p.id}"><div class="platform-head"><h3>${esc(p.label)}</h3>${p.id===st.activo.provider?'<span class="badge success">Activo</span>':''}</div><p class="${p.configurado?'':'muted'}">${p.configurado?'✓ Clave configurada':'Falta '+esc(p.clave_env)}</p><label>Modelo<input name="model" value="${esc(p.modelo)}"></label><button class="${p.id===st.activo.provider?'secondary':'primary'}" style="margin-top:14px">${p.id===st.activo.provider?'Guardar modelo':'Usar proveedor'}</button></form>`).join('')}</div>`;
  document.querySelectorAll('[data-provider]').forEach(f=>f.onsubmit=guard(async e=>{e.preventDefault();await api('/llm','PUT',{provider:f.dataset.provider,model:new FormData(f).get('model')});toast('Asistente actualizado');go('configuracion','ia');}));
}
async function configuracion(sub = 'objetivo') {
  sub=sub||'objetivo';
  $('#view').innerHTML=pageHead('Preparación del sistema','Configuración','Administra el objetivo, las fuentes de datos y la información que puede usar el asistente.')+subnav({objetivo:'Objetivo del período',datos:'Fuentes de datos',biblioteca:'Biblioteca aprobada',ia:'Asistente de IA'},sub)+'<div id="config-body"></div>';
  if(sub==='datos') dataView(); else if(sub==='biblioteca') await libraryView(); else if(sub==='ia') await aiView(); else await objectiveView();
}

const VIEWS={inicio,rendimiento,contenido,consultas,configuracion};
api('/constants').then(start).catch(showLogin);
