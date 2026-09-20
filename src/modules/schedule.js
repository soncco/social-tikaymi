// Programación MANUAL de publicaciones (Inicial.MD §11).
// No publica nada: sólo guarda una fecha/hora de recordatorio y exporta un calendario iCal
// para que una persona publique a mano. La publicación automática es una fase posterior
// y requiere conectores oficiales (ver src/adapters/README.md).

const bad = (m, status = 400) => Object.assign(new Error(m), { status });

// Sólo se programa lo ya aprobado por una persona (§8, §11).
// Para reprogramar, primero se devuelve el post a 'aprobado' con PUT /api/posts/:id.
const ESTADO_REQUERIDO = 'aprobado';

function parseFecha(v) {
  const s = String(v ?? '').trim();
  if (!s) throw bad('programado_para es obligatorio (fecha ISO, ej. 2026-02-14T09:30:00Z)');
  const d = new Date(s.length === 10 ? s + 'T09:00:00Z' : s);
  if (Number.isNaN(d.getTime())) throw bad(`programado_para inválido: ${v}`);
  return d;
}

function schedule(db, id, programado_para) {
  const post = db.prepare('SELECT id, estado, titulo FROM posts WHERE id=?').get(id);
  if (!post) throw bad('No existe', 404);
  if (post.estado !== ESTADO_REQUERIDO) {
    throw bad(`sólo se programa un post en estado '${ESTADO_REQUERIDO}' (actual: '${post.estado}')`, 409);
  }
  const d = parseFecha(programado_para);
  db.prepare("UPDATE posts SET programado_para=?, estado='programado' WHERE id=?").run(d.toISOString(), post.id);
  return {
    id: post.id, programado_para: d.toISOString(), estado: 'programado',
    nota: 'recordatorio manual: la aplicación no publica por sí sola',
  };
}

const list = db => db.prepare(`SELECT id, titulo, plataforma, idioma, formato, cta, estado, campaign_code, programado_para
  FROM posts WHERE programado_para IS NOT NULL ORDER BY programado_para`).all();

// --- iCal (RFC 5545) ---------------------------------------------------------
const esc = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const stamp = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function icsCalendar(db, { ahora = new Date() } = {}) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tikaymi//Marketing Lab//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Tikaymi — publicaciones programadas'];
  for (const p of list(db)) {
    const d = new Date(p.programado_para);
    if (Number.isNaN(d.getTime())) continue;
    L.push('BEGIN:VEVENT',
      `UID:tikaymi-post-${p.id}@tikaymi`,
      `DTSTAMP:${stamp(ahora)}`,
      `DTSTART:${stamp(d)}`,
      `DTEND:${stamp(new Date(d.getTime() + 15 * 60000))}`,
      `SUMMARY:${esc(`Publicar: ${p.titulo} (${p.plataforma})`)}`,
      `DESCRIPTION:${esc([`Idioma: ${p.idioma}`, `Formato: ${p.formato ?? '—'}`, `CTA: ${p.cta}`,
        `Código de campaña: ${p.campaign_code ?? '—'}`, 'Publicación manual: la aplicación no publica automáticamente.'].join('\n'))}`,
      'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:Recordatorio de publicación Tikaymi', 'END:VALARM',
      'END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.join('\r\n') + '\r\n';
}

module.exports = { schedule, list, icsCalendar, ESTADO_REQUERIDO };
