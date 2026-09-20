// Módulo de clasificación de temas por palabras clave de destinos
// Regla: nunca inventar; NULL si no hay coincidencia

const DESTINATION_KEYWORDS = {
  humantay: ['humantay', 'laguna de humantay'],
  machu_picchu: ['machu picchu', 'machupicchu'],
  valle_sagrado: ['valle sagrado', 'sagrado'],
  montaña_colores: ['montaña de colores', 'rainbow mountain', 'rainbow', 'montaña colores', 'vinicunca'],
  cusco: ['cusco', 'cuzco'],
};

// Normalizar texto: minúsculas, sin acentos y espacios
function normalize(text) {
  if (!text) return '';
  const normalized = String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // eliminar acentos
  return normalized;
}

// Clasificar texto por palabras clave de destinos
// Retorna: tema (string) o null (nunca inventar)
function classify(text) {
  if (!text) return null;
  const norm = normalize(text);

  for (const [tema, keywords] of Object.entries(DESTINATION_KEYWORDS)) {
    for (const keyword of keywords) {
      if (norm.includes(normalize(keyword))) {
        return tema;
      }
    }
  }

  return null;
}

// Clasificar automáticamente posts en la BD
// Rellena posts.tema solo donde es NULL o 'sin_clasificar' usando el título
function autoClassify(db) {
  const posts = db.prepare(`
    SELECT id, titulo FROM posts
    WHERE tema IS NULL OR tema = 'sin_clasificar'
  `).all();

  let count = 0;
  for (const post of posts) {
    const tema = classify(post.titulo);
    if (tema) {
      db.prepare('UPDATE posts SET tema = ? WHERE id = ?')
        .run(tema, post.id);
      count++;
    }
  }

  return { classified: count, total: posts.length };
}

module.exports = { classify, autoClassify };
