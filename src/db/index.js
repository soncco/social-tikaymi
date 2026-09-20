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
CREATE TABLE IF NOT EXISTS learnings(
  id INTEGER PRIMARY KEY, fecha TEXT DEFAULT CURRENT_TIMESTAMP, texto TEXT NOT NULL, post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL);
`;

function open(file) {
  const db = new Database(file || process.env.DB_FILE || path.join(__dirname, '../../data/tikaymi.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

module.exports = { open, METRICS };
