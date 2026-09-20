const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { open } = require('./db');
const { makeAuth } = require('./modules/auth');
const { api } = require('./api');

// Carga .env sin dependencias extra
try { process.loadEnvFile(path.join(__dirname, '../.env')); } catch {}

function createApp(db, auth) {
  const app = express();
  app.use(express.json({ limit: '2mb' }), cookieParser());
  app.post('/api/login', (q, r) => auth.login(q, r));
  app.post('/api/logout', (q, r) => auth.logout(q, r));
  app.use('/api', auth.require, api(db));
  app.use((err, req, res, next) => {
    console.error(new Date().toISOString(), req.method, req.url, err.message);
    res.status(err.status || 500).json({ error: err.message });
  });
  app.use(express.static(path.join(__dirname, '../public')));
  return app;
}

if (require.main === module) {
  const auth = makeAuth({ password: process.env.ADMIN_PASSWORD, secret: process.env.SESSION_SECRET });
  const port = process.env.PORT || 3000;
  createApp(open(), auth).listen(port, () => console.log(`Tikaymi Lab en http://localhost:${port}`));
}
module.exports = { createApp };
