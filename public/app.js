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
  anuncio_meta:'Anuncio Meta',
};
const ESTADOS = ['borrador', 'revision', 'aprobado', 'programado', 'publicado', 'analizado'];
let K = {};
let route = { section: 'inicio', sub: '' };
let latestPosts = [];
let bulkFeedback = null;
let selectedPlanIdeaId = null;
let selectedPlanId = null;
let planIdeaFilter = 'activas';
let openIdeaId = null;
const GEN_FILTER_DEFAULT = { estado:'activos', q:'', tipo:'', idioma:'', plataforma:'', idea:null, agrupar:true };
let genFilter = { ...GEN_FILTER_DEFAULT };
let openGeneratedId = null;
let siteLang = 'es';
let siteKind = '';

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
function chooseNext({ objectives, posts, pending, leads, approvedCount, plans, approvedIdeas }) {
  if (!objectives.length) return { n:1, title:'Define el objetivo de este período', text:'Dile al sistema qué resultado comercial buscas antes de evaluar contenido.', go:'configuracion', to:'objetivo', cta:'Definir objetivo' };
  if (!posts.length) return { n:2, title:'Conecta tus publicaciones', text:'Sincroniza Instagram o Facebook para obtener métricas reales.', go:'configuracion', to:'datos', cta:'Conectar datos' };
  if (!plans.length) return { n:3, title:'Prepara el plan de esta semana', text:'Convierte los resultados observados en ideas editoriales; las plataformas sin datos quedarán como hipótesis.', go:'contenido', to:'planificar', cta:'Planificar contenido' };
  if (!approvedIdeas) return { n:4, title:'Revisa las ideas del plan', text:'Ajusta y aprueba una idea antes de generar su copy.', go:'contenido', to:'planificar', cta:'Revisar plan' };
  if (pending) return { n:4, title:`Revisa ${pending} publicaciones pendientes`, text:'Clasifícalas en grupo para comparar temas, objetivos y llamados a la acción.', go:'contenido', to:'publicaciones', cta:'Revisar publicaciones' };
  if (!leads.length) return { n:5, title:'Empieza a rastrear consultas', text:'Crea un enlace o palabra clave y registra las consultas que lleguen.', go:'consultas', to:'rastreo', cta:'Configurar rastreo' };
  if (!approvedCount) return { n:6, title:'Aprueba fuentes para redactar', text:'Revisa páginas de tu web o añade servicios y datos verificados a la biblioteca.', go:'configuracion', to:'sitio', cta:'Revisar sitio web' };
  return { n:7, title:'Convierte una idea aprobada en contenido', text:'Prepara el copy y los materiales de una idea del plan.', go:'contenido', to:'generar', cta:'Crear contenido' };
}
function platformSummary(name, group) {
  const a = group?.atencion || {}, i = group?.intencion || {}, b = group?.negocio || {};
  return `<div class="card platform-card"><div class="platform-head"><span class="platform-name">${esc(label(name))}</span>${confidence(group?.confianza)}</div>
    <div class="mini-metrics"><div><small>Alcance</small><b>${fmt(a.reach)}</b></div><div><small>Intención</small><b>${fmt((metricValue(i.saves)||0) + (metricValue(i.shares)||0) + (metricValue(i.clicks)||0))}</b></div><div><small>Consultas</small><b>${fmt(b.consultas)}</b></div></div>
    <small class="muted">${esc(group?.n || 0)} publicaciones analizadas</small></div>`;
}
async function inicio() {
  const [analysis, posts, leads, objectives, approved, assets, llm, plans, siteStatus] = await Promise.all([
    api('/analysis'), api('/posts'), api('/leads'), api('/objectives'), api('/approved-info'), api('/assets'), api('/llm'), api('/plans'), api('/site/status')
  ]);
  latestPosts = posts;
  const pending = posts.filter(isPending).length;
  const latestPlan = plans.length ? await api('/plans/' + plans[0].id) : null;
  const approvedIdeas = latestPlan?.ideas.filter(x => x.status === 'aprobada').length || 0;
  const configured = llm.proveedores.some(p => p.id === llm.activo.provider && p.configurado);
  const approvedCount = approved.filter(x => x.autorizado_publicar).length + (siteStatus.pages.approved || 0);
  const next = chooseNext({ objectives, posts, pending, leads, approvedCount, plans, approvedIdeas });
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
        ${preparationRow(!!plans.length, 'Plan editorial', plans.length ? `${plans.length} plan${plans.length === 1 ? '' : 'es'} guardado${plans.length === 1 ? '' : 's'}` : 'Aún no has convertido los resultados en ideas')}
        ${preparationRow(!pending && !!posts.length, 'Clasificación', pending ? `${pending} publicaciones necesitan contexto` : posts.length ? 'Todo está clasificado' : 'Pendiente de conectar datos')}
        ${preparationRow(!!leads.length, 'Registro de consultas', leads.length ? `${leads.length} consultas registradas` : 'Aún no se puede medir conversión')}
        ${preparationRow(approvedCount > 0, 'Información aprobada', approvedCount ? `${approvedCount} fuentes autorizadas` : 'Necesaria para generar contenido')}
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
const FIELD_LABELS = { titulo:'Título', plataforma:'Plataforma', objetivo_negocio:'Resultado comercial buscado', objetivo_marketing:'Qué debía conseguir', objetivo_contenido:'Qué aporta la pieza', audiencia:'Para quién era', etapa_embudo:'Momento del viaje', cta:'Qué debía hacer la persona', metrica_principal:'Cómo sabíamos si funcionó', idioma:'Idioma', estado:'Estado editorial', fecha:'Fecha', formato:'Formato', tema:'Tema o destino', campaign_code:'Código de rastreo', external_id:'ID externo' };
const CLASSIFICATION_FIELDS = ['objetivo_negocio','objetivo_marketing','objetivo_contenido','audiencia','etapa_embudo','cta','metrica_principal','idioma'];
const ANALYSIS_CONTEXT_FIELDS = ['objetivo_negocio','audiencia','idioma'];
const missingFields = p => ANALYSIS_CONTEXT_FIELDS.filter(k => !p[k] || p[k] === SC);
const isPending = p => missingFields(p).length > 0;
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
  return `<section class="card" id="bulk-card"><div class="page-head" style="margin:0 0 14px"><div><h3>Clasificación rápida</h3><p>Para quitar el aviso solo necesitamos tres respuestas: qué resultado buscaba la pieza, para quién era y en qué idioma. Los demás datos son opcionales y pueden completarse después.</p></div><span class="badge warn">${pending} pendientes</span></div>
    <form class="form" id="bulk-form"><label>Resultado comercial buscado<select name="objetivo_negocio">${opts(K.OBJETIVOS_NEGOCIO,null,true)}</select><small class="muted">¿Buscaba alcance, confianza, una consulta, una cotización o una reserva?</small></label><label>Para quién era<input name="audiencia" placeholder="Ej. personas que organizan su primer viaje a Cusco"><small class="muted">Describe al viajero, no una categoría técnica.</small></label><label>Idioma<select name="idioma">${opts(K.IDIOMAS,null,true)}</select></label><details class="full"><summary>Completar datos editoriales opcionales</summary><div class="form"><label>Qué debía conseguir<input name="objetivo_marketing" placeholder="Ej. ayudar a decidir qué reservar primero"></label><label>Qué aporta la pieza<select name="objetivo_contenido">${opts(K.OBJETIVOS_CONTENIDO,null,true)}</select></label><label>Momento del viaje<select name="etapa_embudo">${opts(K.ETAPAS,null,true)}</select></label><label>Qué debía hacer la persona<input name="cta" placeholder="Ej. escribir por WhatsApp con sus fechas"></label><label>Cómo sabíamos si funcionó<input name="metrica_principal" placeholder="Ej. conversaciones iniciadas"></label><label>Tema o destino<input name="tema" placeholder="Ej. Valle Sagrado o Machu Picchu"></label></div></details><label class="check full"><input type="checkbox" name="overwrite"> Sobrescribir valores ya clasificados (úsalo solo para corregirlos)</label><div class="form-actions"><button class="primary">Guardar clasificación</button><span id="selection-count" class="muted small">0 seleccionadas</span></div></form></section>`;
}
async function contentPosts() {
  const posts = (await api('/posts')).sort((a,b) => Number(isPending(b)) - Number(isPending(a)));
  latestPosts = posts;
  const pending = posts.filter(isPending).length;
  const bulkV2 = !posts.length || Object.prototype.hasOwnProperty.call(posts[0], 'classification_modified_at');
  const selectedAfter = bulkFeedback ? posts.filter(p => bulkFeedback.ids.includes(p.id)) : [];
  const remainingAfter = selectedAfter.filter(isPending);
  const missingAfter = {};
  for (const p of remainingAfter) for (const k of missingFields(p)) missingAfter[k] = (missingAfter[k] || 0) + 1;
  const feedback = bulkFeedback ? `<div class="notice ${remainingAfter.length ? '' : 'info'}"><b>${fmt(bulkFeedback.updated)} de ${selectedAfter.length} publicaciones modificadas.</b> ${remainingAfter.length ? `${remainingAfter.length} de las seleccionadas siguen pendientes. Faltan: ${esc(Object.entries(missingAfter).map(([k,n]) => `${FIELD_LABELS[k]} (${n})`).join(', '))}.` : 'Ninguna de las seleccionadas quedó pendiente.'}${bulkFeedback.skipped_existing ? ` Se conservaron ${bulkFeedback.skipped_existing} valores existentes; activa «Sobrescribir» solo si deseas cambiarlos.` : ''}</div>` : '';
  $('#content-body').innerHTML = `${feedback}${!bulkV2 ? '<div class="notice danger"><b>Servidor desactualizado.</b> Reinicia <code>npm start</code> antes de usar Clasificación rápida: la versión anterior puede sobrescribir campos existentes.</div>' : ''}${pending ? `<div class="notice"><b>${pending} publicaciones necesitan contexto.</b> Sus métricas sí participan en el resumen por plataforma, pero no en comparaciones por objetivo o audiencia.</div>${bulkPanel(pending)}` : '<div class="notice info"><b>Clasificación al día.</b> Todas las publicaciones tienen el contexto mínimo para compararlas.</div>'}
    <p class="muted small">Las etiquetas «inferida» son una lectura retrospectiva del texto publicado, no el objetivo original confirmado por Tikaymi. Abre Editar para revisar cada criterio.</p>
    <div class="card tablewrap"><div class="table-tools"><label class="check"><input type="checkbox" id="select-all"> Seleccionar pendientes</label><button class="secondary small-btn" id="auto-themes">Sugerir temas por título</button></div><table><thead><tr><th></th><th>Publicación</th><th>Estado</th><th>Alcance</th><th>Vistas</th><th>Guardados</th><th></th></tr></thead><tbody>${posts.map(p => `<tr data-row="${p.id}"><td><input type="checkbox" class="post-check" value="${p.id}" aria-label="Seleccionar ${esc(p.titulo)}"></td><td><span class="post-title">${esc(p.titulo)}</span><span class="post-meta">${esc(label(p.plataforma))} · ${esc((p.fecha || '').slice(0,10))} ${isPending(p) ? `· <span class="badge warn">Pendiente</span> · Faltan: ${esc(missingFields(p).map(k => FIELD_LABELS[k]).join(', '))}` : ''} ${p.classification_source ? `· <span class="badge info">${p.classification_modified_at ? 'Inferida y editada' : 'Inferida'}</span>` : ''}</span></td><td><span class="badge">${esc(label(p.estado))}</span></td><td class="metric-value">${fmt(p.reach)}</td><td class="metric-value">${fmt(p.plays)}</td><td class="metric-value">${fmt(p.saves)}</td><td><button class="tertiary small-btn edit-post" data-id="${p.id}">Editar</button></td></tr>`).join('') || '<tr><td colspan="7">No hay publicaciones todavía.</td></tr>'}</tbody></table></div>`;
  const updateCount = () => { const n = document.querySelectorAll('.post-check:checked').length; if ($('#selection-count')) $('#selection-count').textContent = `${n} seleccionada${n === 1 ? '' : 's'}`; document.querySelectorAll('tr[data-row]').forEach(tr => tr.classList.toggle('selected', !!tr.querySelector('input:checked'))); };
  $('#select-all').onchange = e => { document.querySelectorAll('.post-check').forEach((c,i) => c.checked = e.target.checked && isPending(posts[i])); updateCount(); };
  document.querySelectorAll('.post-check').forEach(c => c.onchange = updateCount);
  $('#auto-themes').onclick = guard(async () => { const r = await api('/themes/auto','POST'); toast(`${r.classified} temas sugeridos`); go('contenido','publicaciones'); });
  document.querySelectorAll('.edit-post').forEach(b => b.onclick = () => contentEditor(posts.find(p => String(p.id) === b.dataset.id)));
  const bulk = $('#bulk-form');
  if (bulk && !bulkV2) {
    bulk.querySelector('button[type="submit"], button.primary').disabled = true;
    return;
  }
  if (bulk) bulk.onsubmit = guard(async e => {
    e.preventDefault();
    const ids = [...document.querySelectorAll('.post-check:checked')].map(x => Number(x.value));
    const fields = formData(e.target);
    const overwrite = e.target.overwrite.checked;
    delete fields.overwrite;
    const r = await api('/posts/bulk','PUT',{ ids, fields, overwrite });
    bulkFeedback = { ...r, ids };
    go('contenido','publicaciones');
  });
}
function contentEditor(post = {}) {
  $('#content-body').innerHTML = `<form class="card form" id="post-form"><div class="full"><p class="eyebrow">${post.id ? 'Editar publicación' : 'Nueva publicación'}</p><h2 style="margin:0">${post.id ? esc(post.titulo) : 'Define la intención antes de crear'}</h2><p class="muted">Estos datos permiten medir la pieza por el resultado que busca, no solo por sus likes.</p>${post.classification_source ? `<div class="notice info"><b>Clasificación original inferida (${esc(post.classification_confidence)}).</b> ${esc(post.classification_rationale)}${post.classification_modified_at ? '<br>Esta publicación fue modificada después; el motivo anterior describe la inferencia inicial, no necesariamente los valores actuales.' : ''}</div>` : ''}${post.id && isPending(post) ? `<div class="notice"><b>Aún faltan:</b> ${esc(missingFields(post).map(k => FIELD_LABELS[k]).join(', '))}</div>` : ''}</div>${postFields(post)}<div class="form-actions"><button class="primary">${post.id ? 'Guardar cambios' : 'Crear publicación'}</button><button type="button" class="secondary" id="cancel-edit">Cancelar</button></div></form>`;
  $('#cancel-edit').onclick = () => go('contenido','publicaciones');
  $('#post-form').onsubmit = guard(async e => { e.preventDefault(); await api(post.id ? '/posts/'+post.id : '/posts', post.id ? 'PUT' : 'POST', formData(e.target)); toast(post.id ? 'Publicación actualizada' : 'Publicación creada'); go('contenido','publicaciones'); });
}
async function contentCalendar() {
  const [posts, plans] = await Promise.all([api('/posts'), api('/plans')]); latestPosts = posts;
  const currentPlan = plans.length ? await api('/plans/' + plans[0].id) : null;
  const ideas = currentPlan?.ideas.filter(x => x.status !== 'descartada') || [];
  $('#content-body').innerHTML = `<div class="notice info">El calendario organiza el trabajo editorial. La app nunca publica automáticamente y pide confirmación humana antes de aprobar.</div><h2>Ideas del plan ${currentPlan ? `#${currentPlan.id}` : ''}</h2>${ideas.length ? `<div class="grid cols-2">${ideas.map(x => `<article class="card"><div class="platform-head"><h3>${esc(x.title)}</h3><span class="badge">${esc(label(x.status))}</span></div><p class="muted small">${esc(x.planned_for || 'Sin fecha')} · ${esc(x.platforms.map(label).join(' + '))}</p><p class="muted small">${esc(x.evidence)}</p>${x.status === 'aprobada' ? `<button class="secondary small-btn idea-create" data-id="${x.id}">Crear borradores</button>` : ''}</article>`).join('')}</div>` : empty('□','Sin ideas planeadas','Crea un plan en Planificar contenido para organizar la semana o el mes.')}
    <h2>Publicaciones por estado</h2><div class="kanban">${ESTADOS.map((state,i) => { const list = posts.filter(p => (p.estado || 'borrador') === state); return `<section class="kanban-col"><h3>${esc(label(state))}<span>${list.length}</span></h3>${list.map(p => `<article class="kanban-card"><b>${esc(p.titulo)}</b><small class="muted">${esc(label(p.plataforma))} · ${esc((p.fecha || '').slice(0,10))}</small><div class="kanban-actions">${i ? `<button class="tertiary move" data-id="${p.id}" data-state="${ESTADOS[i-1]}">←</button>` : '<span></span>'}${i < ESTADOS.length-1 ? `<button class="tertiary move" data-id="${p.id}" data-state="${ESTADOS[i+1]}">→</button>` : ''}</div></article>`).join('')}</section>`; }).join('')}</div>`;
  document.querySelectorAll('.move').forEach(b => b.onclick = guard(async () => { if (b.dataset.state === 'aprobado' && !confirm('¿Confirmas que una persona revisó y aprueba esta publicación?')) return; await api('/posts/'+b.dataset.id,'PUT',{ estado:b.dataset.state }); toast('Estado actualizado'); go('contenido','calendario'); }));
  document.querySelectorAll('.idea-create').forEach(b => b.onclick = () => { selectedPlanIdeaId = Number(b.dataset.id); go('contenido','generar'); });
}
const IDEA_FILTERS = { activas:'Activas', propuesta:'Propuestas', aprobada:'Aprobadas', descartada:'Descartadas', todas:'Todas' };
const ideaMatches = (idea, f) => f === 'todas' || (f === 'activas' ? idea.status !== 'descartada' : idea.status === f);
const shortDate = v => { const d = String(v || '').slice(0,10); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T12:00:00').toLocaleDateString('es-PE', { day:'numeric', month:'short', year:'numeric' }) : '—'; };
const chips = (items, active, attr) => `<div class="chips">${items.map(([id, text, n]) => `<button type="button" class="chip${id === active ? ' on' : ''}" ${attr}="${esc(id)}">${esc(text)}${n === undefined ? '' : ` <span>${n}</span>`}</button>`).join('')}</div>`;
const IDEA_STATUS_CLASS = { aprobada:'success', propuesta:'warn', descartada:'' };

async function contentPlan() {
  const [plans, llmStatus, generated] = await Promise.all([api('/plans'), api('/llm'), api('/generated')]);
  const latest = plans.length ? await api('/plans/' + (selectedPlanId && plans.some(p => p.id === selectedPlanId) ? selectedPlanId : plans[0].id)) : null;
  const llmReady = llmStatus.proveedores.some(p => p.id === llmStatus.activo.provider && p.configurado);
  const draftsByIdea = generated.reduce((acc, g) => { if (g.plan_idea_id) acc[g.plan_idea_id] = (acc[g.plan_idea_id] || 0) + 1; return acc; }, {});
  const ideas = latest?.ideas || [];
  const count = s => ideas.filter(x => ideaMatches(x, s)).length;
  const visible = ideas.filter(x => ideaMatches(x, planIdeaFilter));
  const planCard = p => `<button type="button" class="plan-pick${latest && p.id === latest.id ? ' on' : ''}" data-plan="${p.id}"><b>Plan #${p.id} · ${esc(shortDate(p.created_at))}</b><small>${esc(p.cadence === 'mes' ? 'Mes' : 'Semana')} · ${esc(label(p.objetivo_negocio))} · ${p.method === 'ia' ? 'IA' : 'Datos'}</small><span class="plan-counts">${p.ideas_aprobadas ? `<i class="dot ok"></i>${p.ideas_aprobadas} aprob.` : ''}${p.ideas_propuestas ? `<i class="dot warn"></i>${p.ideas_propuestas} por revisar` : ''}${p.ideas_descartadas ? `<i class="dot"></i>${p.ideas_descartadas} desc.` : ''}</span></button>`;
  const ideaRow = idea => {
    const drafts = draftsByIdea[idea.id] || 0;
    const quick = idea.status === 'propuesta'
      ? `<button type="button" class="primary small-btn idea-quick" data-id="${idea.id}" data-status="aprobada">Aprobar</button><button type="button" class="tertiary small-btn idea-quick" data-id="${idea.id}" data-status="descartada">Descartar</button>`
      : idea.status === 'aprobada'
        ? `<button type="button" class="secondary small-btn plan-generate" data-id="${idea.id}">Crear contenido →</button>`
        : `<button type="button" class="tertiary small-btn idea-quick" data-id="${idea.id}" data-status="propuesta">Restaurar</button>`;
    return `<details class="card idea-row status-${esc(idea.status)}" data-idea="${idea.id}"${idea.id === openIdeaId ? ' open' : ''}><summary>
      <span class="idea-main"><span class="idea-title">${esc(idea.title)}</span><span class="idea-meta"><span class="badge ${IDEA_STATUS_CLASS[idea.status] || ''}">${esc(label(idea.status))}</span> ${esc(idea.planned_for ? shortDate(idea.planned_for) : 'Sin fecha')} · ${esc(idea.platforms.map(label).join(' + '))} · ${esc((idea.brief.idioma || 'es').toUpperCase())} · ${esc(label(idea.confidence))}${drafts ? ` · <a href="#contenido/generar" class="link idea-drafts" data-id="${idea.id}">${drafts} borrador${drafts === 1 ? '' : 'es'}</a>` : ''}</span></span>
      <span class="row-actions">${quick}</span></summary>
      <div class="idea-body"><dl class="idea-facts"><dt>Por qué esta idea</dt><dd>${esc(idea.brief.editorial_reason || 'Responde al objetivo editorial del plan.')}</dd><dt>Dato de partida</dt><dd>${esc(idea.evidence)} ${idea.source_url ? `<a href="${esc(idea.source_url)}" target="_blank" rel="noopener">Ver fuente web ↗</a>` : ''}</dd><dt>Límites</dt><dd class="muted">${esc(idea.limitations)}</dd></dl>
      <form class="form plan-idea-form" data-id="${idea.id}"><label>Tema o título<input name="title" value="${esc(idea.title)}" required></label><label>Fecha planeada<input type="date" name="planned_for" value="${esc(idea.planned_for || '')}"></label><label>Audiencia<input name="audiencia" value="${esc(idea.brief.audiencia)}" required></label><label>Llamado a la acción<input name="cta" value="${esc(idea.brief.cta)}" required></label><label class="full">Objetivo de marketing<input name="objetivo_marketing" value="${esc(idea.brief.objetivo_marketing)}" required></label><div class="form-actions"><button type="button" class="secondary small-btn plan-action" data-status="propuesta">Guardar ajustes</button><button type="button" class="primary small-btn plan-action" data-status="aprobada">Guardar y aprobar</button>${idea.status !== 'descartada' ? '<button type="button" class="tertiary small-btn plan-action" data-status="descartada">Descartar</button>' : ''}${idea.status === 'aprobada' ? '<span class="muted small">«Guardar ajustes» devuelve la idea a propuesta para revisarla otra vez.</span>' : ''}</div></form></div></details>`;
  };
  $('#content-body').innerHTML = `<div class="plan-layout">
    <aside class="plan-list"><div class="platform-head"><h3>Planes guardados <span class="muted small">${plans.length}</span></h3><button type="button" class="secondary small-btn" id="toggle-new-plan">+ Nuevo</button></div>${plans.length ? plans.map(planCard).join('') : '<p class="muted small">Todavía no hay planes.</p>'}</aside>
    <div class="plan-main">
      <details class="card new-plan" id="new-plan"${plans.length ? '' : ' open'}><summary><b>Nuevo plan</b> <span class="muted small">De los resultados a ideas con evidencia</span></summary><p class="muted">Combinamos la estrategia editorial, la copia local del sitio y las señales medidas por plataforma. La prioridad comercial no se presenta como resultado probado. <a href="#configuracion/estrategia">Revisar estrategia editorial</a></p><form class="form" id="plan-form"><label>Plan para<select name="cadence"><option value="semana">Una semana · 3 ideas</option><option value="mes">Un mes · 8 ideas</option></select></label><label>Objetivo comercial<select name="objetivo_negocio">${opts(K.OBJETIVOS_NEGOCIO,'consulta_calificada')}</select></label><div class="form-actions"><button type="button" class="secondary" id="save-analysis-plan">Guardar propuesta basada en datos</button><button type="button" class="primary" id="save-ai-plan" ${llmReady ? '' : 'disabled'}>Analizar y proponer con IA</button>${llmReady ? '' : '<span class="muted small">Configura una clave de IA para activar este botón.</span>'}</div></form><div id="plan-preview"></div></details>
      ${latest ? `<div class="plan-head"><div><h2>Plan #${latest.id} <span class="muted small">${esc(shortDate(latest.created_at))}</span></h2><p class="muted small">${esc(latest.cadence === 'mes' ? 'Un mes' : 'Una semana')} · ${esc(label(latest.objetivo_negocio))} · ${latest.method === 'ia' ? 'propuesto con IA' : 'basado en datos'}</p></div>${chips(Object.entries(IDEA_FILTERS).map(([id, text]) => [id, text, count(id)]), planIdeaFilter, 'data-idea-filter')}</div>
      ${visible.length ? visible.map(ideaRow).join('') : empty('◇','No hay ideas con este filtro', planIdeaFilter === 'activas' ? 'Todas las ideas de este plan fueron descartadas. Revisa «Descartadas» o crea un plan nuevo.' : 'Elige otro filtro.')}` : empty('◇','Crea tu primer plan','La propuesta inicial mostrará la evidencia y las limitaciones de cada idea.')}
    </div></div>`;
  const form = $('#plan-form');
  form.onsubmit = e => e.preventDefault();
  const showPreview = guard(async () => {
    const d = formData(form);
    const p = await api(`/plans/preview?cadence=${encodeURIComponent(d.cadence)}&objetivo_negocio=${encodeURIComponent(d.objetivo_negocio)}`);
    $('#plan-preview').innerHTML = `<p class="muted small">${esc(p.summary)}</p><h4>Vista previa</h4>${p.ideas.map(x => `<div class="notice info"><b>${esc(x.title)}</b> · ${esc(x.platforms.map(label).join(' + '))} · ${esc(label(x.brief.idioma))}<br><span class="small">${esc(x.brief.editorial_reason)} ${esc(x.evidence)} ${esc(x.limitations)}</span></div>`).join('')}`;
  });
  form.onchange = showPreview;
  // La vista previa solo se calcula al abrir el panel: no pesa sobre quien solo revisa planes.
  const panel = $('#new-plan');
  let previewed = false;
  const ensurePreview = () => { if (panel.open && !previewed) { previewed = true; showPreview(); } };
  panel.ontoggle = ensurePreview; ensurePreview();
  $('#toggle-new-plan').onclick = () => { panel.open = true; panel.scrollIntoView({ behavior:'smooth', block:'start' }); };
  const savePlan = use_ai => guard(async () => { const b = use_ai ? $('#save-ai-plan') : $('#save-analysis-plan'); b.disabled = true; try { const p = await api('/plans','POST',{ ...formData(form), use_ai }); selectedPlanId = p.id; planIdeaFilter = 'activas'; toast('Plan guardado; revisa y aprueba cada idea'); go('contenido','planificar'); } finally { b.disabled = false; } });
  $('#save-analysis-plan').onclick = savePlan(false);
  $('#save-ai-plan').onclick = savePlan(true);
  document.querySelectorAll('[data-plan]').forEach(b => b.onclick = () => { selectedPlanId = Number(b.dataset.plan); openIdeaId = null; go('contenido','planificar'); });
  document.querySelectorAll('[data-idea-filter]').forEach(b => b.onclick = () => { planIdeaFilter = b.dataset.ideaFilter; go('contenido','planificar'); });
  document.querySelectorAll('.idea-row').forEach(d => d.ontoggle = () => { if (d.open) openIdeaId = Number(d.dataset.idea); else if (openIdeaId === Number(d.dataset.idea)) openIdeaId = null; });
  // Los botones del resumen actúan sin abrir ni cerrar la fila.
  const stop = fn => e => { e.preventDefault(); e.stopPropagation(); fn(e); };
  document.querySelectorAll('.idea-quick').forEach(b => b.onclick = stop(guard(async () => {
    await api('/plan-ideas/' + b.dataset.id,'PUT',{ status:b.dataset.status });
    toast(b.dataset.status === 'aprobada' ? 'Idea aprobada' : b.dataset.status === 'descartada' ? 'Idea descartada' : 'Idea restaurada'); go('contenido','planificar');
  })));
  document.querySelectorAll('.plan-action').forEach(b => b.onclick = guard(async () => {
    const f = b.closest('form'); const d = formData(f);
    await api('/plan-ideas/' + f.dataset.id,'PUT',{ title:d.title, planned_for:d.planned_for, status:b.dataset.status, brief:{ audiencia:d.audiencia, cta:d.cta, objetivo_marketing:d.objetivo_marketing } });
    openIdeaId = b.dataset.status === 'descartada' ? null : Number(f.dataset.id);
    toast('Idea actualizada'); go('contenido','planificar');
  }));
  document.querySelectorAll('.plan-generate').forEach(b => b.onclick = stop(() => { selectedPlanIdeaId = Number(b.dataset.id); go('contenido','generar'); }));
  document.querySelectorAll('.idea-drafts').forEach(a => a.onclick = stop(() => { genFilter = { ...GEN_FILTER_DEFAULT, estado:'todos', idea:Number(a.dataset.id) }; go('contenido','generar'); }));
}
// Datos faltantes de un borrador: fuera del texto publicable, con el camino para resolverlos.
function pendingBox(g) {
  let declared = [];
  try { declared = JSON.parse(g.pending_json || '[]'); } catch { declared = []; }
  const inText = [...new Set(String(g.contenido || '').match(/\[FALTA DATO:[^\]]+\]/gi) || [])];
  if (g.tipo === 'imagen_unica') { try { declared = JSON.parse(g.contenido).pending || []; } catch { /* JSON inválido: lo informa la revisión visual */ } }
  const items = [...new Set([...declared, ...inText])].map(x => String(x).replace(/^\[FALTA DATO:\s*|\]$/g, ''));
  if (!items.length) return '';
  const how = g.tipo === 'anuncio_meta'
    ? 'Los textos del anuncio no los incluyen. Si quieres usarlos, apruébalos en Sitio web o Biblioteca y usa «Regenerar parte»; para el enlace, crea el anuncio desde un tour aprobado.'
    : g.tipo === 'imagen_unica'
    ? 'Resuélvelos en «Revisar y descargar PNG» → Ajustar textos y resolver pendientes. Retira un dato solo si la imagen no lo afirma o ya lo comprobaste.'
    : inText.length
      ? 'El texto todavía contiene marcadores y no puede aprobarse. Usa «Editar texto» para escribir el dato verificado o retirar la frase.'
      : 'No aparecen en el texto: el copy ya puede publicarse sin ellos. Si quieres incluirlos, regístralos en Configuración → Biblioteca o aprueba la página web que los contiene, y usa «Regenerar parte».';
  return `<div class="notice"><b>Datos que faltan (${items.length})</b><ul>${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul><span class="small">${how}</span></div>`;
}

// Anuncio Meta legible: un bloque por variante, con contador de caracteres y botón para copiar cada campo.
function adView(g) {
  let ad; try { ad = JSON.parse(g.contenido); } catch { return `<pre>${esc(g.contenido)}</pre>`; }
  const field = (name, text, max) => text ? `<div class="ad-field"><div class="platform-head"><b>${esc(name)}</b><span class="muted small">${max ? `${text.length}/${max}` : ''} <button type="button" class="tertiary small-btn copy-field" data-text="${esc(text)}">Copiar</button></span></div><p>${esc(text).replace(/\n/g,'<br>')}</p></div>` : '';
  return `<div class="ad-view"><p class="muted small">${esc(ad.objetivo_meta || '')} · ${esc((ad.ubicaciones || []).map(label).join(' + '))} · Botón: ${esc(ad.boton || '')}</p>${(ad.variantes || []).map(v => `<section class="card ad-variant"><h4>Variante ${esc(v.id)} · ${esc(v.angulo)} <span class="badge">${esc(v.campaign_code)}</span></h4>
    ${field('Texto principal (visible: primeras 125 letras)', v.texto_principal, 0)}${field('Título', v.titulo, 40)}${field('Descripción', v.descripcion, 30)}
    ${field('Mensaje predeterminado de WhatsApp', v.mensaje_whatsapp, 0)}${field('Enlace «Más información» (con UTM)', v.url_destino, 0)}</section>`).join('')}
    ${(ad.warnings || []).length ? `<ul class="muted small">${ad.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}</div>`;
}

async function contentGenerate() {
  const [posts, generated, info, plans, siteStatus, toursEs, toursEn] = await Promise.all([api('/posts'),api('/generated'),api('/approved-info'),api('/plans'),api('/site/status'),api('/site/pages?lang=es&kind=tour'),api('/site/pages?lang=en&kind=tour')]); latestPosts = posts;
  const tours = [...toursEn, ...toursEs].filter(t => t.approved);
  const details = await Promise.all(plans.map(p => api('/plans/' + p.id)));
  const ideas = details.flatMap(p => p.ideas.filter(x => x.status === 'aprobada'));
  const extra = '<option value="">Solo copy</option><option value="imagen_unica">Imagen única + copy</option><option value="carrusel">Carrusel + copy</option><option value="guion">Reel/video + copy</option><option value="prompt_flow">Reel/video + prompts + copy</option><option value="anuncio_meta">Anuncio Meta: imagen + textos de anuncio</option><option value="anuncio_meta_carrusel">Anuncio Meta: carrusel + textos de anuncio</option>';
  const openCreate = !!selectedPlanIdeaId || !generated.length;
  $('#content-body').innerHTML = `<details class="card create-panel" id="create-panel"${openCreate ? ' open' : ''}><summary><b>＋ Crear contenido nuevo</b> <span class="muted small">Desde una idea aprobada, un brief libre o una publicación</span></summary>
    ${!info.some(x => x.autorizado_publicar) && !siteStatus.pages.approved ? '<div class="notice"><b>Antes de generar:</b> aprueba una página en Configuración → Sitio web o agrega información verificada en Biblioteca. Puedes planificar ideas desde las estadísticas entretanto.</div>' : ''}<p class="muted small">El copy se genera siempre. Los materiales adicionales son opcionales. Todo queda en revisión humana; no se publica automáticamente.</p>
    <form class="card flat form package-form" data-source="idea"><div class="full"><h3>Desde una idea del plan</h3><p class="muted">Primero aprueba la idea en Planificar contenido. Se conserva el idioma previsto y recibirás un copy para cada plataforma destino.</p></div><label>Idea aprobada<select name="plan_idea_id" required><option value="">— Elegir —</option>${ideas.map(x => `<option value="${x.id}"${x.id === selectedPlanIdeaId ? ' selected' : ''}>${esc(x.title)} · ${esc(x.platforms.map(label).join(' + '))} · ${esc(label(x.brief.idioma || 'es'))}</option>`).join('')}</select></label><label>Materiales<select name="extra">${extra}</select></label><div class="form-actions"><button class="primary" ${!ideas.length ? 'disabled' : ''}>Generar borradores</button></div></form>
    <details class="card flat"><summary>Crear sin plan ni publicación previa</summary><form class="form package-form" data-source="brief"><p class="muted full">Describe la intención de la pieza. La IA solo podrá usar páginas aprobadas del sitio y datos de la biblioteca aprobada. Para promocionar un tour, elígelo: sus datos y su enlace se usan como fuente principal.</p><label class="full">Tour (opcional)<select name="source_url"><option value="">— Ninguno —</option>${tours.map(t => `<option value="${esc(t.url)}" data-title="${esc(t.title)}" data-lang="${esc(t.lang)}">${esc(t.title)} · ${esc(t.lang.toUpperCase())}</option>`).join('')}</select></label><label>Tema o título<input name="titulo" required></label><label>Plataforma principal<select name="plataforma" required>${opts(K.PLATAFORMAS)}</select></label><label>Objetivo comercial<select name="objetivo_negocio">${opts(K.OBJETIVOS_NEGOCIO)}</select></label><label>Objetivo de marketing<input name="objetivo_marketing" required placeholder="Ej. resolver una duda frecuente"></label><label>Propósito<select name="objetivo_contenido">${opts(K.OBJETIVOS_CONTENIDO)}</select></label><label>Audiencia<input name="audiencia" required></label><label>Etapa<select name="etapa_embudo">${opts(K.ETAPAS)}</select></label><label>CTA<input name="cta" required></label><label>Resultado que medirás<input name="metrica_principal" required placeholder="Ej. conversaciones iniciadas"></label><label>Idioma<select name="idioma">${opts(K.IDIOMAS)}</select></label><label>Materiales<select name="extra">${extra}</select></label><div class="form-actions"><button class="primary">Generar borradores</button></div></form></details>
    <details class="card flat"><summary>Usar una publicación existente como referencia (opcional)</summary><form class="form package-form" data-source="post"><label>Publicación<select name="post_id" required><option value="">— Elegir —</option>${posts.filter(p => !isPending(p)).map(p => `<option value="${p.id}">${esc(p.titulo)}</option>`).join('')}</select></label><label>Materiales<select name="extra">${extra}</select></label><label>Idioma<select name="idioma">${opts(K.IDIOMAS)}</select></label><div class="form-actions"><button class="primary">Generar borradores</button></div></form></details></details>
    <section class="generated-section"><div class="platform-head"><h2>Borradores generados</h2><span class="muted small">${generated.length} pieza${generated.length === 1 ? '' : 's'}</span></div>
    <div id="generated-states"></div>
    <div class="generated-toolbar"><label>Buscar<input id="generated-search" type="search" placeholder="Título, origen o contenido" value="${esc(genFilter.q)}"></label><label>Tipo<select id="generated-type"><option value="">Todos</option>${[...new Set(generated.map(g => g.tipo))].map(x => `<option value="${esc(x)}"${x === genFilter.tipo ? ' selected' : ''}>${esc(label(x))}</option>`).join('')}</select></label><label>Plataforma<select id="generated-platform"><option value="">Todas</option>${[...new Set(generated.map(g => g.plataforma).filter(Boolean))].map(x => `<option value="${esc(x)}"${x === genFilter.plataforma ? ' selected' : ''}>${esc(label(x))}</option>`).join('')}</select></label><label>Idioma<select id="generated-lang"><option value="">Todos</option>${[...new Set(generated.map(g => g.idioma))].map(x => `<option value="${esc(x)}"${x === genFilter.idioma ? ' selected' : ''}>${esc(label(x))}</option>`).join('')}</select></label><label class="check"><input type="checkbox" id="generated-group"${genFilter.agrupar ? ' checked' : ''}> Agrupar por origen</label></div>
    <div id="generated-idea-filter"></div><div id="generated-list"></div></section>`;
  const GEN_STATES = [['activos','Activos', g => g.estado !== 'rechazado'], ['revision','En revisión', g => g.estado === 'revision'], ['aprobado','Aprobados', g => g.estado === 'aprobado'], ['rechazado','Rechazados', g => g.estado === 'rechazado'], ['todos','Todos', () => true]];
  const ORIGIN = { idea:'Idea del plan', publicacion:'Publicación', brief:'Brief libre' };
  const STATE_CLASS = { aprobado:'success', revision:'warn', rechazado:'danger' };
  // Resumen de una línea: los formatos JSON muestran su titular, no la estructura.
  const snippet = g => {
    try {
      const j = JSON.parse(g.contenido);
      if (g.tipo === 'anuncio_meta') return (j.variantes || []).map(v => v.gancho || v.titulo).filter(Boolean).join(' · ');
      if (g.tipo === 'imagen_unica') return [j.visual?.headline, j.visual?.support].filter(Boolean).join(' — ');
      if (g.tipo === 'carrusel') { const first = j.slides?.[0]?.data || {}; return `${first.titulo || first.h1 || 'Carrusel'} · ${(j.slides || []).length} láminas`; }
    } catch { /* texto plano */ }
    return String(g.contenido || '').replace(/[#*_`{}[\]]/g,'').replace(/\s+/g,' ').trim().slice(0,200);
  };
  const genCard = g => {
    const failed = g.visual_review?.estado === 'revision_fallida';
    const visual = g.tipo === 'imagen_unica' ? `<a class="btn secondary small-btn" href="/imagen-unica.html?id=${g.id}" target="_blank">Revisar y descargar PNG</a>` : g.tipo === 'carrusel' ? `<a class="btn secondary small-btn" href="/constructor/${encodeURIComponent('Tikaymi - Constructor de Carruseles.html')}?id=${g.id}" target="_blank">Revisar y exportar carrusel</a>` : '';
    return `<details class="card generated-card" data-gen="${g.id}"${g.id === openGeneratedId ? ' open' : ''}><summary><span class="gen-main"><span class="gen-line"><b>${esc(label(g.tipo))}</b>${g.plataforma ? ` · ${esc(label(g.plataforma))}` : ''} · ${esc((g.idioma || '').toUpperCase())} · <span class="muted">#${g.id} · ${esc(shortDate(g.created_at))}</span></span><span class="gen-snippet">${esc(snippet(g))}</span></span><span class="badge ${STATE_CLASS[g.estado] || ''}">${failed ? 'Composición fallida · requiere revisión' : esc(label(g.estado))}</span></summary>
      ${failed ? `<p class="notice">${esc(g.visual_review.errors.join(' · '))}</p>` : ''}${pendingBox(g)}${g.tipo === 'anuncio_meta' ? adView(g) : `<pre>${esc(g.contenido)}</pre>`}
      <div class="form-actions gen-actions"><span class="action-group">${g.estado !== 'aprobado' ? `<button class="primary small-btn gen-state" data-id="${g.id}" data-state="aprobado">Aprobar</button>` : ''}${g.estado !== 'rechazado' ? `<button class="secondary small-btn gen-state" data-id="${g.id}" data-state="rechazado">Rechazar</button>` : ''}${visual}${g.tipo === 'carrusel' && g.estado === 'aprobado' ? `<button class="secondary small-btn download-gen" data-id="${g.id}">Descargar para el constructor</button>` : ''}</span>
      <span class="action-group">${['copy','guion','prompt_flow','whatsapp','anuncio_meta'].includes(g.tipo) ? `<button class="tertiary small-btn gen-edit" data-id="${g.id}">Editar texto</button>` : ''}<button class="tertiary small-btn copy-gen" data-id="${g.id}">Copiar</button><button class="tertiary small-btn gen-regenerate" data-id="${g.id}">Regenerar parte</button><button class="tertiary small-btn gen-feedback" data-id="${g.id}">Feedback</button><button class="tertiary small-btn gen-history" data-id="${g.id}">Historial</button></span></div></details>`;
  };
  const renderGenerated = () => {
    const query = genFilter.q.toLowerCase().trim();
    const base = generated.filter(g => (!genFilter.tipo || g.tipo === genFilter.tipo) && (!genFilter.plataforma || g.plataforma === genFilter.plataforma) && (!genFilter.idioma || g.idioma === genFilter.idioma) && (!genFilter.idea || g.plan_idea_id === genFilter.idea) && (!query || `${g.origen_titulo || ''} ${g.contenido} ${g.tipo} ${g.id}`.toLowerCase().includes(query)));
    const stateFn = (GEN_STATES.find(([id]) => id === genFilter.estado) || GEN_STATES[0])[2];
    const filtered = base.filter(stateFn);
    $('#generated-states').innerHTML = chips(GEN_STATES.map(([id, text, fn]) => [id, text, base.filter(fn).length]), genFilter.estado, 'data-gen-state');
    const ideaTitle = genFilter.idea && generated.find(g => g.plan_idea_id === genFilter.idea)?.origen_titulo;
    $('#generated-idea-filter').innerHTML = genFilter.idea ? `<div class="notice info filter-note">Mostrando borradores de la idea <b>${esc(ideaTitle || '#' + genFilter.idea)}</b> <button type="button" class="tertiary small-btn" id="clear-idea-filter">Quitar filtro ✕</button></div>` : '';
    const groups = new Map();
    filtered.forEach(g => {
      const key = genFilter.agrupar ? `${g.origen}:${g.plan_idea_id || g.post_id || g.package_id || g.id}` : 'all';
      if (!groups.has(key)) groups.set(key, { g, items:[] });
      groups.get(key).items.push(g);
    });
    $('#generated-list').innerHTML = filtered.length ? [...groups.values()].map(({ g, items }) => genFilter.agrupar
      ? `<section class="generated-group"><div class="group-head"><div><h3>${esc(g.origen_titulo || 'Pieza sin título')}</h3><p class="muted small">${esc(ORIGIN[g.origen] || '')}${g.plan_id ? ` · Plan #${g.plan_id}` : ''} · ${esc(shortDate(items[items.length - 1].created_at))}</p></div><span class="group-count">${items.length}</span></div>${items.map(genCard).join('')}</section>`
      : items.map(genCard).join('')).join('') : empty('✦','No hay borradores con estos filtros','Cambia el estado, el tipo o la búsqueda.');
    document.querySelectorAll('[data-gen-state]').forEach(b => b.onclick = () => { genFilter.estado = b.dataset.genState; renderGenerated(); });
    if ($('#clear-idea-filter')) $('#clear-idea-filter').onclick = () => { genFilter.idea = null; renderGenerated(); };
    document.querySelectorAll('.generated-card').forEach(d => d.ontoggle = () => { if (d.open) openGeneratedId = Number(d.dataset.gen); else if (openGeneratedId === Number(d.dataset.gen)) openGeneratedId = null; });
    document.querySelectorAll('.gen-state').forEach(b => b.onclick = guard(async () => { if (b.dataset.state === 'aprobado' && !confirm('¿Confirmas que una persona revisó este contenido?')) return; await api('/generated/'+b.dataset.id,'PUT',{ estado:b.dataset.state }); toast('Estado actualizado'); go('contenido','generar'); }));
    document.querySelectorAll('.gen-edit').forEach(b => b.onclick = () => {
      const item = generated.find(x => String(x.id) === b.dataset.id), card = b.closest('details');
      if (card.querySelector('.gen-edit-form')) return;
      const form = document.createElement('form'); form.className = 'form gen-edit-form';
      form.innerHTML = `<label class="full">Texto final<textarea name="contenido" rows="12">${esc(item.contenido)}</textarea></label><label class="full">Qué corregiste<input name="motivo" required placeholder="Ej. retiré el dato pendiente de horarios"></label><div class="form-actions"><button class="primary small-btn">Guardar y volver a revisión</button><button type="button" class="tertiary small-btn gen-edit-cancel">Cancelar</button></div>`;
      (card.querySelector('.ad-view') || card.querySelector('pre')).replaceWith(form);
      form.querySelector('.gen-edit-cancel').onclick = () => go('contenido','generar');
      form.onsubmit = guard(async e => { e.preventDefault(); await api('/generated/'+item.id+'/edit','PUT',{ ...formData(form), segmento:'pieza' }); toast('Corrección guardada; vuelve a revisión'); go('contenido','generar'); });
    });
    document.querySelectorAll('.copy-field').forEach(b => b.onclick = guard(async () => { await navigator.clipboard.writeText(b.dataset.text); toast('Campo copiado'); }));
    document.querySelectorAll('.copy-gen').forEach(b => b.onclick = guard(async () => { const item=generated.find(x=>String(x.id)===b.dataset.id); await navigator.clipboard.writeText(item.contenido); toast('Contenido copiado'); }));
    document.querySelectorAll('.gen-feedback').forEach(b => b.onclick = guard(async () => { const motivo = prompt('¿Qué debe corregirse?'); if (!motivo) return; await api('/generated/'+b.dataset.id+'/feedback','POST',{ motivo }); toast('Feedback guardado'); }));
    document.querySelectorAll('.gen-history').forEach(b => b.onclick = guard(async () => { const rows = await api('/generated/'+b.dataset.id+'/versions'); alert(rows.length ? rows.map(x => `v${x.version}: ${x.motivo}`).join('\n') : 'No hay versiones anteriores.'); }));
    document.querySelectorAll('.gen-regenerate').forEach(b => b.onclick = guard(async () => { const segmento = prompt('Segmento (slide:1, clip:1 o pieza completa):','pieza'); if (!segmento) return; const instruccion = prompt('¿Qué debe cambiar?','Corregir el segmento manteniendo el mensaje y CTA.'); if (!instruccion) return; await api('/generated/'+b.dataset.id+'/regenerate','POST',{ segmento, instruccion }); toast('Nueva revisión generada'); go('contenido','generar'); }));
    document.querySelectorAll('.download-gen').forEach(b => b.onclick = () => { const item=generated.find(x=>String(x.id)===b.dataset.id); const blob=new Blob([item.contenido],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`tikaymi-carrusel-${item.id}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500); });
  };
  $('#generated-search').oninput = e => { genFilter.q = e.target.value; renderGenerated(); };
  [['generated-type','tipo'],['generated-platform','plataforma'],['generated-lang','idioma']].forEach(([id, key]) => $('#'+id).onchange = e => { genFilter[key] = e.target.value; renderGenerated(); });
  $('#generated-group').onchange = e => { genFilter.agrupar = e.target.checked; renderGenerated(); };
  renderGenerated();
  const failures=await api('/visual-failures');
  if(failures.length){
    const section=document.createElement('details');section.className='card';
    const summary=document.createElement('summary');summary.textContent='Revisiones visuales fallidas ('+failures.length+')';section.appendChild(summary);
    failures.forEach(x=>{
      const p=document.createElement('p');p.textContent='#'+x.id+' · '+x.tipo+': '+JSON.parse(x.errors_json).join(' · ');section.appendChild(p);
      const detail=document.createElement('details'),heading=document.createElement('summary'),raw=document.createElement('pre');
      heading.textContent='Ver respuesta conservada para corregir';raw.textContent=x.contenido;detail.append(heading,raw);section.appendChild(detail);
    });
    $('#content-body').appendChild(section);
  }
  const typeSelect=$('#generated-type');
  document.querySelectorAll('.package-form select[name="extra"]').forEach(select=>{
    select.closest('label').firstChild.textContent='Formato ';
    const hint=document.createElement('p'); hint.className='muted small';
    const form=select.closest('form');let request=0;
    const suggest=async()=>{
      const seq=++request,d=formData(form);
      const selectedIdea=ideas.find(x=>String(x.id)===d.plan_idea_id);
      const source=form.dataset.source==='idea'?selectedIdea?.brief:form.dataset.source==='post'?posts.find(x=>String(x.id)===d.post_id):d;
      hint.textContent=TikaymiVisual.formatRecommendation(null);
      const platform=source?.plataforma || (form.dataset.source==='idea'?selectedIdea?.platforms?.[0]:null), objective=source?.objetivo_negocio;
      if(!platform || !objective)return;
      try{
        const analysis=await api('/analysis?plataforma='+encodeURIComponent(platform)+'&objetivo='+encodeURIComponent(objective));
        if(seq===request)hint.textContent=TikaymiVisual.formatRecommendation(analysis);
      }catch{if(seq===request)hint.textContent='Hipótesis editorial: elige una imagen para una idea breve, carrusel para pasos o video para voz/movimiento. No se pudo consultar la evidencia.';}
    };
    form.addEventListener('change',suggest);suggest();
    select.closest('label').appendChild(hint);
  });
  // Elegir un tour completa el título y fija el idioma de su página: una pieza, una lengua.
  const tourSelect = document.querySelector('.package-form select[name="source_url"]');
  if (tourSelect) tourSelect.addEventListener('change', () => {
    const option = tourSelect.selectedOptions[0], form = tourSelect.closest('form');
    if (!option?.value) return;
    if (!form.titulo.value.trim()) form.titulo.value = option.dataset.title;
    form.idioma.value = option.dataset.lang;
  });
  document.querySelectorAll('.package-form').forEach(f => f.onsubmit = guard(async e => {
    e.preventDefault(); const d = formData(f); const source = f.dataset.source;
    const input = { idioma:d.idioma, extra:d.extra || null };
    if (d.extra === 'anuncio_meta_carrusel') { input.extra = 'anuncio_meta'; input.ad_visual = 'carrusel'; }
    if (!d.source_url) delete d.source_url;
    if (source === 'idea') input.plan_idea_id = Number(d.plan_idea_id);
    else if (source === 'post') input.post_id = Number(d.post_id);
    else { delete d.extra; input.brief = d; }
    const b = f.querySelector('button'); b.disabled = true;
    try { await api('/generate-package','POST',input); toast(input.extra === 'anuncio_meta' ? 'Visual y textos de anuncio generados; revisa antes de aprobar' : 'Copy y materiales generados; revisa antes de aprobar'); go('contenido','generar'); }
    finally { b.disabled = false; }
  }));
}
async function contenido(sub = 'publicaciones') {
  sub = sub || 'publicaciones';
  $('#view').innerHTML = pageHead('Planificación y producción','Contenido','De las estadísticas a un plan, y del plan a piezas aprobadas.',`<button class="primary" id="new-post">+ Nueva publicación</button>`) + subnav({ planificar:'Planificar contenido', publicaciones:'Publicaciones', generar:'Crear con IA', calendario:'Calendario editorial' },sub) + '<div id="content-body"></div>';
  $('#new-post').onclick = () => contentEditor();
  if (sub === 'planificar') await contentPlan(); else if (sub === 'generar') await contentGenerate(); else if (sub === 'calendario') await contentCalendar(); else await contentPosts();
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
async function siteView() {
  const [status, pages] = await Promise.all([api('/site/status'), api(`/site/pages?lang=${siteLang}${siteKind ? '&kind=' + encodeURIComponent(siteKind) : ''}`)]);
  const last = status.latest;
  $('#config-body').innerHTML = `<div class="notice info"><b>Copia local del sitio web.</b> La app no vuelve a consultar Tikaymi.com para cada plan. Pulsa Actualizar cuando cambie la web; las páginas nuevas o modificadas necesitan revisión antes de usarse para redactar contenido.</div>
    <section class="card"><div class="page-head" style="margin:0"><div><h3>Sitio web Tikaymi</h3><p class="muted">Fuente: <a href="https://tikaymi.com/sitemap.xml" target="_blank" rel="noopener">sitemap.xml</a> · ${status.pages.total || 0} páginas guardadas · ${status.pages.approved || 0} aprobadas</p><p class="small muted">${last ? `Última actualización: ${esc(last.completed_at || last.started_at)} · ${last.created} nuevas · ${last.changed} cambiadas · ${last.removed || 0} retiradas · ${last.failed} fallidas${last.error ? ' · ' + esc(last.error) : ''}` : 'Todavía no se ha sincronizado el sitio.'}</p></div><button class="primary" id="site-sync">Actualizar desde Tikaymi.com</button></div></section>
    <div class="card form"><label>Idioma<select id="site-lang"><option value="es"${siteLang === 'es' ? ' selected' : ''}>Español</option><option value="en"${siteLang === 'en' ? ' selected' : ''}>Inglés</option></select></label><label>Tipo<select id="site-kind"><option value="">Todos</option>${['tour','blog','evento','destino','institucional'].map(k => `<option value="${k}"${siteKind === k ? ' selected' : ''}>${esc(label(k))}</option>`).join('')}</select></label></div>
    <p class="muted small">Aprobar una página autoriza sus datos para borradores relacionados. Si cambia en una actualización posterior, la aprobación se retira automáticamente hasta que vuelvas a revisarla.</p>
    <div class="card form"><div class="form-actions"><button type="button" class="secondary" id="site-select-all">Seleccionar todas las páginas visibles</button><button type="button" class="primary" id="site-approve-selected">Aprobar seleccionadas</button><button type="button" class="secondary" id="site-approve-tours-blogs">Aprobar todos los tours y blogs (ES + EN)</button></div><p class="muted small">La aprobación por lote solo afecta la copia local activa; no publica ni modifica tu sitio.</p></div>
    ${pages.map(p => `<details class="card"><summary><input type="checkbox" class="site-select" data-url="${esc(p.url)}" aria-label="Seleccionar ${esc(p.title)}"> ${esc(p.title)} · ${esc(label(p.kind))} ${p.approved ? '✓ Aprobada' : p.changed_at ? '· Cambió: revisar' : '· Pendiente'}</summary><p class="muted small">${esc(p.description || p.excerpt || '')}</p><p><a href="${esc(p.url)}" target="_blank" rel="noopener">Ver página original ↗</a></p><p class="muted small">Descargada: ${esc(p.fetched_at)}${p.sitemap_lastmod ? ' · Última modificación declarada: ' + esc(p.sitemap_lastmod) : ''}</p><label class="check"><input type="checkbox" class="site-approve" data-url="${esc(p.url)}"${p.approved ? ' checked' : ''}> Aprobada para redactar contenido</label></details>`).join('') || empty('□','Sin páginas guardadas','Pulsa Actualizar desde Tikaymi.com para crear la primera copia local.')}`;
  $('#site-sync').onclick = guard(async () => {
    const b = $('#site-sync'); b.disabled = true; b.textContent = 'Actualizando…';
    try { const r = await api('/site/sync','POST',{}); toast(`${r.created} nuevas, ${r.changed} cambiadas, ${r.failed} fallidas`); go('configuracion','sitio'); }
    finally { b.disabled = false; b.textContent = 'Actualizar desde Tikaymi.com'; }
  });
  $('#site-lang').onchange = e => { siteLang = e.target.value; go('configuracion','sitio'); };
  $('#site-kind').onchange = e => { siteKind = e.target.value; go('configuracion','sitio'); };
  $('#site-select-all').onclick = () => document.querySelectorAll('.site-select').forEach(x => { x.checked = true; });
  $('#site-approve-selected').onclick = guard(async () => {
    const urls = [...document.querySelectorAll('.site-select:checked')].map(x => x.dataset.url);
    if (!urls.length) return toast('Selecciona al menos una página');
    const r = await api('/site/approve-batch','PUT',{ urls, approved:true });
    toast(`${r.updated} página${r.updated === 1 ? '' : 's'} aprobada${r.updated === 1 ? '' : 's'}`); go('configuracion','sitio');
  });
  $('#site-approve-tours-blogs').onclick = guard(async () => {
    if (!confirm('¿Aprobar todos los tours y artículos de blog disponibles en español e inglés?')) return;
    const r = await api('/site/approve-batch','PUT',{ kinds:['tour','blog'], languages:['es','en'], approved:true });
    toast(`${r.updated} tours y artículos aprobados`); go('configuracion','sitio');
  });
  document.querySelectorAll('.site-approve').forEach(x => x.onchange = guard(async () => {
    try { await api('/site/approve','PUT',{ url:x.dataset.url, approved:x.checked }); toast('Revisión guardada'); }
    catch (e) { x.checked = !x.checked; throw e; }
  }));
}
async function libraryView() {
  const [info,assets]=await Promise.all([api('/approved-info'),api('/assets')]);
  $('#config-body').innerHTML=`<div class="notice info"><b>Fuente de verdad:</b> el asistente solo puede usar esta información autorizada o páginas aprobadas en Sitio web. Nunca debe inventar precios, servicios o testimonios.</div><div class="grid cols-2"><section><form class="card form" id="info-form"><div class="full"><h3>Información verificada</h3></div><label>Tipo<select name="tipo">${opts(K.INFO_TIPOS)}</select></label><label>Título<input name="titulo" required></label><label class="full">Contenido<textarea name="texto" rows="3" required></textarea></label><label>Fuente<input name="fuente" placeholder="Documento, persona o URL"></label><label class="check"><input type="checkbox" name="autorizado_publicar"> Autorizada para publicar</label><div class="form-actions"><button class="primary">Agregar información</button></div></form>${info.map(i=>`<article class="card"><div class="platform-head"><b>${esc(i.titulo)}</b><span class="badge">${esc(label(i.tipo))}</span></div><p>${esc(i.texto)}</p><label class="check"><input class="info-auth" data-id="${i.id}" type="checkbox"${i.autorizado_publicar?' checked':''}> Autorizada para publicar</label><button class="tertiary small-btn delete-info" data-id="${i.id}">Eliminar</button></article>`).join('')}</section><section><form class="card form" id="asset-form"><div class="full"><h3>Fotos y videos reales</h3><p class="muted">Opcional: puedes pegar fotos de res.cloudinary.com/tikaymi directamente en la imagen única o el carrusel; al guardarlas aparecen aquí como autorizadas. Desmarca la autorización para impedir que una foto vuelva a usarse.</p></div><label>Tipo<select name="tipo">${opts(K.ASSET_TIPOS)}</select></label><label>URL<input name="url" type="url" required></label><label>Descripción<input name="descripcion"></label><label>Destino o uso<input name="destino" placeholder="Machu Picchu, reels…"></label><div class="form-actions"><button class="primary">Agregar recurso</button></div></form>${assets.map(a=>`<article class="card"><div class="platform-head"><b>${esc(a.descripcion||a.tipo)}</b><span class="badge">${esc(label(a.tipo))}</span></div><p class="muted small" style="word-break:break-all">${esc(a.url)}</p><button class="tertiary small-btn delete-asset" data-id="${a.id}">Eliminar</button></article>`).join('')}</section></div>`;
  $('#info-form').onsubmit=guard(async e=>{e.preventDefault();const d=formData(e.target);d.autorizado_publicar=e.target.autorizado_publicar.checked;await api('/approved-info','POST',d);toast('Información agregada');go('configuracion','biblioteca');});
  $('#asset-form').onsubmit=guard(async e=>{e.preventDefault();const data=formData(e.target);data.autorizado_publicar=e.target.autorizado_publicar.checked;await api('/assets','POST',data);toast('Recurso agregado');go('configuracion','biblioteca');});
  const assetApproval=document.createElement('label');assetApproval.className='check full';assetApproval.innerHTML='<input type="checkbox" name="autorizado_publicar"> Fotografía/video autorizado para publicación';$('#asset-form').appendChild(assetApproval);
  document.querySelectorAll('.delete-asset').forEach(button=>{
    const asset=assets.find(x=>String(x.id)===button.dataset.id);
    const label=document.createElement('label');label.className='check';
    const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=!!asset.autorizado_publicar;
    checkbox.onchange=guard(async()=>{await api('/assets/'+asset.id+'/approve','PUT',{autorizado_publicar:checkbox.checked});toast('Autorización actualizada');});
    label.append(checkbox,document.createTextNode(' Autorizado para publicación'));button.parentNode.insertBefore(label,button);
  });
  document.querySelectorAll('.info-auth').forEach(x=>x.onchange=guard(async()=>{await api('/approved-info/'+x.dataset.id,'PUT',{autorizado_publicar:x.checked});toast('Autorización actualizada');}));
  document.querySelectorAll('.delete-info').forEach(b=>b.onclick=guard(async()=>{if(confirm('¿Eliminar esta información?')){await api('/approved-info/'+b.dataset.id,'DELETE');go('configuracion','biblioteca');}}));
  document.querySelectorAll('.delete-asset').forEach(b=>b.onclick=guard(async()=>{if(confirm('¿Eliminar este recurso?')){await api('/assets/'+b.dataset.id,'DELETE');go('configuracion','biblioteca');}}));
}
async function aiView() {
  const st=await api('/llm');
  $('#config-body').innerHTML=`<div class="notice info">Las claves se guardan únicamente en el archivo <code>.env</code>. Esta pantalla solo elige el proveedor y el modelo.</div><div class="grid cols-3">${st.proveedores.map(p=>`<form class="card" data-provider="${p.id}"><div class="platform-head"><h3>${esc(p.label)}</h3>${p.id===st.activo.provider?'<span class="badge success">Activo</span>':''}</div><p class="${p.configurado?'':'muted'}">${p.configurado?'✓ Clave configurada':'Falta '+esc(p.clave_env)}</p><label>Modelo<input name="model" value="${esc(p.modelo)}"></label><button class="${p.id===st.activo.provider?'secondary':'primary'}" style="margin-top:14px">${p.id===st.activo.provider?'Guardar modelo':'Usar proveedor'}</button></form>`).join('')}</div>`;
  document.querySelectorAll('[data-provider]').forEach(f=>f.onsubmit=guard(async e=>{e.preventDefault();await api('/llm','PUT',{provider:f.dataset.provider,model:new FormData(f).get('model')});toast('Asistente actualizado');go('configuracion','ia');}));
}
async function strategyView() {
  const s = await api('/editorial-strategy');
  const fields = [
    ['priority_product','Producto prioritario'],
    ['priority_tour_url','Página del producto en Tikaymi.com'],
    ['primary_audience','Audiencia principal (inglés)'],
    ['secondary_audience','Audiencia secundaria (español)'],
    ['contact_name','Persona de contacto'],
  ];
  $('#config-body').innerHTML = `<div class="notice info">Estas son prioridades comerciales declaradas por Tikaymi, no conclusiones de las estadísticas. Se combinan con la copia local del sitio y las señales medidas al crear un plan nuevo; los planes ya guardados no cambian.</div><form class="card form" id="strategy-form"><div class="full"><h3>Estrategia editorial</h3><p class="muted">Deicy representa la atención personal de la agencia boutique. Las piezas deben ayudar a decidir y planificar, no repetir fichas enciclopédicas.</p></div>${fields.map(([key,title]) => `<label class="full">${title}<input name="${key}" value="${esc(s[key])}" required></label>`).join('')}<label class="full">WhatsApp de contacto (opcional)<input name="whatsapp_number" value="${esc(s.whatsapp_number || '')}" inputmode="tel" placeholder="+51 984 000 000"><span class="muted small">Con código de país. Los copies nuevos cerrarán con este número y su enlace wa.me; sin él, el copy no muestra ningún número.</span></label><div class="form-actions"><button class="primary">Guardar estrategia</button></div></form><section class="card"><h3>Reglas de la voz Tikaymi</h3>${Object.values(s.rules).map(rule => `<p>${esc(rule)}</p>`).join('')}</section>`;
  $('#strategy-form').onsubmit = guard(async e => { e.preventDefault(); await api('/editorial-strategy','PUT',formData(e.target)); toast('Estrategia editorial guardada'); go('configuracion','estrategia'); });
}
async function configuracion(sub = 'objetivo') {
  sub=sub||'objetivo';
  $('#view').innerHTML=pageHead('Preparación del sistema','Configuración','Administra el objetivo, las fuentes de datos y la información que puede usar el asistente.')+subnav({objetivo:'Objetivo del período',estrategia:'Estrategia editorial',datos:'Fuentes de datos',sitio:'Sitio web',biblioteca:'Biblioteca aprobada',ia:'Asistente de IA'},sub)+'<div id="config-body"></div>';
  if(sub==='estrategia') await strategyView(); else if(sub==='datos') dataView(); else if(sub==='sitio') await siteView(); else if(sub==='biblioteca') await libraryView(); else if(sub==='ia') await aiView(); else await objectiveView();
}

const VIEWS={inicio,rendimiento,contenido,consultas,configuracion};
api('/constants').then(start).catch(showLogin);
