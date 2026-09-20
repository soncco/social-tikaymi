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

test('informe sin datos declara insuficiencia', () => {
  const md = reportMarkdown(open(':memory:'));
  assert.match(md, /datos_insuficientes/);
  assert.match(md, /Sin datos/);
});
