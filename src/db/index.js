const Database = require('better-sqlite3');
const path = require('path');

const METRICS = ['reach','impressions','plays','retention','completed_plays','likes','comments','shares','saves','profile_visits','clicks','conversations'];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS objectives(
  id INTEGER PRIMARY KEY, periodo TEXT NOT NULL, objetivo_negocio TEXT NOT NULL, meta TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS posts(
  id INTEGER PRIMARY KEY, plataforma TEXT NOT NULL, external_id TEXT, titulo TEXT NOT NULL, fecha TEXT,
  formato TEXT, idioma TEXT, tema TEXT,
  objetivo_negocio TEXT NOT NULL, objetivo_marketing TEXT NOT NULL, objetivo_contenido TEXT NOT NULL,
  audiencia TEXT NOT NULL, etapa_embudo TEXT NOT NULL, cta TEXT NOT NULL, metrica_principal TEXT NOT NULL,
  campaign_code TEXT, estado TEXT NOT NULL DEFAULT 'borrador', created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plataforma, external_id));
CREATE TABLE IF NOT EXISTS metrics(
  post_id INTEGER PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE, captured_at TEXT DEFAULT CURRENT_TIMESTAMP,
  ${METRICS.map(m => m + ' REAL').join(', ')});
CREATE TABLE IF NOT EXISTS leads(
  id INTEGER PRIMARY KEY, post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL, campaign_code TEXT,
  fuente TEXT, estado TEXT NOT NULL DEFAULT 'nuevo', fecha_viaje TEXT, viajeros INTEGER, notas TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS learnings(
  id INTEGER PRIMARY KEY, fecha TEXT DEFAULT CURRENT_TIMESTAMP, texto TEXT NOT NULL, post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL);
-- Fase 2: biblioteca de información aprobada de Tikaymi (única fuente de verdad para la IA)
CREATE TABLE IF NOT EXISTS approved_info(
  id INTEGER PRIMARY KEY, tipo TEXT NOT NULL, titulo TEXT NOT NULL, texto TEXT NOT NULL,
  autorizado_publicar INTEGER NOT NULL DEFAULT 0, fuente TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS assets(
  id INTEGER PRIMARY KEY, tipo TEXT NOT NULL, url TEXT NOT NULL, descripcion TEXT, destino TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP);
-- Todo lo generado nace en 'revision': aprobación humana obligatoria antes de publicar (§8).
CREATE TABLE IF NOT EXISTS generated(
  id INTEGER PRIMARY KEY, post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE, tipo TEXT NOT NULL,
  idioma TEXT NOT NULL, contenido TEXT NOT NULL, estado TEXT NOT NULL DEFAULT 'revision',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP);
-- Fase 3: pruebas A/B manuales (§14). Una prueba compara exactamente dos publicaciones
-- de la MISMA plataforma variando una sola cosa. La conclusión la escribe evaluate().
CREATE TABLE IF NOT EXISTS ab_tests(
  id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, variable TEXT NOT NULL,
  post_a INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  post_b INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  creado TEXT DEFAULT CURRENT_TIMESTAMP, conclusion TEXT);
-- Auditoría de clasificación retrospectiva: indica qué fue inferido del copy.
CREATE TABLE IF NOT EXISTS post_classification_audit(
  post_id INTEGER PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  source TEXT NOT NULL, confidence TEXT NOT NULL, rationale TEXT NOT NULL,
  classified_at TEXT DEFAULT CURRENT_TIMESTAMP);
`;

// Migraciones seguras: columnas añadidas después de la primera versión de la base.
// ALTER TABLE sólo se ejecuta si la columna todavía no existe (idempotente).
function migrate(db) {
  const cols = db.prepare('PRAGMA table_info(posts)').all().map(c => c.name);
  // §11: programación manual (recordatorio), nunca publicación automática.
  if (!cols.includes('programado_para')) db.exec('ALTER TABLE posts ADD COLUMN programado_para TEXT');

  // v2: las primeras versiones confundían "sin clasificar" con "borrador".
  // Sólo migramos piezas externas con métricas y todos sus metadatos todavía
  // intactos en sin_clasificar; así no tocamos borradores creados por personas.
  const uxV2 = db.prepare("SELECT value FROM settings WHERE key='migration_ux_v2'").get();
  if (!uxV2) {
    db.prepare(`UPDATE posts SET estado='publicado'
      WHERE estado='borrador' AND external_id IS NOT NULL
      AND objetivo_negocio='sin_clasificar'
      AND EXISTS (SELECT 1 FROM metrics WHERE metrics.post_id=posts.id)`).run();
    db.prepare("INSERT INTO settings(key,value) VALUES('migration_ux_v2','done')").run();
  }
}

function open(file) {
  const db = new Database(file || process.env.DB_FILE || path.join(__dirname, '../../data/tikaymi.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

module.exports = { open, migrate, METRICS };
