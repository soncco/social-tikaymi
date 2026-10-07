(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TikaymiVisual = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const limits = {
    single: { headline:8, support:12, visualCta:5 },
    cover: { h1:8, body:12 },
    interior: { h2:10, body:25 },
    lists: { meta:4, route:5, photos:3, items:5, notes:3, steps:4, facts:3, qas:3 },
    item: { title:8, text:12, t:12, d:4, k:5, v:8, q:10, a:15 },
    charactersPerWord: 16,
  };
  const words = x => String(x || '').trim().split(/\s+/).filter(Boolean).length;
  // Fotos subidas a la cuenta Cloudinary de Tikaymi. Solo /image/upload/: /image/fetch/ reenviaría cualquier URL externa.
  const CLOUDINARY_PHOTO_BASE = 'https://res.cloudinary.com/tikaymi/image/upload/';
  function isCloudinaryPhoto(url) {
    try { const u = new URL(String(url || '')); return u.protocol === 'https:' && u.hostname === 'res.cloudinary.com' && u.pathname.startsWith('/tikaymi/image/upload/') && u.pathname.length > 22; }
    catch { return false; }
  }
  // Una persona puede pegar una foto de Cloudinary sin registrarla antes, salvo que se haya retirado en Biblioteca.
  function photoAllowed(url, options = {}) {
    if (options.resources?.includes(url)) return true;
    return !!options.allowCloudinary && isCloudinaryPhoto(url) && !options.revoked?.includes(url);
  }
  function validateSingle(x, options = {}) {
    const errors = [], pending = Array.isArray(x?.pending) ? x.pending.filter(v=>typeof v==='string' && v.trim()) : [];
    if (x?.format !== 'imagen_unica' || x?.version !== 1) errors.push('format/version: requiere imagen_unica versión 1');
    if (!['producto','informativo','testimonio'].includes(x?.tipo)) errors.push('tipo: producto, informativo o testimonio');
    for (const field of ['headline','support','visualCta']) {
      if (typeof x?.visual?.[field] !== 'string') errors.push(`visual.${field}: debe ser texto`);
      if (words(x?.visual?.[field]) > (options.limits || limits.single)[field]) errors.push(`visual.${field}: máximo ${(options.limits || limits.single)[field]} palabras`);
      if (String(x?.visual?.[field] || '').length > (options.limits || limits.single)[field] * limits.charactersPerWord) errors.push(`visual.${field}: excede el límite de caracteres`);
    }
    const nonEmpty = v => typeof v === 'string' && v.trim().length > 0;
    if (!nonEmpty(x?.visual?.headline)) errors.push('visual.headline: obligatorio');
    if (!nonEmpty(x?.alt)) errors.push('alt: texto alternativo obligatorio');
    if (!['es','en'].includes(x?.idioma)) errors.push('idioma: es o en');
    if (!['instagram','facebook','tiktok','youtube_shorts'].includes(x?.plataforma)) errors.push('plataforma: inválida');
    if (!nonEmpty(x?.cta?.text)) errors.push('cta.text: obligatorio');
    if (typeof x?.cta?.destination !== 'string') errors.push('cta.destination: debe ser texto (vacío si pendiente)');
    for (const field of ['warnings','pending']) if (!Array.isArray(x?.[field]) || x[field].some(v=>typeof v!=='string')) errors.push(`${field}: requiere una lista de textos`);
    if (x?.slides != null) errors.push('slides: imagen única no es un carrusel');
    if(x?.copies!=null && (!Array.isArray(x.copies) || x.copies.some(copy=>!['instagram','facebook','tiktok','youtube_shorts'].includes(copy?.plataforma) || copy?.idioma!==x.idioma || !nonEmpty(copy?.text))))errors.push('copies: requiere textos por plataforma, en el idioma de la pieza');
    if (typeof x?.resource?.url !== 'string') errors.push('resource.url: debe ser texto (vacío si pendiente)');
    if (!x?.resource?.url) pending.push('Fotografía aprobada pendiente');
    if (x?.resource?.url && options.resources && !photoAllowed(x.resource.url, options)) errors.push('resource.url: recurso no autorizado');
    if (x?.tipo === 'testimonio' && (!x?.testimonial?.quote || !options.testimonials?.includes(x.testimonial.quote) || x.visual?.support !== x.testimonial.quote)) errors.push('testimonial.quote: requiere testimonio literal aprobado idéntico al apoyo visual');
    if (x?.testimonial?.by && options.attributions && !options.attributions.includes(x.testimonial.by)) errors.push('testimonial.by: atribución no autorizada');
    return { ok:!errors.length, errors, pending:[...new Set(pending)], ready:!errors.length && !pending.length };
  }
  function validateCarousel(x) {
    const errors = [];
    if (!Array.isArray(x?.slides)) return {ok:false,errors:['slides: requiere una lista']};
    for (const [i,s] of x.slides.entries()) {
      const d = s?.data || {}, cover = String(s?.layout || '').startsWith('portada');
      const check = (field,n,value=d[field]) => { if (value != null && (typeof value !== 'string' || words(value)>n || value.length>n*limits.charactersPerWord)) errors.push(`diapositiva ${i+1} (${s?.layout}).${field}: máximo ${n} palabras y ${n*limits.charactersPerWord} caracteres de texto`); };
      for (const [key,n] of Object.entries(cover ? limits.cover : limits.interior)) check(key,n);
      check('eyebrow',5); check('ctaText',5); check('quote',25);
      for (const [key,n] of Object.entries({badge:5,caption:8,swipe:5,by:8,beforeTag:5,afterTag:5,panelLabel:5,panelText:25,contact:12})) check(key,n);
      for (const [key,max] of Object.entries(limits.lists)) if (d[key] != null) {
        if (!Array.isArray(d[key]) || d[key].length>max) { errors.push(`diapositiva ${i+1}.${key}: máximo ${max} elementos`); continue; }
        d[key].forEach((item,j) => {
          if (typeof item === 'string') check(`${key}[${j}]`,12,item);
          else for (const [field,n] of Object.entries(limits.item)) if (item?.[field] != null) check(`${key}[${j}].${field}`,n,item[field]);
        });
      }
      for (const col of ['colA','colB']) if (d[col]) {
        check(`${col}.heading`,5,d[col].heading);
        if (!Array.isArray(d[col].items) || d[col].items.length>3) errors.push(`diapositiva ${i+1}.${col}: máximo 3 elementos`);
        else d[col].items.forEach((v,j)=>check(`${col}[${j}]`,12,v));
      }
    }
    return { ok:!errors.length, errors };
  }
  function validateRender(node) {
    const errors = [], bounds = node.getBoundingClientRect();
    const protectedNodes = [...node.querySelectorAll('.foot,.logo,[data-safe-zone]')];
    const overlap = (a,b) => a.left<b.right-1 && a.right>b.left+1 && a.top<b.bottom-1 && a.bottom>b.top+1;
    for (const el of node.querySelectorAll('*')) {
      if (!el.textContent.trim() || ![...el.childNodes].some(n=>n.nodeType===3 && n.textContent.trim())) continue;
      const rect=el.getBoundingClientRect(), view=el.ownerDocument?.defaultView;
      // Las tipografías display (line-height ≤ 1) desbordan su caja sin cortarse; solo cuenta si el propio elemento recorta.
      const own=view?view.getComputedStyle(el):null, clipsY=!own || /hidden|clip|auto|scroll/.test(own.overflowY), clipsX=!own || /hidden|clip|auto|scroll/.test(own.overflowX);
      if (clipsY && el.scrollHeight>el.clientHeight+2 || clipsX && el.scrollWidth>el.clientWidth+2 || rect.left<bounds.left-1 || rect.right>bounds.right+1 || rect.top<bounds.top-1 || rect.bottom>bounds.bottom+1) errors.push(`Texto fuera del lienzo o cortado: ${el.textContent.trim().slice(0,60)}`);
      for (const safe of protectedNodes) if (!safe.contains(el) && !el.contains(safe) && overlap(rect,safe.getBoundingClientRect())) errors.push(`Texto se solapa con logo/pie: ${el.textContent.trim().slice(0,60)}`);
      if(view)for(let parent=el.parentElement;parent && parent!==node;parent=parent.parentElement){
        const css=view.getComputedStyle(parent),box=parent.getBoundingClientRect();
        if(/hidden|clip/.test(css.overflowY) && (rect.top<box.top-1 || rect.bottom>box.bottom+1) || /hidden|clip/.test(css.overflowX) && (rect.left<box.left-1 || rect.right>box.right+1))errors.push(`Texto cortado por su contenedor: ${el.textContent.trim().slice(0,60)}`);
      }
    }
    return { ok:!errors.length, errors:[...new Set(errors)] };
  }
  function formatRecommendation(analysis) {
    const labels={imagen_unica:'Imagen única',imagen:'Imagen única',foto:'Imagen única',carrusel:'Carrusel',carousel:'Carrusel',reel:'Reel/video',reels:'Reel/video',video:'Reel/video'};
    const candidates=Object.entries(analysis?.por_formato || {}).filter(([key,x])=>labels[key] && x.plataformas?.length===1 && x.n>=5 && x.negocio?.consultas>=3 && x.confianza!=='datos_insuficientes');
    const fallback='Hipótesis editorial: imagen única para una idea de un vistazo; carrusel para pasos o comparaciones; video para movimiento o voz. No hay base comparable suficiente para recomendar un ganador.';
    if(new Set(candidates.map(([key])=>labels[key])).size<2 || new Set(candidates.map(([,x])=>x.plataformas[0])).size!==1)return fallback;
    candidates.sort((a,b)=>b[1].negocio.consultas/b[1].n-a[1].negocio.consultas/a[1].n);
    const [key,x]=candidates[0];
    return `Sugerencia exploratoria: ${labels[key]}. Registró ${x.negocio.consultas} consultas atribuidas en ${x.n} publicaciones en ${x.plataformas[0]}, la mayor razón consultas/publicación entre formatos con muestra suficiente. No prueba causalidad ni tasa de conversión; revisa audiencia, tema y período. Tu selección no cambia.`;
  }
  return { limits, words, CLOUDINARY_PHOTO_BASE, isCloudinaryPhoto, photoAllowed, validateSingle, validateCarousel, validateRender, formatRecommendation };
});
