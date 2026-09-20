const { analyze } = require('./analysis');

// Layouts válidos del constructor existente ("Tikaymi - Constructor de Carruseles.html", LAYOUTS)
const LAYOUTS = {
  producto: ['portada', 'portada-foto', 'portada-editorial', 'ficha', 'itinerario', 'foto-sangre', 'split', 'foto-arriba', 'foto-abajo', 'galeria', 'cita', 'antes-despues', 'incluido', 'bueno-saberlo', 'cierre'],
  informativo: ['portada', 'portada-foto', 'portada-editorial', 'cifras', 'pasos', 'columnas', 'foto-overlay', 'qa-panel', 'cierre'],
};

// Devuelve el JSON que el constructor carga con "Cargar JSON" (app/version/tipo/slides[{layout,data}]).
// El constructor completa los campos faltantes con sus valores por defecto, por eso solo se valida tipo y layout.
function carouselExport({ tipo, slides }) {
  const bad = (m) => Object.assign(new Error(m), { status: 400 });
  if (!LAYOUTS[tipo]) throw bad(`tipo inválido: ${tipo}`);
  if (!Array.isArray(slides) || !slides.length) throw bad('slides vacío');
  if (slides.length > 7) throw bad('máximo razonable 3-5 diapositivas (tope 7)');
  slides.forEach((s, i) => { if (!LAYOUTS[tipo].includes(s?.layout)) throw bad(`diapositiva ${i + 1}: layout inválido "${s?.layout}"`); });
  return { app: 'tikaymi-constructor-carruseles', version: 1, tipo, exportadoEn: new Date().toISOString(), slides: slides.map(s => ({ layout: s.layout, data: s.data || {} })) };
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

module.exports = { carouselExport, reportMarkdown, LAYOUTS };
