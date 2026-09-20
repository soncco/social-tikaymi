// Módulo de cohorts: agrupa leads por semana de creación
// Retorna conteos por estado y tasa de conversión a cotizado/reservado
// Tasa es null si n<5 (datos insuficientes)

const round = (x, d = 4) => x === null ? null : Math.round(x * 10 ** d) / 10 ** d;

function cohorts(db) {
  const data = db.prepare(`
    SELECT
      strftime('%Y-W%W', created_at) as semana,
      estado,
      COUNT(*) as count
    FROM leads
    GROUP BY semana, estado
    ORDER BY semana DESC
  `).all();

  // Agrupar por semana
  const byWeek = {};
  for (const row of data) {
    if (!byWeek[row.semana]) {
      byWeek[row.semana] = {};
    }
    byWeek[row.semana][row.estado] = row.count;
  }

  const result = {};

  for (const [week, estados] of Object.entries(byWeek)) {
    const total = Object.values(estados).reduce((a, b) => a + b, 0);

    // Contar leads cotizados o reservados (conversión)
    const convertedCount = (estados.cotizado ?? 0) + (estados.reservado ?? 0);

    // Tasa de conversión: null si n<5 (datos insuficientes)
    const tasa = total < 5 ? null : round(convertedCount / total);

    result[week] = {
      total: total,
      por_estado: estados,
      tasa_a_cotizado_reservado: tasa,
      datos_suficientes: total >= 5
    };
  }

  return result;
}

module.exports = { cohorts };
