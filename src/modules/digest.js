// Recomendaciones periódicas (Inicial.MD §6, §7, §14 Fase 3).
// Combina analyze() + alerts() + cohorts() en un resumen Markdown.
//
// NO incluye planificador: esta función es pura y se invoca bajo demanda
// (GET /api/digest.md). Para recibirlo cada lunes basta un cron del sistema, por ejemplo:
//   0 8 * * 1 curl -s -b "$TIKAYMI_COOKIE" http://localhost:3000/api/digest.md > ~/tikaymi-semana.md
// o desde Node: require('./src/modules/digest').weeklyDigest(open())
//
// Reglas: cada afirmación lleva su nivel de confianza; con datos insuficientes se listan
// hipótesis a probar, nunca conclusiones. Los me gusta no aparecen en ningún ranking.

const { analyze } = require('./analysis');
const { alerts } = require('./alerts');
const { cohorts } = require('./cohorts');

const ETIQUETA = {
  datos_insuficientes: 'datos insuficientes',
  senal_inicial: 'señal inicial',
  patron_probable: 'patrón probable',
  patron_confirmado: 'patrón confirmado',
};

const fmt = v => (v == null ? '—' : typeof v === 'number' ? +v.toFixed(2) : v);
const nivel = c => ETIQUETA[c] || c || 'sin calificar';

function weeklyDigest(db, { periodo, ahora = new Date() } = {}) {
  const a = analyze(db, { periodo });
  const al = alerts(db);
  const co = cohorts(db);
  const r = a.resumen;

  const L = [];
  L.push(`# Resumen periódico Tikaymi — ${r.periodo}`, '');
  L.push(`Generado: ${ahora.toISOString().slice(0, 16).replace('T', ' ')} UTC`, '');
  L.push(`**Confianza global: ${nivel(a.confianza)}** (${a.confianza})`, '');
  if (a.confianza === 'datos_insuficientes') {
    L.push('> Con estos datos no se emiten conclusiones: todo lo que sigue son observaciones e hipótesis a probar.', '');
  }

  L.push('## 1. Negocio', '',
    `- Publicaciones analizadas: ${r.publicaciones} en ${r.dias_periodo} días`,
    `- Consultas: ${r.consultas} · Cotizaciones: ${r.cotizaciones} · Reservas: ${r.reservas}`,
    `- Objetivo vigente: ${r.objetivo_actual ? `${r.objetivo_actual.objetivo_negocio} (${r.objetivo_actual.periodo})` : 'sin objetivo definido'}`,
    '');

  L.push('## 2. Conversión atribuida', '');
  if (a.conversion.sin_datos) {
    L.push(`Sin datos: ${a.conversion.motivo}.`, '');
  } else {
    L.push(`- Leads atribuidos: ${a.conversion.leads_atribuidos}`,
      `- Publicación → consulta: ${fmt(a.conversion.post_a_consulta)} · consulta → cotización: ${fmt(a.conversion.consulta_a_cotizacion)} · cotización → reserva: ${fmt(a.conversion.cotizacion_a_reserva)}`,
      `- Confianza: ${nivel(a.conversion.confianza)}`, '');
  }

  L.push('## 3. Mejores publicaciones (sin me gusta)', '');
  for (const [k, v] of Object.entries(a.mejores)) {
    L.push(v.sin_datos
      ? `- **${k}**: sin datos — ${v.motivo}`
      : `- **${k}**: "${v.titulo}" (${v.plataforma}) = ${fmt(v.valor)} sobre ${v.base_comparada} publicaciones con dato · confianza ${nivel(v.confianza)}`);
  }
  L.push('');

  L.push('## 4. Cohortes de leads por semana', '');
  const semanas = Object.entries(co).sort((x, y) => (x[0] < y[0] ? 1 : -1)).slice(0, 6);
  if (!semanas.length) L.push('Sin leads registrados.', '');
  else {
    L.push('| Semana | Leads | Tasa a cotizado/reservado | Datos |', '|---|---|---|---|');
    for (const [s, v] of semanas) {
      L.push(`| ${s} | ${v.total} | ${v.tasa_a_cotizado_reservado === null ? '—' : fmt(v.tasa_a_cotizado_reservado)} | ${v.datos_suficientes ? 'suficientes' : 'insuficientes (n<5)'} |`);
    }
    L.push('');
  }

  L.push('## 5. Alertas abiertas', '');
  if (!al.length) L.push('Ninguna alerta activa.', '');
  else {
    for (const x of al) L.push(`- [${x.tipo}] ${x.mensaje}`);
    L.push('');
  }

  L.push('## 6. Recomendaciones calificadas por confianza', '');
  const porNivel = { patron_confirmado: [], patron_probable: [], senal_inicial: [], datos_insuficientes: [] };
  for (const x of a.recomendaciones) (porNivel[x.confianza] ||= []).push(x);
  let hubo = false;
  for (const [c, items] of Object.entries(porNivel)) {
    if (!items.length) continue;
    hubo = true;
    L.push(`### ${nivel(c)}${c === 'datos_insuficientes' ? ' — sólo hipótesis a probar' : ''}`, '');
    for (const x of items) {
      L.push(`- **[${x.tipo}]** ${x.formato_y_por_que}`,
        `  - Objetivo: ${x.objetivo} · CTA: ${x.cta}`,
        `  - Éxito se mide con: ${x.metrica_exito}`,
        `  - Origen del dato: ${x.dato_origen}`,
        `  - Limitaciones: ${x.limitaciones}`);
    }
    L.push('');
  }
  if (!hubo) L.push('Sin recomendaciones: datos insuficientes.', '');

  L.push('## 7. Pendientes de registro', '');
  L.push(a.pendientes_clasificacion.length
    ? `- ${a.pendientes_clasificacion.length} publicaciones sin tema clasificado (no entran en el análisis por tema).`
    : '- Ninguna publicación sin clasificar.');
  L.push('');

  L.push('---', '',
    'Notas fijas: las métricas de atención no se suman entre plataformas distintas; los datos ausentes se ignoran (NULL no es 0); ninguna publicación se considera exitosa por me gusta.',
    '',
    'Este resumen se genera bajo demanda. Para recibirlo cada semana, programar `GET /api/digest.md` en un cron externo.',
    '');

  return L.join('\n');
}

module.exports = { weeklyDigest };
