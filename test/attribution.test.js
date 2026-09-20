const test = require('node:test');
const assert = require('node:assert');
const { buildLinks } = require('../src/modules/attribution');
test('enlaces con UTM y WhatsApp', () => {
  const l = buildLinks({ campaign_code: 'humantay', plataforma: 'instagram', site_url: 'https://tikaymi.com/tours', whatsapp: '+51 900 000 000' });
  assert.match(l.url_sitio, /utm_source=instagram/);
  assert.match(l.url_whatsapp, /text=HUMANTAY/);
  assert.throws(() => buildLinks({}), /obligatorio/);
});
