// Clasificación editorial puntual de las 50 piezas históricas de Meta.
// Criterio humano sobre captions/messages completos leídos el 2026-09-21.
// No crea leads ni códigos de campaña; no atribuye conversiones.
// Sin --apply solo muestra un resumen. --apply crea una copia SQLite consistente.
const fs = require('node:fs');
const path = require('node:path');
const { open } = require('../src/db');

const rows = new Map();
function define(ids, values, rationale, confidence = 'media') {
  for (const id of ids) {
    if (rows.has(id)) throw Error(`ID duplicado: ${id}`);
    rows.set(id, { values, rationale, confidence });
  }
}

// Los pares Instagram/Facebook son piezas de igual copy, pero su rendimiento
// seguirá analizándose por plataforma. "mixto" describe el copy histórico;
// no autoriza generar una pieza nueva bilingüe.
define([1, 26], {
  tema:'experiencias_viajeros', objetivo_negocio:'confianza', objetivo_marketing:'Transmitir confianza en la organización del viaje',
  objetivo_contenido:'demostrar', audiencia:'Viajeros que planifican conocer Perú', etapa_embudo:'consideracion',
  cta:'Enviar fechas, número de viajeros e intereses por WhatsApp', metrica_principal:'conversaciones', idioma:'es',
}, 'Agradecimiento a viajeros y solicitud explícita de fechas, viajeros e intereses. La pieza no prueba por sí sola un testimonio verificable.');

define([2, 27], {
  tema:'peru_multi_destino', objetivo_negocio:'cotizacion', objetivo_marketing:'Presentar la ruta coordinada de 10 días por Perú',
  objetivo_contenido:'producto', audiencia:'Viajeros que buscan un itinerario integral por Perú', etapa_embudo:'intencion',
  cta:'Enviar fechas y tipo de viaje por WhatsApp o revisar itinerario completo', metrica_principal:'conversaciones', idioma:'mixto',
}, 'Copy bilingüe EN/ES con itinerario de 10 días, enlace al tour y solicitud explícita de fechas. La cotización es una intención inferida, no una conversión observada.');

define([3, 28], {
  tema:'montaña_colores', objetivo_negocio:'consulta_calificada', objetivo_marketing:'Ayudar a elegir entre Palcoyo y Vinicunca',
  objetivo_contenido:'comparar', audiencia:'Viajeros que evalúan excursiones de altura en Cusco', etapa_embudo:'consideracion',
  cta:'Enviar fechas por WhatsApp o leer la comparación completa', metrica_principal:'conversaciones', idioma:'es',
}, 'El texto compara dos excursiones y pide fechas para ayudar a elegir.');

define([4, 29], {
  tema:'humantay', objetivo_negocio:'consulta_calificada', objetivo_marketing:'Resolver dudas sobre dificultad y aclimatación en Humantay',
  objetivo_contenido:'explicar', audiencia:'Viajeros interesados en Laguna Humantay', etapa_embudo:'consideracion',
  cta:'Enviar fechas para evaluar si Humantay encaja en el itinerario', metrica_principal:'conversaciones', idioma:'mixto',
}, 'Copy bilingüe EN/ES; explica la caminata en altura y solicita fechas.');

define([5, 31], {
  tema:'experiencias_viajeros', objetivo_negocio:'confianza', objetivo_marketing:'Transmitir coordinación y confianza a futuros viajeros',
  objetivo_contenido:'demostrar', audiencia:'Viajeros que planifican Perú y valoran organización', etapa_embudo:'consideracion',
  cta:'Enviar fechas e intereses por WhatsApp', metrica_principal:'conversaciones', idioma:'mixto',
}, 'Agradecimiento bilingüe a viajeros; transmite confianza, pero no contiene una reseña individual verificable.');

define([6, 32], {
  tema:'valle_sagrado', objetivo_negocio:'consulta_calificada', objetivo_marketing:'Mostrar cómo integrar el Valle Sagrado en una ruta personalizada',
  objetivo_contenido:'explicar', audiencia:'Viajeros que organizan Cusco y Machu Picchu', etapa_embudo:'consideracion',
  cta:'Enviar fechas para organizar la ruta por WhatsApp', metrica_principal:'conversaciones', idioma:'mixto',
}, 'El tema principal es Valle Sagrado, no Machu Picchu; el copy bilingüe pide fechas. Tema automático previo corregido.');

define([7, 33], {
  tema:'machu_picchu', objetivo_negocio:'consulta_calificada', objetivo_marketing:'Resolver si Machu Picchu puede visitarse en un día',
  objetivo_contenido:'responder', audiencia:'Viajeros con poco tiempo que planean Machu Picchu', etapa_embudo:'intencion',
  cta:'Enviar fecha para comprobar disponibilidad por WhatsApp', metrica_principal:'conversaciones', idioma:'mixto',
}, 'Copy bilingüe con pregunta frecuente, logística y solicitud explícita de fecha; no se asume disponibilidad.');

define([8, 34], {
  tema:'cusco_itinerario', objetivo_negocio:'cotizacion', objetivo_marketing:'Presentar un itinerario adaptable de cinco días en Cusco',
  objetivo_contenido:'producto', audiencia:'Viajeros que buscan un circuito de varios días en Cusco', etapa_embudo:'intencion',
  cta:'Enviar fechas y número de viajeros por WhatsApp o revisar itinerario', metrica_principal:'conversaciones', idioma:'mixto',
}, 'Ruta de cinco días y solicitud explícita de fechas y viajeros; cotización inferida. El copy de cada plataforma tiene pequeñas diferencias.');

define([9, 35], {
  tema:'temporada_lluvias', objetivo_negocio:'seguimiento', objetivo_marketing:'Resolver objeciones sobre viajar a Cusco en temporada de lluvias',
  objetivo_contenido:'explicar', audiencia:'Viajeros que deciden cuándo visitar Cusco', etapa_embudo:'consideracion',
  cta:'Leer la guía y pedir ayuda por WhatsApp', metrica_principal:'clics', idioma:'es',
}, 'Consejos estacionales con enlace al blog y WhatsApp; no se atribuyen visitas ni consultas.');

define([10, 36], {
  tema:'tours_cusco', objetivo_negocio:'consulta_calificada', objetivo_marketing:'Ayudar a decidir entre tour privado y grupal',
  objetivo_contenido:'comparar', audiencia:'Viajeros que evalúan modalidad de tour en Cusco', etapa_embudo:'consideracion',
  cta:'Enviar viajeros, fechas y ritmo preferido por WhatsApp', metrica_principal:'conversaciones', idioma:'es',
}, 'Comparación de modalidades y solicitud explícita de viajeros, fechas y ritmo.');

define([11, 37], {
  tema:'tikaymi_web', objetivo_negocio:'seguimiento', objetivo_marketing:'Dar a conocer el nuevo sitio y atraer visitas',
  objetivo_contenido:'demostrar', audiencia:'Personas interesadas en viajes por Perú', etapa_embudo:'interaccion',
  cta:'Visitar tikaymi.com y comentar el destino deseado', metrica_principal:'clics', idioma:'es',
}, 'Anuncio del rediseño web con URL y pregunta para comentarios.');

define([12], {
  tema:'ausangate', objetivo_negocio:'reconocimiento', objetivo_marketing:'Despertar interés por las siete lagunas de Ausangate',
  objetivo_contenido:'inspirar', audiencia:'Viajeros interesados en naturaleza y trekking', etapa_embudo:'alcance',
  metrica_principal:'alcance', idioma:'es',
}, 'Descripción inspiracional de Ausangate sin CTA explícito; CTA queda sin clasificar.');

define([13, 42], {
  tema:'quillabamba', objetivo_negocio:'reconocimiento', objetivo_marketing:'Mostrar la cultura y la Feria de Sambaray',
  objetivo_contenido:'demostrar', audiencia:'Personas interesadas en cultura local de Cusco', etapa_embudo:'interaccion',
  cta:'Deslizar para ver momentos de la feria', metrica_principal:'compartidos', idioma:'es',
}, 'Crónica cultural con invitación explícita a deslizar; no contiene solicitud comercial.');

define([14], {
  tema:'mosoqllacta', objetivo_negocio:'reconocimiento', objetivo_marketing:'Dar visibilidad a un atractivo poco conocido de Cusco',
  objetivo_contenido:'inspirar', audiencia:'Viajeros que exploran destinos menos conocidos de Cusco', etapa_embudo:'alcance',
  metrica_principal:'alcance', idioma:'es',
}, 'La publicación solo identifica las cuevas; público y objetivo son inferencias de confianza media. No hay CTA explícito.');

define([15, 46], {
  tema:'experiencias_viajeros', objetivo_negocio:'confianza', objetivo_marketing:'Mostrar una experiencia de cliente con viaje coordinado por Perú',
  objetivo_contenido:'testimonio', audiencia:'Viajeros que comparan agencias para un viaje por Perú', etapa_embudo:'consideracion',
  cta:'Contactar por WhatsApp o correo', metrica_principal:'conversaciones', idioma:'es',
}, 'El copy publicado atribuye una experiencia a Randall; clasificar como testimonio no autoriza reutilizarla en IA sin aprobación separada.');

define([16, 47], {
  tema:'maras', objetivo_negocio:'seguimiento', objetivo_marketing:'Explicar el atractivo de las Salineras de Maras',
  objetivo_contenido:'explicar', audiencia:'Viajeros interesados en Maras y cultura andina', etapa_embudo:'consideracion',
  cta:'Contactar por WhatsApp o visitar el sitio', metrica_principal:'clics', idioma:'es',
}, 'Explicación del destino con enlaces genéricos de contacto.');

define([17, 48], {
  tema:'experiencias_viajeros', objetivo_negocio:'confianza', objetivo_marketing:'Mostrar un itinerario personalizado realizado para viajeros',
  objetivo_contenido:'demostrar', audiencia:'Viajeros que valoran rutas personalizadas por Perú', etapa_embudo:'consideracion',
  cta:'Contactar por WhatsApp, sitio o correo', metrica_principal:'conversaciones', idioma:'es',
}, 'Relato de un viaje de clientes de Honduras; no es una reseña textual individual.');

define([18, 49], {
  tema:'viajes_peru', objetivo_negocio:'reconocimiento', objetivo_marketing:'Estimular conversación sobre próximos viajes',
  objetivo_contenido:'inspirar', audiencia:'Personas que desean viajar acompañadas', etapa_embudo:'interaccion',
  cta:'Etiquetar a las personas del próximo viaje', metrica_principal:'comentarios', idioma:'es',
}, 'El CTA principal escrito es etiquetar acompañantes; los enlaces de contacto son secundarios.');

define([19], {
  tema:'fiestas_cusco', objetivo_negocio:'reconocimiento', objetivo_marketing:'Despertar interés por las fiestas de Cusco',
  objetivo_contenido:'inspirar', audiencia:'Viajeros interesados en cultura y festividades de Cusco', etapa_embudo:'alcance',
  cta:'Contactar por WhatsApp', metrica_principal:'alcance', idioma:'es',
}, 'Invitación a vivir las fiestas de Cusco y enlace genérico de WhatsApp.');

define([20, 50], {
  tema:'experiencias_viajeros', objetivo_negocio:'confianza', objetivo_marketing:'Mostrar la personalización de un viaje familiar por Cusco',
  objetivo_contenido:'demostrar', audiencia:'Familias que planifican Cusco con apoyo de una agencia', etapa_embudo:'consideracion',
  cta:'Contactar por WhatsApp o visitar el sitio', metrica_principal:'conversaciones', idioma:'es',
}, 'Historia de una familia y su ruta; se evita presentarla como testimonio textual verificado.');

define([21], {
  tema:'valle_sagrado', objetivo_negocio:'reserva', objetivo_marketing:'Invitar a reservar una visita al Valle Sagrado',
  objetivo_contenido:'producto', audiencia:'Viajeros interesados en el Valle Sagrado', etapa_embudo:'intencion',
  cta:'Reservar el viaje con Tikaymi', metrica_principal:'reservas', idioma:'es',
}, 'El propio texto dice «Reserva con nosotros»; esto es intención de la pieza, no una reserva atribuida.');

define([22], {
  tema:'montaña_colores', objetivo_negocio:'consulta_calificada', objetivo_marketing:'Explicar el origen de los colores de Vinicunca',
  objetivo_contenido:'explicar', audiencia:'Viajeros interesados en Vinicunca', etapa_embudo:'consideracion',
  cta:'Contactar por WhatsApp para vivir la experiencia', metrica_principal:'conversaciones', idioma:'es',
}, 'Explicación del destino seguida de una invitación explícita a contactar.');

define([23], {
  tema:'machu_picchu', objetivo_negocio:'consulta_calificada', objetivo_marketing:'Inspirar un viaje a Machu Picchu',
  objetivo_contenido:'inspirar', audiencia:'Viajeros que desean conocer Machu Picchu', etapa_embudo:'intencion',
  cta:'Contactar por WhatsApp, sitio o correo', metrica_principal:'conversaciones', idioma:'es',
}, 'La «maravilla del mundo» se interpreta como Machu Picchu por el copy y sus hashtags; contacto explícito.');

define([24], {
  tema:'inti_raymi', objetivo_negocio:'reserva', objetivo_marketing:'Invitar a viajar a Cusco durante la Fiesta del Sol',
  objetivo_contenido:'inspirar', audiencia:'Viajeros interesados en Inti Raymi y cultura inca', etapa_embudo:'intencion',
  cta:'Reservar ahora y contactar por WhatsApp', metrica_principal:'reservas', idioma:'es',
}, 'El copy dice «Reserva ahora»; no se afirma que haya reservas observadas.');

define([25], {
  tema:'inti_raymi', objetivo_negocio:'consulta_calificada', objetivo_marketing:'Promover interés por vivir Inti Raymi en Cusco',
  objetivo_contenido:'inspirar', audiencia:'Viajeros interesados en Inti Raymi', etapa_embudo:'intencion',
  cta:'Contactar por WhatsApp', metrica_principal:'conversaciones', idioma:'es',
}, 'Invitación a la festividad y enlace de contacto; no pide reserva explícita.');

define([41], {
  tema:'cusco_machu_picchu', objetivo_negocio:'reconocimiento', objetivo_marketing:'Inspirar interés por Cusco y Machu Picchu',
  objetivo_contenido:'inspirar', audiencia:'Personas que sueñan con visitar Cusco y Machu Picchu', etapa_embudo:'interaccion',
  cta:'Comentar la imagen favorita o contactar a Tikaymi', metrica_principal:'comentarios', idioma:'es',
}, 'El copy declara que las imágenes 3D fueron generadas por IA; no tratarlas como fotos reales ni como recursos aprobados.');

define([43], {
  tema:'inti_raymi', objetivo_negocio:'reconocimiento', objetivo_marketing:'Mostrar la celebración de Inti Raymi en Cusco',
  objetivo_contenido:'inspirar', audiencia:'Viajeros interesados en festividades andinas', etapa_embudo:'alcance',
  metrica_principal:'alcance', idioma:'es',
}, 'Descripción cultural sin una petición directa al lector; CTA queda sin clasificar.');

const FIELDS = ['tema','objetivo_negocio','objetivo_marketing','objetivo_contenido','audiencia','etapa_embudo','cta','metrica_principal','idioma'];
const PLACEHOLDERS = new Set([null, '', 'sin_clasificar']);
const CORRECTIONS = new Map([
  [6,'valle_sagrado'],[32,'valle_sagrado'],[8,'cusco_itinerario'],[34,'cusco_itinerario'],
  [14,'mosoqllacta'],[43,'inti_raymi'],
]);

async function main() {
  const apply = process.argv.includes('--apply');
  const dbFile = path.join(__dirname, '../data/tikaymi.db');
  const db = open(dbFile);
  const existing = db.prepare('SELECT * FROM posts ORDER BY id').all();
  const byId = new Map(existing.map(p => [p.id,p]));
  const missing = [...rows.keys()].filter(id => !byId.has(id) || byId.get(id).titulo === 'Sin título');
  if (missing.length) throw Error(`Base distinta de la revisada: ${missing.join(', ')}`);
  const skipped = existing.filter(p => !rows.has(p.id)).map(p => p.id);
  const preview = [...rows].map(([id, item]) => {
    const p = byId.get(id); const changes = {};
    for (const key of FIELDS) {
      const value = item.values[key];
      if (value === undefined) continue;
      if (p[key] !== value && (PLACEHOLDERS.has(p[key]) || (key === 'idioma' && value === 'mixto' && p[key] === 'es') || (key === 'tema' && CORRECTIONS.get(id) === value))) changes[key] = value;
    }
    return { id, changes, rationale:item.rationale, confidence:item.confidence, platform:p.plataforma };
  });
  console.log(`Revisadas: ${preview.length}; sin texto fiable: ${skipped.length} (${skipped.join(', ')})`);
  console.log(`Campos a actualizar: ${preview.reduce((n,p) => n + Object.keys(p.changes).length,0)}`);
  if (!apply) { console.log('Vista previa. Ejecuta con --apply para respaldar y aplicar.'); db.close(); return; }
  const backup = path.join(__dirname, '../data/tikaymi-before-classification-2026-09-21.db');
  if (!fs.existsSync(backup)) await db.backup(backup);
  else {
    const audited = db.prepare('SELECT COUNT(*) AS n FROM post_classification_audit').get().n;
    if (audited !== rows.size) throw Error(`El respaldo ya existe pero la auditoría está incompleta (${audited}/${rows.size}); no se continúa.`);
    console.log('Reaplicación idempotente: se conserva el respaldo original.');
  }
  const audit = db.prepare(`INSERT INTO post_classification_audit(post_id,source,confidence,rationale)
    VALUES(?,?,?,?) ON CONFLICT(post_id) DO NOTHING`);
  db.transaction(() => {
    for (const p of preview) {
      const keys = Object.keys(p.changes);
      if (!keys.length) continue;
      db.prepare(`UPDATE posts SET ${keys.map(k => k+'=?').join(',')} WHERE id=?`).run(...keys.map(k => p.changes[k]),p.id);
      audit.run(p.id,p.platform === 'instagram' ? 'meta_caption' : 'meta_message',p.confidence,p.rationale);
    }
    // Meta no devolvió texto para estas seis piezas de Facebook. El idioma
    // importado como "es" era un default técnico, no un dato observado.
    db.prepare(`UPDATE posts SET idioma='sin_clasificar'
      WHERE id IN (${skipped.map(() => '?').join(',')}) AND titulo='Sin título' AND idioma='es'`).run(...skipped);
  })();
  console.log(`Aplicado. Respaldo: ${backup}`);
  db.close();
}

main().catch(e => { console.error(e.message); process.exitCode = 1; });
