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
CREATE TABLE IF NOT EXISTS metric_snapshots(
  id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, snapshot_json TEXT NOT NULL);
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
CREATE TABLE IF NOT EXISTS site_pages(
  url TEXT PRIMARY KEY, lang TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL,
  description TEXT, body_text TEXT, content_hash TEXT NOT NULL,
  sitemap_lastmod TEXT, fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved INTEGER NOT NULL DEFAULT 0, changed_at TEXT,
  active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS site_syncs(
  id INTEGER PRIMARY KEY, started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT, found INTEGER NOT NULL DEFAULT 0, fetched INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL DEFAULT 0, changed INTEGER NOT NULL DEFAULT 0,
  unchanged INTEGER NOT NULL DEFAULT 0, failed INTEGER NOT NULL DEFAULT 0,
  removed INTEGER NOT NULL DEFAULT 0, error TEXT);
-- Todo lo generado nace en 'revision': aprobación humana obligatoria antes de publicar (§8).
CREATE TABLE IF NOT EXISTS generated(
  id INTEGER PRIMARY KEY, post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE, tipo TEXT NOT NULL,
  idioma TEXT NOT NULL, contenido TEXT NOT NULL, estado TEXT NOT NULL DEFAULT 'revision',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS generated_revisions(
  id INTEGER PRIMARY KEY, generated_id INTEGER NOT NULL REFERENCES generated(id) ON DELETE CASCADE,
  version INTEGER NOT NULL, contenido TEXT NOT NULL, segmento TEXT, motivo TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(generated_id, version));
CREATE TABLE IF NOT EXISTS generated_feedback(
  id INTEGER PRIMARY KEY, generated_id INTEGER NOT NULL REFERENCES generated(id) ON DELETE CASCADE,
  segmento TEXT, motivo TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS lead_status_history(
  id INTEGER PRIMARY KEY, lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  estado_anterior TEXT, estado_nuevo TEXT NOT NULL, changed_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS content_packages(
  id INTEGER PRIMARY KEY, contract_version INTEGER NOT NULL DEFAULT 1,
  post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
  plan_idea_id INTEGER REFERENCES plan_ideas(id) ON DELETE SET NULL,
  brief_json TEXT NOT NULL, concept_json TEXT NOT NULL, primary_json TEXT NOT NULL,
  sources_json TEXT NOT NULL, resources_json TEXT NOT NULL,
  cta TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}', warnings_json TEXT NOT NULL,
  pending_json TEXT NOT NULL, validations_json TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS generated_parts(
  id INTEGER PRIMARY KEY, generated_id INTEGER NOT NULL REFERENCES generated(id) ON DELETE CASCADE,
  clip_number INTEGER NOT NULL, funcion TEXT, duracion TEXT, audio TEXT, dialogo TEXT,
  prompt_flow TEXT, contenido TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(generated_id, clip_number));
CREATE TABLE IF NOT EXISTS editorial_examples(
  id INTEGER PRIMARY KEY, generated_id INTEGER NOT NULL REFERENCES generated(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL, etiqueta TEXT NOT NULL, contenido TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS generated_publications(
  id INTEGER PRIMARY KEY, generated_id INTEGER NOT NULL REFERENCES generated(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE, plataforma TEXT NOT NULL,
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(generated_id, post_id));
CREATE TABLE IF NOT EXISTS approval_events(
  id INTEGER PRIMARY KEY, generated_id INTEGER NOT NULL REFERENCES generated(id) ON DELETE CASCADE,
  estado TEXT NOT NULL, revisor TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS editorial_plans(
  id INTEGER PRIMARY KEY, cadence TEXT NOT NULL, objetivo_negocio TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'analisis', filtros_json TEXT NOT NULL DEFAULT '{}', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS plan_ideas(
  id INTEGER PRIMARY KEY, plan_id INTEGER NOT NULL REFERENCES editorial_plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL, platforms TEXT NOT NULL, brief_json TEXT NOT NULL,
  evidence TEXT NOT NULL, limitations TEXT NOT NULL, confidence TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'propuesta', position INTEGER NOT NULL, planned_for TEXT,
  source_url TEXT);
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

  const auditCols = db.prepare('PRAGMA table_info(post_classification_audit)').all().map(c => c.name);
  if (!auditCols.includes('manually_modified_at')) db.exec('ALTER TABLE post_classification_audit ADD COLUMN manually_modified_at TEXT');
  const generatedCols = db.prepare('PRAGMA table_info(generated)').all().map(c => c.name);
  if (!generatedCols.includes('plan_idea_id')) db.exec('ALTER TABLE generated ADD COLUMN plan_idea_id INTEGER REFERENCES plan_ideas(id) ON DELETE SET NULL');
  if (!generatedCols.includes('package_id')) db.exec('ALTER TABLE generated ADD COLUMN package_id INTEGER REFERENCES content_packages(id) ON DELETE SET NULL');
  const packageCols = db.prepare('PRAGMA table_info(content_packages)').all().map(c => c.name);
  if (packageCols.length && !packageCols.includes('primary_json')) db.exec("ALTER TABLE content_packages ADD COLUMN primary_json TEXT NOT NULL DEFAULT '{}'");
  if (packageCols.length && !packageCols.includes('metadata_json')) db.exec("ALTER TABLE content_packages ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}'");
  const planCols = db.prepare('PRAGMA table_info(editorial_plans)').all().map(c => c.name);
  if (planCols.length && !planCols.includes('filtros_json')) db.exec("ALTER TABLE editorial_plans ADD COLUMN filtros_json TEXT NOT NULL DEFAULT '{}'");
  const ideaCols = db.prepare('PRAGMA table_info(plan_ideas)').all().map(c => c.name);
  if (!ideaCols.includes('planned_for')) db.exec('ALTER TABLE plan_ideas ADD COLUMN planned_for TEXT');
  if (!ideaCols.includes('source_url')) db.exec('ALTER TABLE plan_ideas ADD COLUMN source_url TEXT');
  const siteCols = db.prepare('PRAGMA table_info(site_pages)').all().map(c => c.name);
  if (!siteCols.includes('active')) db.exec('ALTER TABLE site_pages ADD COLUMN active INTEGER NOT NULL DEFAULT 1');
  const syncCols = db.prepare('PRAGMA table_info(site_syncs)').all().map(c => c.name);
  if (!syncCols.includes('removed')) db.exec('ALTER TABLE site_syncs ADD COLUMN removed INTEGER NOT NULL DEFAULT 0');
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
