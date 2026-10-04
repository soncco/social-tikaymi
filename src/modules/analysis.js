// Módulo de análisis (Inicial.MD §1, §5, §6, §7, §12).
// Reglas duras:
//  - NUNCA se suman métricas entre plataformas distintas (cada plataforma define alcance/retención a su manera).
//  - NULL no es 0: los datos ausentes se ignoran y se reporta la cobertura.
//  - Sin datos de conversión se declara `sin_datos: true`; no se inventan atribuciones.
//  - Ningún contenido se declara exitoso por likes (los likes no participan de ningún ranking).
//  - Cada dato/claim lleva `tipo`: observado | interpretacion | recomendacion | hipotesis.

const POSTS_ANALIZABLES = ['publicado', 'analizado'];
const SIN_CLASIFICAR = ['sin_clasificar', '', null, undefined];

// §5: los estados de lead derivan consulta / cotización / reserva (no se duplican datos).
const ES_CONSULTA = ['calificado', 'cotizado', 'reservado'];
const ES_COTIZACION = ['cotizado', 'reservado'];
const ES_RESERVA = ['reservado'];

const ATENCION = [['reach', 'reach', 'suma'], ['plays', 'plays', 'suma'], ['retention', 'retention', 'media'], ['completed', 'completed_plays', 'suma']];
const INTENCION = [['saves', 'saves', 'suma'], ['shares', 'shares', 'suma'], ['profile_visits', 'profile_visits', 'suma'], ['clicks', 'clicks', 'suma'], ['conversations', 'conversations', 'suma']];

const MEZCLA = Object.freeze({
  valor: null, sin_datos: true, tipo: 'observado',
  motivo: 'no se suman métricas entre plataformas distintas; ver por_plataforma',
});

const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const num = v => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const sinClasificar = v => SIN_CLASIFICAR.includes(v === null || v === undefined ? v : String(v).trim().toLowerCase());

// Una métrica agregada: ignora nulls y reporta cuántas publicaciones aportaron dato.
function metrica(rows, col, modo) {
  const vals = rows.map(r => num(r[col])).filter(v => v !== null);
  const base = { n_total: rows.length, n_datos: vals.length, cobertura: rows.length ? round(vals.length / rows.length) : 0, tipo: 'observado' };
  if (!vals.length) return { ...base, valor: null, sin_datos: true };
  const suma = vals.reduce((a, b) => a + b, 0);
  return { ...base, valor: round(modo === 'media' ? suma / vals.length : suma, 4) };
}

const familia = (rows, defs) => Object.fromEntries(defs.map(([out, col, modo]) => [out, metrica(rows, col, modo)]));

function negocio(rows) {
  const estados = rows.flatMap(r => r.leads.map(l => l.estado));
  return {
    leads: estados.length,
    consultas: estados.filter(e => ES_CONSULTA.includes(e)).length,
    cotizaciones: estados.filter(e => ES_COTIZACION.includes(e)).length,
    reservas: estados.filter(e => ES_RESERVA.includes(e)).length,
    tipo: 'observado',
  };
}

// §6: el nivel de confianza depende del volumen, del período y de si hay leads atribuidos.
function confianza(nPosts, dias, leadsAtribuidos) {
  if (nPosts < 5 || dias < 14) return 'datos_insuficientes';
  if (nPosts < 10) return 'senal_inicial';
  if (nPosts < 20) return 'patron_probable';
  // Un único lead no confirma un patrón comercial: exigimos una señal mínima
  // reproducible y dejamos el resto como patrón probable.
  return leadsAtribuidos >= 3 ? 'patron_confirmado' : 'patron_probable';
}

function grupo(rows, dias) {
  const plataformas = [...new Set(rows.map(r => r.plataforma))].sort();
  const neg = negocio(rows);
  const mezclado = plataformas.length > 1;
  return {
    n: rows.length,
    plataformas,
    atencion: mezclado ? { ...MEZCLA } : familia(rows, ATENCION),
    intencion: mezclado ? { ...MEZCLA } : familia(rows, INTENCION),
    negocio: neg,
    por_plataforma: Object.fromEntries(plataformas.map(p => {
      const rs = rows.filter(r => r.plataforma === p);
      return [p, { n: rs.length, atencion: familia(rs, ATENCION), intencion: familia(rs, INTENCION), negocio: negocio(rs) }];
    })),
    confianza: confianza(rows.length, dias, neg.leads),
    tipo: 'observado',
  };
}

function agrupar(rows, campo, dias, excluirSinClasificar = false) {
  const out = {};
  for (const r of rows) {
    const k = sinClasificar(r[campo]) ? 'sin_clasificar' : String(r[campo]);
    if (excluirSinClasificar && k === 'sin_clasificar') continue;
    (out[k] ||= []).push(r);
  }
  return Object.fromEntries(Object.entries(out).map(([k, rs]) => [k, grupo(rs, dias)]));
}

function mejorPor(rows, score, extra) {
  const cands = rows.map(r => ({ r, v: score(r) })).filter(x => x.v !== null);
  if (!cands.length) return { sin_datos: true, motivo: 'ninguna publicación tiene ese dato disponible', tipo: 'observado' };
  const best = cands.sort((a, b) => b.v - a.v)[0];
  return { post_id: best.r.id, titulo: best.r.titulo, plataforma: best.r.plataforma, formato: best.r.formato ?? null, idioma: best.r.idioma, valor: round(best.v, 4), base_comparada: cands.length, tipo: 'observado', ...(extra ? extra(best.r) : {}) };
}

// §10: la recomendación de idioma sale de resultados, nunca de una preferencia fija.
function recomendacionIdioma(rows, dias) {
  const idiomas = ['es', 'en'].map(id => {
    const rs = rows.filter(r => r.idioma === id);
    return { idioma: id, n: rs.length, leads: negocio(rs).consultas };
  });
  const conDatos = idiomas.filter(i => i.n >= 3);
  const nivel = confianza(rows.length, dias, idiomas.reduce((a, i) => a + i.leads, 0));
  const base = { dato_origen: idiomas.map(i => `${i.idioma}: ${i.n} publicaciones, ${i.leads} consultas`).join(' · '), confianza: nivel };
  if (nivel === 'datos_insuficientes' || conDatos.length < 2) {
    return { ...base, recomendacion: 'datos_insuficientes', tipo: 'hipotesis', nota: 'se requieren al menos 3 publicaciones por idioma y un período de 14 días' };
  }
  const [a, b] = conDatos.map(i => ({ ...i, ratio: i.leads / i.n })).sort((x, y) => y.ratio - x.ratio);
  if (a.ratio === 0) return { ...base, recomendacion: 'probar_ambos', tipo: 'hipotesis', nota: 'ningún idioma generó consultas todavía' };
  if (b.ratio > 0 && a.ratio / b.ratio < 1.5) return { ...base, recomendacion: 'dos_versiones', tipo: 'recomendacion' };
  return { ...base, recomendacion: a.idioma, tipo: 'recomendacion' };
}

// §7: cada recomendación explica dato, objetivo, formato, CTA, métrica de éxito y limitaciones.
// Con datos insuficientes sólo se emiten hipótesis a probar.
function rec(nivel, o) {
  return { ...o, confianza: nivel, tipo: nivel === 'datos_insuficientes' ? 'hipotesis' : (o.tipo || 'recomendacion') };
}

function recomendaciones({ rows, dias, nivel, mejores, idioma, pendientes, conversion, objetivo }) {
  const out = [];
  const meta = objetivo?.objetivo_negocio || 'consulta_calificada';

  if (mejores.retencion.post_id) {
    out.push(rec(nivel, {
      dato_origen: `mejor retención observada: "${mejores.retencion.titulo}" (${mejores.retencion.valor}) en ${mejores.retencion.plataforma}, sobre ${mejores.retencion.base_comparada} publicaciones con dato`,
      objetivo: meta,
      formato_y_por_que: `repetir el formato "${mejores.retencion.formato ?? 'sin registrar'}" de esa pieza en ${mejores.retencion.plataforma}: retuvo audiencia hasta el final, no sólo atrajo likes`,
      cta: 'CTA de conversación directa (palabra clave de WhatsApp con destino y fecha de viaje)',
      metrica_exito: 'retención media y conversaciones iniciadas, no me gusta',
      limitaciones: 'la retención no es comparable entre plataformas; medir sólo contra la misma plataforma',
    }));
  } else {
    out.push(rec('datos_insuficientes', { dato_origen: 'ninguna publicación registra retención', objetivo: meta, formato_y_por_que: 'hipótesis: importar retención antes de decidir formato', cta: 'sin definir', metrica_exito: 'cobertura del dato de retención', limitaciones: 'sin el dato no se puede comparar formatos' }));
  }

  if (mejores.guardados_compartidos.post_id) {
    out.push(rec(nivel, {
      dato_origen: `más guardados+compartidos: "${mejores.guardados_compartidos.titulo}" (${mejores.guardados_compartidos.valor}) en ${mejores.guardados_compartidos.plataforma}`,
      objetivo: 'seguimiento',
      formato_y_por_que: 'contenido de referencia (guía o checklist) para quien planifica: guardar y compartir indican intención, no simple simpatía',
      cta: 'invitar a escribir por WhatsApp con la palabra clave del destino',
      metrica_exito: 'guardados y compartidos por publicación + consultas atribuidas',
      limitaciones: 'guardados y compartidos no garantizan consulta; verificar atribución',
    }));
  }

  if (conversion.sin_datos) {
    out.push(rec('datos_insuficientes', {
      dato_origen: 'no hay leads atribuidos a publicaciones',
      objetivo: meta,
      formato_y_por_que: 'hipótesis a probar: publicar con código de campaña propio por pieza para poder atribuir',
      cta: 'palabra clave única por publicación (ej. HUMANTAY + fecha + viajeros)',
      metrica_exito: 'porcentaje de leads con campaign_code reconocido',
      limitaciones: 'sin atribución no se puede afirmar qué contenido produce reservas',
    }));
  } else if (mejores.conversion.post_id) {
    out.push(rec(nivel, {
      dato_origen: `publicación con más consultas atribuidas: "${mejores.conversion.titulo}" (${mejores.conversion.valor})`,
      objetivo: meta,
      formato_y_por_que: `replicar el ángulo de esa pieza en ${mejores.conversion.plataforma}: es la única evidencia de contenido que produjo contacto real`,
      cta: mejores.conversion.cta || 'CTA a WhatsApp con código de campaña',
      metrica_exito: 'consultas calificadas y cotizaciones atribuidas',
      limitaciones: 'la atribución depende del registro manual del origen del lead',
    }));
  }

  out.push(rec(idioma.confianza, {
    dato_origen: idioma.dato_origen,
    objetivo: meta,
    formato_y_por_que: `idioma sugerido: ${idioma.recomendacion} (una sola lengua por pieza; nunca mezclar ambos en la misma imagen)`,
    cta: 'CTA en el mismo idioma de la pieza',
    metrica_exito: 'consultas por publicación en cada idioma',
    limitaciones: 'requiere al menos 3 publicaciones por idioma en el período',
    tipo: idioma.tipo,
  }));

  if (pendientes.length) {
    out.push({
      dato_origen: `${pendientes.length} publicaciones sin tema clasificado`,
      objetivo: 'calidad de datos',
      formato_y_por_que: 'clasificar el tema de esas publicaciones: sin tema no entran al análisis por tema ni por objetivo',
      cta: 'no aplica',
      metrica_exito: 'publicaciones sin clasificar = 0',
      limitaciones: 'no es una conclusión de rendimiento, es una tarea de registro',
      confianza: nivel,
      tipo: 'recomendacion',
    });
  }

  if (rows.length && dias >= 14 && nivel !== 'datos_insuficientes') {
    out.push({
      dato_origen: `${rows.length} publicaciones analizadas en ${dias} días`,
      objetivo: meta,
      formato_y_por_que: 'mantener volumen y variar estructura narrativa para aislar el efecto del formato',
      cta: 'constante durante el período de prueba',
      metrica_exito: 'consultas atribuidas por publicación',
      limitaciones: 'estacionalidad, inversión publicitaria y cambios de CTA no están controlados en este cálculo',
      confianza: nivel,
      tipo: 'interpretacion',
    });
  }
  return out;
}

function analyze(db, filters = {}) {
  const { periodo, plataforma, objetivo: objetivoFiltro, formato, idioma: idiomaFiltro, tema, fecha_desde, fecha_hasta } = filters;
  const marca = POSTS_ANALIZABLES.map(() => '?').join(',');
  const params = [...POSTS_ANALIZABLES];
  let where = `p.estado IN (${marca})`;
  if (periodo) { where += ' AND p.fecha LIKE ?'; params.push(periodo + '%'); }
  if (plataforma) { where += ' AND p.plataforma = ?'; params.push(plataforma); }
  if (objetivoFiltro) { where += ' AND p.objetivo_negocio = ?'; params.push(objetivoFiltro); }
  if (formato) { where += ' AND p.formato = ?'; params.push(formato); }
  if (idiomaFiltro) { where += ' AND p.idioma = ?'; params.push(idiomaFiltro); }
  if (tema) { where += ' AND p.tema = ?'; params.push(tema); }
  if (fecha_desde) { where += ' AND p.fecha >= ?'; params.push(fecha_desde); }
  if (fecha_hasta) { where += ' AND p.fecha <= ?'; params.push(fecha_hasta); }
  const rows = db.prepare(`SELECT p.*, m.reach, m.impressions, m.plays, m.retention, m.completed_plays, m.likes, m.comments, m.shares, m.saves, m.profile_visits, m.clicks, m.conversations
    FROM posts p LEFT JOIN metrics m ON m.post_id = p.id WHERE ${where} ORDER BY p.fecha, p.id`).all(params);

  const ids = new Set(rows.map(r => r.id));
  const todosLeads = db.prepare('SELECT * FROM leads').all();
  const atribuidos = todosLeads.filter(l => l.post_id != null && ids.has(l.post_id));
  const enPeriodo = periodo
    ? todosLeads.filter(l => String(l.created_at || '').startsWith(periodo) || (l.post_id != null && ids.has(l.post_id)))
    : todosLeads;
  for (const r of rows) r.leads = atribuidos.filter(l => l.post_id === r.id);

  const fechas = rows.map(r => r.fecha).filter(Boolean).sort();
  const dias = fechas.length ? Math.round((Date.parse(fechas.at(-1)) - Date.parse(fechas[0])) / 86400000) + 1 : 0;
  const nivel = confianza(rows.length, dias, atribuidos.length);

  const cuenta = (ls, estados) => ls.filter(l => estados.includes(l.estado)).length;
  const objetivo = (periodo && db.prepare('SELECT * FROM objectives WHERE periodo=? ORDER BY id DESC').get(periodo))
    || db.prepare('SELECT * FROM objectives ORDER BY id DESC').get() || null;

  const resumen = {
    periodo: periodo ?? 'todo',
    dias_periodo: dias,
    publicaciones: rows.length,
    consultas: cuenta(enPeriodo, ES_CONSULTA),
    cotizaciones: cuenta(enPeriodo, ES_COTIZACION),
    reservas: cuenta(enPeriodo, ES_RESERVA),
    objetivo_actual: objetivo,
    confianza: nivel,
    tipo: 'observado',
  };

  // §5: conversión publicación -> consulta -> cotización -> reserva, sólo con leads atribuidos.
  const cons = cuenta(atribuidos, ES_CONSULTA);
  const cot = cuenta(atribuidos, ES_COTIZACION);
  const res = cuenta(atribuidos, ES_RESERVA);
  const tasa = (a, b) => (b > 0 ? round(a / b, 4) : null);
  const conversion = atribuidos.length === 0
    ? { sin_datos: true, motivo: 'no hay leads atribuidos a publicaciones en el período; no se inventa atribución', confianza: 'datos_insuficientes', tipo: 'observado' }
    : {
        sin_datos: false,
        publicaciones: rows.length, leads_atribuidos: atribuidos.length,
        consultas: cons, cotizaciones: cot, reservas: res,
        post_a_consulta: tasa(cons, rows.length),
        consulta_a_cotizacion: tasa(cot, cons),
        cotizacion_a_reserva: tasa(res, cot),
        confianza: nivel, tipo: 'observado',
      };

  const plataformasAnalizadas = [...new Set(rows.map(r => r.plataforma))];
  const mejores = {
    // El ranking de "mejor" nunca usa me gusta (§4).
    retencion: plataformasAnalizadas.length > 1 ? { sin_datos:true, motivo:'no se elige un ganador entre plataformas; consulta por_plataforma', tipo:'observado' } : mejorPor(rows, r => num(r.retention)),
    guardados_compartidos: plataformasAnalizadas.length > 1 ? { sin_datos:true, motivo:'no se suman señales de plataformas distintas; consulta por_plataforma', tipo:'observado' } : mejorPor(rows, r => (num(r.saves) === null && num(r.shares) === null ? null : (num(r.saves) ?? 0) + (num(r.shares) ?? 0))),
    conversion: plataformasAnalizadas.length > 1 ? { sin_datos:true, motivo:'no se elige un ganador entre plataformas; consulta por_plataforma', tipo:'observado' } : atribuidos.length
      ? mejorPor(rows, r => (r.leads.length ? cuenta(r.leads, ES_CONSULTA) : null), r => ({ cta: r.cta }))
      : { sin_datos: true, motivo: 'no hay leads atribuidos; no se declara ganador por conversión', tipo: 'observado' },
  };
  const mejoresPorPlataforma = Object.fromEntries(plataformasAnalizadas.map(p => {
    const rs = rows.filter(r => r.plataforma === p);
    return [p, { retencion:mejorPor(rs, r => num(r.retention)), guardados_compartidos:mejorPor(rs, r => (num(r.saves) === null && num(r.shares) === null ? null : (num(r.saves) ?? 0) + (num(r.shares) ?? 0))) }];
  }));
  for (const k of Object.keys(mejores)) if (!mejores[k].sin_datos) mejores[k].confianza = nivel;

  const pendientes = rows.filter(r => sinClasificar(r.tema))
    .map(r => ({ post_id: r.id, titulo: r.titulo, plataforma: r.plataforma, motivo: 'tema sin clasificar', tipo: 'observado' }));

  const idioma = recomendacionIdioma(rows, dias);

  return {
    resumen,
    por_plataforma: agrupar(rows, 'plataforma', dias),
    por_formato: agrupar(rows, 'formato', dias),
    por_idioma: agrupar(rows, 'idioma', dias),
    por_tema: agrupar(rows, 'tema', dias, true),
    por_cta: agrupar(rows, 'cta', dias),
    conversion,
    mejores,
    mejores_por_plataforma: mejoresPorPlataforma,
    idioma,
    pendientes_clasificacion: pendientes,
    confianza: nivel,
    notas: [
      { texto: 'las métricas de atención nunca se suman entre plataformas distintas', tipo: 'observado' },
      { texto: 'los datos ausentes (NULL) se ignoran y se reporta la cobertura; no se cuentan como 0', tipo: 'observado' },
      { texto: 'ninguna publicación se considera exitosa por me gusta', tipo: 'observado' },
    ],
    recomendaciones: recomendaciones({ rows, dias, nivel, mejores, idioma, pendientes, conversion, objetivo }),
  };
}

module.exports = { analyze, confianza };
