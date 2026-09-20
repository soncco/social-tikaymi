const crypto = require('crypto');

// Contraseña única desde variables de entorno + cookie firmada (HMAC). Sin credenciales en código.
const sign = (v, secret) => v + '.' + crypto.createHmac('sha256', secret).update(v).digest('hex');
const safeEq = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

function makeAuth({ password, secret }) {
  if (!password || !secret) throw new Error('Define ADMIN_PASSWORD y SESSION_SECRET en .env');
  return {
    login(req, res) {
      if (!safeEq(String(req.body.password || ''), password)) return res.status(401).json({ error: 'Contraseña incorrecta' });
      res.cookie('session', sign('admin', secret), { httpOnly: true, sameSite: 'lax', maxAge: 7 * 864e5 });
      res.json({ ok: true });
    },
    logout(req, res) { res.clearCookie('session'); res.json({ ok: true }); },
    require(req, res, next) {
      const c = req.cookies.session;
      if (c && safeEq(c, sign('admin', secret))) return next();
      res.status(401).json({ error: 'No autenticado' });
    },
  };
}
module.exports = { makeAuth };
