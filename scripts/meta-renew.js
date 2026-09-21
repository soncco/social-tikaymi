// Renueva META_ACCESS_TOKEN (larga duración) y lo reescribe en .env sin imprimirlo.
// Uso: npm run meta:renew   (idealmente antes de que falten 7 días; ver el aviso de la pestaña Sincronizar)
const fs = require('fs');
const path = require('path');
const ENV = path.join(__dirname, '../.env');
try { process.loadEnvFile(ENV); } catch {}
const meta = require('../src/adapters/meta');

(async () => {
  const r = await meta.renewToken();
  if (!r.ok) { console.error(`No se pudo renovar: ${r.code}${r.message ? ' — ' + r.message : ''}`); process.exit(1); }
  let txt = fs.readFileSync(ENV, 'utf8');
  txt = /^META_ACCESS_TOKEN=.*$/m.test(txt)
    ? txt.replace(/^META_ACCESS_TOKEN=.*$/m, () => 'META_ACCESS_TOKEN=' + r.access_token)
    : txt.replace(/\n*$/, '\n') + 'META_ACCESS_TOKEN=' + r.access_token + '\n';
  fs.writeFileSync(ENV, txt);
  process.env.META_ACCESS_TOKEN = r.access_token;
  const st = await meta.tokenStatus();
  console.log('Token renovado y guardado en .env.', st.expires_at ? `Vigente hasta ${st.expires_at.slice(0, 10)} (${st.dias_restantes} días).` : '');
})();
