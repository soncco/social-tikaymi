const meta = require('./meta');
const tiktok = require('./tiktok');
const youtube = require('./youtube');

const adapters = { meta, tiktok, youtube };

function getAdapter(plataforma) {
  if (plataforma === 'instagram' || plataforma === 'facebook') return meta;
  if (plataforma === 'tiktok') return tiktok;
  if (plataforma === 'youtube_shorts') return youtube;
  return null;
}

module.exports = { adapters, getAdapter };
