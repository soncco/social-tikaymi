const test = require('node:test');
const assert = require('node:assert');
const { carouselExport, reportMarkdown } = require('../src/modules/export');
const { open } = require('../src/db');

test('export carrusel respeta esquema del constructor', () => {
  const o = carouselExport({ tipo: 'informativo', slides: [{ layout: 'portada', data: { h1: 'x' } }, { layout: 'cierre' }] });
  assert.equal(o.app, 'tikaymi-constructor-carruseles');
  assert.equal(o.version, 1);
  assert.throws(() => carouselExport({ tipo: 'informativo', slides: [{ layout: 'ficha' }] }), /layout inválido/);
  assert.throws(() => carouselExport({ tipo: 'x', slides: [{}] }), /tipo/);
});

test('carrusel corrige el alias frecuente bueno-saber-lo', () => {
  const o = carouselExport({ tipo:'producto', slides:[{ layout:'bueno-saber-lo', data:{ titulo:'x' } }] });
  assert.equal(o.slides[0].layout, 'bueno-saberlo');
});

test('carrusel adapta campos genéricos de una respuesta antigua de IA', () => {
  const o = carouselExport({ tipo:'producto', slides:[
    { layout:'portada', data:{ titulo:'Título', texto:'Texto' } },
    { layout:'ficha', data:{ titulo:'Ficha', texto:'Detalle' } },
    { layout:'itinerario', data:{ titulo:'Días', texto:'Día 1: llegada' } },
    { layout:'bueno-saberlo', data:{ titulo:'Nota', texto:'Reserva antes' } },
  ] });
  assert.equal(o.slides[0].data.h1, 'Título');
  assert.equal(o.slides[1].data.h2, 'Ficha');
  assert.equal(o.slides[1].data.body, 'Detalle');
  assert.deepEqual(o.slides[2].data.route, [{ d:'Itinerario', t:'Día 1: llegada' }]);
  assert.deepEqual(o.slides[3].data.notes, [{ title:'Nota', text:'Reserva antes' }]);
});

test('informe sin datos declara insuficiencia', () => {
  const md = reportMarkdown(open(':memory:'));
  assert.match(md, /datos_insuficientes/);
  assert.match(md, /Sin datos/);
});
