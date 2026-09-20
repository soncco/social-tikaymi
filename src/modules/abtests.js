// Pruebas A/B manuales (Inicial.MD §6, §14 Fase 3).
// Reglas duras, iguales a las del módulo de análisis:
//  - NUNCA se decide por me gusta: los likes no entran en ningún cálculo de esta comparación.
//  - Sólo se comparan publicaciones de la MISMA plataforma (alcance/retención no son comparables entre plataformas).
//  - Se compara una sola variable por prueba (idioma | cta | formato | hook).
//  - Si falta dato en cualquiera de los dos lados NO hay ganador: se devuelve 'datos_insuficientes' con motivo.
//  - La conclusión es interpretación, nunca verdad definitiva: con n=2 jamás se declara 'patron_confirmado'.

const VARIABLES = ['idioma', 'cta', 'formato', 'hook'];

// Métricas de intención (§4): indican voluntad, no simpatía. 'likes' queda deliberadamente fuera.
const INTENCION = ['saves', 'shares', 'profile_visits', 'clicks', 'conversations'];

// Estados de lead que representan resultado comercial (§5).
const ES_CONSULTA = ['calificado', 'cotizado', 'reservado'];
const ES_COTIZACION = ['cotizado', 'reservado'];
const ES_RESERVA = ['reservado'];

// Diferencia relativa mínima para hablar de ganador; por debajo se declara empate.
const UMBRAL = 0.2;

const POSTS_MEDIBLES = ['publicado', 'analizado'];

const bad = (m, status = 400) => Object.assign(new Error(m), { status });
const num = v => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const round = (x, d = 4) => (x === null ? null : Math.round(x * 10 ** d) / 10 ** d);

function lado(db, postId, etiqueta) {
  const p = db.prepare(`SELECT p.*, ${INTENCION.map(m => 'm.' + m).join(', ')}
    FROM posts p LEFT JOIN metrics m ON m.post_id = p.id WHERE p.id = ?`).get(postId);
  if (!p) throw bad(`la publicación ${etiqueta} (${postId}) no existe`, 404);

  const valores = INTENCION.map(m => [m, num(p[m])]);
  const conDato = valores.filter(([, v]) => v !== null);
  const leads = db.prepare('SELECT estado FROM leads WHERE post_id = ?').all(postId).map(l => l.estado);

  return {
    post_id: p.id,
    titulo: p.titulo,
    plataforma: p.plataforma,
    estado: p.estado,
    idioma: p.idioma,
    formato: p.formato ?? null,
    cta: p.cta,
    intencion: {
      ...Object.fromEntries(valores),
      total: conDato.length ? round(conDato.reduce((a, [, v]) => a + v, 0)) : null,
      metricas_con_dato: conDato.length,
      cobertura: round(conDato.length / INTENCION.length, 2),
      tipo: 'observado',
    },
    negocio: {
      leads_atribuidos: leads.length,
      consultas: leads.filter(e => ES_CONSULTA.includes(e)).length,
      cotizaciones: leads.filter(e => ES_COTIZACION.includes(e)).length,
      reservas: leads.filter(e => ES_RESERVA.includes(e)).length,
      tipo: 'observado',
    },
    tipo: 'observado',
  };
}

// Un lado aporta datos si está publicado/analizado y tiene al menos una métrica de intención
// o al menos un lead atribuido. Nada de esto se rellena con ceros.
function faltaDato(l, etiqueta) {
  if (!POSTS_MEDIBLES.includes(l.estado)) return `la publicación ${etiqueta} está en estado '${l.estado}' (se requiere publicado o analizado)`;
  if (l.intencion.metricas_con_dato === 0 && l.negocio.leads_atribuidos === 0) {
    return `la publicación ${etiqueta} no tiene métricas de intención importadas ni leads atribuidos`;
  }
  return null;
}

function create(db, body = {}) {
  const { nombre, variable, post_a, post_b } = body;
  if (!String(nombre ?? '').trim()) throw bad('nombre es obligatorio');
  if (!VARIABLES.includes(variable)) throw bad(`variable inválida: ${variable} (use ${VARIABLES.join(' | ')})`);
  if (post_a == null || post_b == null) throw bad('post_a y post_b son obligatorios');
  if (String(post_a) === String(post_b)) throw bad('post_a y post_b deben ser publicaciones distintas');

  const a = db.prepare('SELECT id, plataforma FROM posts WHERE id=?').get(post_a);
  const b = db.prepare('SELECT id, plataforma FROM posts WHERE id=?').get(post_b);
  if (!a || !b) throw bad('post_a y post_b deben existir', 404);
  if (a.plataforma !== b.plataforma) throw bad(`sólo se comparan publicaciones de la misma plataforma: ${a.plataforma} vs ${b.plataforma}`);

  return db.prepare('INSERT INTO ab_tests(nombre,variable,post_a,post_b) VALUES(?,?,?,?)')
    .run(nombre, variable, a.id, b.id).lastInsertRowid;
}

const list = db => db.prepare(`SELECT t.*, pa.titulo AS titulo_a, pb.titulo AS titulo_b, pa.plataforma
  FROM ab_tests t JOIN posts pa ON pa.id=t.post_a JOIN posts pb ON pb.id=t.post_b ORDER BY t.id DESC`).all();

const NOTAS = [
  { texto: 'los me gusta no participan de esta comparación: no miden intención ni resultado comercial', tipo: 'observado' },
  { texto: 'una prueba de dos publicaciones nunca alcanza patrón confirmado; es señal, no prueba definitiva', tipo: 'observado' },
  { texto: 'estacionalidad, inversión publicitaria y hora de publicación no están controladas', tipo: 'observado' },
];

function evaluate(db, id) {
  const t = db.prepare('SELECT * FROM ab_tests WHERE id=?').get(id);
  if (!t) throw bad('la prueba A/B no existe', 404);

  const a = lado(db, t.post_a, 'A');
  const b = lado(db, t.post_b, 'B');
  const base = { id: t.id, nombre: t.nombre, variable: t.variable, creado: t.creado, a, b, notas: NOTAS };

  const cerrar = (out) => {
    db.prepare('UPDATE ab_tests SET conclusion=? WHERE id=?').run(out.conclusion, t.id);
    return out;
  };

  // Regla dura: misma plataforma obligatoria (el post pudo editarse después de crear la prueba).
  if (a.plataforma !== b.plataforma) {
    return cerrar({
      ...base, plataforma: null, resultado: 'datos_insuficientes', ganador: null, post_ganador: null,
      confianza: 'datos_insuficientes', tipo: 'observado',
      motivo: `las publicaciones están en plataformas distintas (${a.plataforma} vs ${b.plataforma}); las métricas no son comparables`,
      conclusion: 'sin conclusión: plataformas distintas',
    });
  }

  const faltas = [faltaDato(a, 'A'), faltaDato(b, 'B')].filter(Boolean);
  if (faltas.length) {
    return cerrar({
      ...base, plataforma: a.plataforma, resultado: 'datos_insuficientes', ganador: null, post_ganador: null,
      confianza: 'datos_insuficientes', tipo: 'observado', motivo: faltas.join('; '),
      conclusion: `sin conclusión: ${faltas.join('; ')}`,
    });
  }

  // Prioridad: resultado comercial por encima de intención (§1, §5).
  const hayNegocio = a.negocio.consultas + b.negocio.consultas > 0;
  const valorA = hayNegocio ? a.negocio.consultas : (a.intencion.total ?? 0);
  const valorB = hayNegocio ? b.negocio.consultas : (b.intencion.total ?? 0);
  const baseDecision = hayNegocio ? 'consultas_atribuidas' : 'intencion_total';
  const mayor = Math.max(valorA, valorB);
  const menor = Math.min(valorA, valorB);
  const diferencia = mayor > 0 ? round((mayor - menor) / mayor) : 0;

  if (mayor === 0 || diferencia < UMBRAL) {
    return cerrar({
      ...base, plataforma: a.plataforma, resultado: 'empate', ganador: null, post_ganador: null,
      base_decision: baseDecision, valor_a: valorA, valor_b: valorB, diferencia_relativa: diferencia,
      confianza: 'datos_insuficientes', tipo: 'interpretacion',
      motivo: mayor === 0
        ? `ninguna de las dos publicaciones registra ${baseDecision.replace('_', ' ')}`
        : `la diferencia (${Math.round(diferencia * 100)}%) es menor al umbral del ${UMBRAL * 100}% exigido para declarar ganador`,
      conclusion: `empate en ${t.variable}: diferencia ${Math.round(diferencia * 100)}% por ${baseDecision}`,
    });
  }

  const ganador = valorA > valorB ? 'a' : 'b';
  const gan = ganador === 'a' ? a : b;
  // Con dos publicaciones el techo es 'patron_probable': se alcanza sólo si la decisión
  // se apoya en consultas atribuidas reales (§6).
  const confianza = hayNegocio ? 'patron_probable' : 'senal_inicial';
  const conclusion = `${t.variable}: gana "${gan.titulo}" (${ganador.toUpperCase()}) por ${baseDecision} ` +
    `${mayor} vs ${menor} (+${Math.round(diferencia * 100)}%) en ${a.plataforma} — confianza ${confianza}`;

  return cerrar({
    ...base, plataforma: a.plataforma, resultado: 'ganador', ganador, post_ganador: gan.post_id,
    base_decision: baseDecision, valor_a: valorA, valor_b: valorB, diferencia_relativa: diferencia,
    confianza, tipo: 'interpretacion',
    limitaciones: 'una sola pareja de publicaciones: repetir la prueba antes de convertirla en regla',
    conclusion,
  });
}

module.exports = { create, list, evaluate, VARIABLES, INTENCION };
