const { analyze } = require('./analysis');

// Layouts válidos del constructor existente ("Tikaymi - Constructor de Carruseles.html", LAYOUTS)
const LAYOUTS = {
  producto: ['portada', 'portada-foto', 'portada-editorial', 'ficha', 'itinerario', 'foto-sangre', 'split', 'foto-arriba', 'foto-abajo', 'galeria', 'cita', 'antes-despues', 'incluido', 'bueno-saberlo', 'cierre'],
  informativo: ['portada', 'portada-foto', 'portada-editorial', 'cifras', 'pasos', 'columnas', 'foto-overlay', 'qa-panel', 'cierre'],
};

// Alias inequívocos que algunos modelos producen al separar identificadores.
const LAYOUT_ALIASES = {
  'bueno-saber-lo': 'bueno-saberlo',
  'bueno_saberlo': 'bueno-saberlo',
  'bueno-saber': 'bueno-saberlo',
};
const DEFAULT_EYEBROWS = {
  es: { portada:'Cusco · Perú', 'portada-foto':'Cusco · Perú', 'portada-editorial':'Cusco · Perú', ficha:'El paquete', itinerario:'Itinerario', 'foto-sangre':'Tema del viaje', 'foto-overlay':'Tema del viaje', split:'Tema del viaje', 'foto-arriba':'Tema del viaje', 'foto-abajo':'Tema del viaje', galeria:'Galería', 'antes-despues':'Antes / después', incluido:'Incluido', 'bueno-saberlo':'Bueno saberlo', cierre:'Cusco · Perú', cifras:'Las cifras', pasos:'Paso a paso', columnas:'Bueno saberlo', 'qa-panel':'Preguntas frecuentes' },
  en: { portada:'Cusco · Peru', 'portada-foto':'Cusco · Peru', 'portada-editorial':'Cusco · Peru', ficha:'The package', itinerario:'Itinerary', 'foto-sangre':'Trip focus', 'foto-overlay':'Trip focus', split:'Trip focus', 'foto-arriba':'Trip focus', 'foto-abajo':'Trip focus', galeria:'Gallery', 'antes-despues':'Before / after', incluido:'Included', 'bueno-saberlo':'Good to know', cierre:'Cusco · Peru', cifras:'The numbers', pasos:'Step by step', columnas:'Good to know', 'qa-panel':'Frequently asked questions' },
};

function normalizeSlideData(layout, data = {}, idioma = 'es') {
  const d = { ...data };
  const labels = DEFAULT_EYEBROWS[idioma] || DEFAULT_EYEBROWS.es;
  if (labels[layout] && (!String(d.eyebrow || '').trim() || String(d.eyebrow).trim().toLowerCase() === 'etiqueta')) d.eyebrow = labels[layout];
  const title = d.titulo;
  const text = d.texto;
  if (title) {
    if (['portada','portada-foto','portada-editorial'].includes(layout) && !d.h1) d.h1 = title;
    else if (!d.h2 && !['cita','galeria','cifras','pasos','qa-panel'].includes(layout)) d.h2 = title;
    else if (['cifras','pasos'].includes(layout) && !d.h2) d.h2 = title;
  }
  if (text && !d.body && !['itinerario','bueno-saberlo','cita','cifras','pasos','qa-panel'].includes(layout)) d.body = text;
  if (layout === 'itinerario' && text && !Array.isArray(d.route)) d.route = [{ d:'Itinerario', t:text }];
  if (layout === 'bueno-saberlo' && text && !Array.isArray(d.notes)) d.notes = [{ title:'Nota', text }];
  if (layout === 'cita' && text && !d.quote) d.quote = text;
  if (layout === 'pasos' && text && !Array.isArray(d.steps)) d.steps = [{ title:'Paso', text }];
  if (layout === 'qa-panel' && text && !Array.isArray(d.qas)) d.qas = [{ q:'Pregunta', a:text }];
  delete d.titulo;
  delete d.texto;
  return d;
}

// Devuelve el JSON que el constructor carga con "Cargar JSON" (app/version/tipo/slides[{layout,data}]).
// El constructor completa los campos faltantes con sus valores por defecto, por eso solo se valida tipo y layout.
function carouselExport({ tipo, slides }, idioma = 'es') {
  const bad = (m) => Object.assign(new Error(m), { status: 400 });
  if (!LAYOUTS[tipo]) throw bad(`tipo inválido: ${tipo}`);
  if (!Array.isArray(slides) || !slides.length) throw bad('slides vacío');
  if (slides.length > 7) throw bad('máximo razonable 3-5 diapositivas (tope 7)');
  slides.forEach((s, i) => {
    const normalized = LAYOUT_ALIASES[s?.layout] || s?.layout;
    if (!LAYOUTS[tipo].includes(normalized)) throw bad(`diapositiva ${i + 1}: layout inválido "${s?.layout}"`);
  });
  return { app: 'tikaymi-constructor-carruseles', version: 1, tipo, exportadoEn: new Date().toISOString(), slides: slides.map(s => {
    const layout = LAYOUT_ALIASES[s.layout] || s.layout;
    return { layout, data: normalizeSlideData(layout, s.data || {}, idioma) };
  }) };
}

const fmt = v => (v == null ? '—' : typeof v === 'number' ? +v.toFixed(2) : v);

function reportMarkdown(db, opts) {
  const a = analyze(db, opts);
  const L = [`# Informe Tikaymi (${a.resumen.periodo})`, '', `Confianza global: **${a.resumen.confianza}**`, ''];
  const r = a.resumen;
  L.push('## Negocio', `- Publicaciones: ${r.publicaciones}`, `- Consultas: ${r.consultas} · Cotizaciones: ${r.cotizaciones} · Reservas: ${r.reservas}`, '');
  L.push('## Conversión', a.conversion.sin_datos ? `Sin datos: ${a.conversion.motivo}` : '```json\n' + JSON.stringify(a.conversion, null, 2) + '\n```', '');
  for (const k of ['por_plataforma', 'por_formato', 'por_idioma', 'por_tema', 'por_cta']) {
    const rows = Object.entries(a[k] || {});
    if (!rows.length) continue;
    L.push(`## ${k.replace('por_', 'Por ')}`, '| Grupo | n | Leads | Cotiz. | Reservas | Confianza |', '|---|---|---|---|---|---|');
    for (const [g, v] of rows) L.push(`| ${g} | ${v.n} | ${fmt(v.negocio?.leads)} | ${fmt(v.negocio?.cotizaciones)} | ${fmt(v.negocio?.reservas)} | ${v.confianza ?? '—'} |`);
    L.push('');
  }
  L.push('## Recomendaciones');
  if (!a.recomendaciones.length) L.push('Sin recomendaciones: datos insuficientes.');
  for (const x of a.recomendaciones) L.push(`- **[${x.tipo}/${x.confianza}]** ${x.formato_y_por_que} — CTA: ${x.cta}; éxito: ${x.metrica_exito}. Origen: ${x.dato_origen}. Limitaciones: ${x.limitaciones}`);
  return L.join('\n') + '\n';
}

module.exports = { carouselExport, reportMarkdown, LAYOUTS, LAYOUT_ALIASES, normalizeSlideData };
