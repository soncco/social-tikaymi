// Módulo de alertas objetivas derivadas de datos
// Retorna alertas con {tipo, mensaje, ref}

const now = () => new Date().toISOString();
const daysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString();

function alerts(db) {
  const result = [];

  // Alerta 1: posts publicados sin métricas en >7 días
  const oldPosts = db.prepare(`
    SELECT p.id, p.titulo, p.fecha, p.plataforma,
      (SELECT COUNT(*) FROM metrics WHERE post_id = p.id) as has_metrics
    FROM posts p
    WHERE p.estado = 'publicado'
      AND p.fecha IS NOT NULL
      AND datetime(p.fecha) < datetime('now', '-7 days')
  `).all();

  for (const post of oldPosts) {
    if (!post.has_metrics) {
      result.push({
        tipo: 'post_sin_metricas',
        mensaje: `Post "${post.titulo}" (${post.plataforma}) publicado el ${post.fecha} sin métricas importadas`,
        ref: { post_id: post.id, dias: Math.floor((Date.now() - new Date(post.fecha).getTime()) / 86400000) }
      });
    }
  }

  // Alerta 2: leads en estado 'nuevo' sin contactar >2 días
  const uncontactedLeads = db.prepare(`
    SELECT id, viajeros, fuente,
      datetime('now') as ahora,
      created_at,
      julianday('now') - julianday(created_at) as dias_transcurridos
    FROM leads
    WHERE estado = 'nuevo'
      AND datetime(created_at) < datetime('now', '-2 days')
  `).all();

  for (const lead of uncontactedLeads) {
    result.push({
      tipo: 'lead_nuevo_sin_contacto',
      mensaje: `Lead #${lead.id} en estado 'nuevo' sin contactar por ${Math.floor(lead.dias_transcurridos)} días`,
      ref: { lead_id: lead.id, dias: Math.floor(lead.dias_transcurridos) }
    });
  }

  // Alerta 3: posts sin clasificar que están pendientes
  const unclassifiedPosts = db.prepare(`
    SELECT id, titulo, estado, created_at
    FROM posts
    WHERE tema IS NULL OR tema = 'sin_clasificar'
  `).all();

  if (unclassifiedPosts.length > 0) {
    result.push({
      tipo: 'posts_sin_clasificar',
      mensaje: `${unclassifiedPosts.length} posts pendientes de clasificación automática`,
      ref: {
        post_ids: unclassifiedPosts.map(p => p.id),
        count: unclassifiedPosts.length
      }
    });
  }

  // Alerta 4: período sin objetivo definido
  const recentPosts = db.prepare(`
    SELECT DISTINCT substr(fecha, 1, 7) as periodo
    FROM posts
    WHERE fecha IS NOT NULL
      AND estado IN ('publicado', 'analizado')
      AND fecha >= date('now', '-90 days')
    ORDER BY periodo DESC
    LIMIT 1
  `).get();

  if (recentPosts) {
    const periodo = recentPosts.periodo;
    const hasObjective = db.prepare(
      'SELECT COUNT(*) as cnt FROM objectives WHERE periodo = ?'
    ).get(periodo);

    if (!hasObjective || hasObjective.cnt === 0) {
      result.push({
        tipo: 'periodo_sin_objetivo',
        mensaje: `Período ${periodo} tiene publicaciones pero no tiene objetivo definido`,
        ref: { periodo }
      });
    }
  }

  return result;
}

module.exports = { alerts };
