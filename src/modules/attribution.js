// Enlaces rastreables por publicación (Inicial.MD §5). No inventa datos: solo compone URLs y textos.
const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

function buildLinks({ campaign_code, plataforma, site_url, whatsapp }) {
  if (!campaign_code) throw Object.assign(new Error('campaign_code es obligatorio'), { status: 400 });
  const code = String(campaign_code).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const out = { campaign_code: code, keyword_whatsapp: `${code} + fecha de viaje + número de viajeros` };
  if (site_url) {
    const u = new URL(site_url);
    u.searchParams.set('utm_source', slug(plataforma) || 'social');
    u.searchParams.set('utm_medium', 'social');
    u.searchParams.set('utm_campaign', slug(code));
    out.url_sitio = u.toString();
  }
  if (whatsapp) {
    const n = String(whatsapp).replace(/\D/g, '');
    out.url_whatsapp = `https://wa.me/${n}?text=${encodeURIComponent(code + ' ')}`;
  }
  return out;
}
module.exports = { buildLinks };
