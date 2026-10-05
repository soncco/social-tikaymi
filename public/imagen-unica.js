/* Renderer independiente: una publicación, un lienzo y un único PNG. */
let current, generatedId, originalContent, renderSequence=0, visualRepairUsed=false;
let approvedContext={resources:[],testimonials:[],attributions:[]}, approvedPhotos=[];
const node = document.getElementById('canvas'), statusNode = document.getElementById('status');
const preview = document.querySelector('.preview'), previewFrame = document.getElementById('preview-frame');
function fitPreview(){
  const style=getComputedStyle(preview), available=preview.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
  const scale=Math.min(.72,Math.max(.15,available/1080));
  previewFrame.style.width=(1080*scale)+'px';previewFrame.style.height=(1350*scale)+'px';
  node.style.setProperty('--preview-scale',scale);
}
new ResizeObserver(fitPreview).observe(preview);fitPreview();
function textElement(tag, text) { const el=document.createElement(tag); el.textContent=text || ''; return el; }
const LABELS={es:{producto:'Viajes a medida',informativo:'Guía práctica',testimonio:'Experiencia viajera',photo:'Fotografía necesaria',photoNote:'Elige una foto autorizada de la biblioteca'},
  en:{producto:'Tailor-made travel',informativo:'Practical guide',testimonio:'Traveler experience',photo:'Photo needed',photoNote:'Choose an approved photo from the library'}};
const RIDGE='M2 24 L44 8 L62 16 L86 2 L120 20 L148 12 L198 24';
function div(className,...children){const el=document.createElement('div');el.className=className;el.append(...children);return el;}
function photoBlock(url,lang,className=''){
  if(url){const img=div('t-photo-img');img.style.backgroundImage=`url("${url.replace(/"/g,'%22')}")`;img.setAttribute('role','img');return div(('t-photo '+className).trim(),img);}
  const note=div('t-ph-note');note.append(textElement('b',LABELS[lang].photo),document.createTextNode(LABELS[lang].photoNote));return div(('t-ph '+className).trim(),note);
}
function ridge(margin){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','t-ridge');svg.setAttribute('viewBox','0 0 200 26');svg.style.marginTop=margin+'px';const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',RIDGE);svg.appendChild(path);return svg;}
function footBlock(onPhoto){
  const logo=document.createElement('img');logo.className='t-logo'+(onPhoto?' on-photo':'');logo.src='tikaymi-logo.png';logo.alt='Tikaymi Travel';
  const site=textElement('span','tikaymi.com');site.className='t-site'+(onPhoto?' on-dark':'');
  const foot=div('t-foot',logo,site);foot.dataset.safeZone='true';return foot;
}
function ctaBlock(text,margin){if(!text?.trim())return null;const cta=textElement('span',text);cta.className='t-cta';cta.style.marginTop=margin+'px';return cta;}
function ridgeRow(ctaText,margin){const row=div('t-ridge-row');row.style.marginTop=margin+'px';row.append(ridge(0));const cta=ctaBlock(ctaText,0);if(cta)row.appendChild(cta);return row;}
function withClass(el,className,style={}){el.className=className;Object.assign(el.style,style);return el;}
// Mismas plantillas del constructor: producto → Portada foto a sangre, informativo → Portada editorial, testimonio → Cita.
function renderTemplate(data,url){
  const lang=data.idioma==='en'?'en':'es', label=LABELS[lang][data.tipo] || 'Tikaymi', v=data.visual || {};
  if(data.tipo==='informativo'){
    const top=div('t-editorial');
    const head=div('',withClass(textElement('span',label),'t-badge'));
    top.append(head,withClass(div(''),'t-rule',{marginTop:'38px'}),withClass(textElement('h1',v.headline),'t-h1',{marginTop:'44px'}));
    if(v.support)top.appendChild(withClass(textElement('p',v.support),'t-body',{marginTop:'32px'}));
    top.appendChild(ridgeRow(v.visualCta,40));
    node.append(top,photoBlock(url,lang,'t-editorial-photo'),footBlock(false));
    return;
  }
  node.appendChild(div('t-full',photoBlock(url,lang)));
  node.appendChild(div('t-overlay'));
  const bottom=div('t-bottom');
  if(data.tipo==='testimonio'){
    bottom.append(withClass(textElement('span',v.headline || label),'t-eyebrow on-dark'),withClass(textElement('div','“'),'t-quote-mark',{marginTop:'40px'}),withClass(textElement('p',v.support),'t-quote'));
    if(data.testimonial?.by)bottom.appendChild(withClass(textElement('div',data.testimonial.by),'t-by'));
  } else {
    bottom.append(withClass(textElement('span',label),'t-eyebrow on-dark'),withClass(textElement('h1',v.headline),'t-h1',{marginTop:'26px',color:'#fff'}));
    if(v.support)bottom.appendChild(withClass(textElement('p',v.support),'t-body on-dark',{marginTop:'32px'}));
    bottom.appendChild(ridgeRow(v.visualCta,42));
  }
  if(data.tipo==='testimonio' && v.visualCta?.trim())bottom.appendChild(ctaBlock(v.visualCta,36));
  node.append(bottom,footBlock(true));
}
function showPending(items){
  const card=document.getElementById('pending-card'),list=document.getElementById('pending-summary');
  list.replaceChildren(...items.map(x=>textElement('li',String(x).replace(/^\[FALTA DATO:\s*|\]$/g,''))));
  card.hidden=!items.length;
}
async function loadApprovals(){
  const responses=await Promise.all([fetch('/api/assets'),fetch('/api/approved-info')]);
  if(responses.some(res=>!res.ok))throw new Error('Inicia sesión para comprobar recursos y testimonios autorizados');
  const [assets,info]=await Promise.all(responses.map(res=>res.json()));
  approvedPhotos=assets.filter(x=>x.tipo==='foto' && x.autorizado_publicar);
  const testimonials=info.filter(x=>x.tipo==='testimonio' && x.autorizado_publicar);
  approvedContext={resources:approvedPhotos.map(x=>x.url),testimonials:testimonials.map(x=>x.texto),attributions:testimonials.map(x=>x.titulo)};
  const select=document.getElementById('photo');select.replaceChildren(new Option('— Fotografía pendiente —',''));
  approvedPhotos.forEach(x=>select.add(new Option(x.descripcion || x.destino || x.url,x.url)));
  select.value=current?.resource?.url || '';
}
async function show(data, approvals=approvedContext, options={}) {
  if(!data || typeof data!=='object' || Array.isArray(data))throw new Error('El archivo debe contener un objeto con el contrato de imagen única');
  const previewOnly=!!options.previewOnly;
  const sequence=++renderSequence;
  if(!previewOnly)current=data;
  for(const field of ['headline','support','visualCta'])document.getElementById(field).value=data.visual?.[field] || '';
  document.getElementById('alt').value=data.alt || '';
  document.getElementById('pending-data').value=Array.isArray(data.pending)?data.pending.join('\n'):'';
  document.getElementById('download').disabled=true;
  const validation=TikaymiVisual.validateSingle(data, approvals);
  document.getElementById('photo').value=data.resource?.url || '';
  document.getElementById('photo-url').value=data.resource?.url || '';
  node.replaceChildren(); node.className='canvas '+data.tipo;
  const url=data.resource?.url || '';
  if(url){
    // Precarga para detectar URL rota o sin CORS; el lienzo usa background-image como el constructor (html2canvas respeta cover).
    const probe=new Image();probe.crossOrigin='anonymous';
    const loaded=new Promise(resolve=>{const timer=setTimeout(()=>resolve(false),10000);probe.onload=()=>{clearTimeout(timer);resolve(true);};probe.onerror=()=>{clearTimeout(timer);resolve(false);};});
    probe.src=url;
    if(!await loaded)validation.errors.push('No se pudo cargar la fotografía. Revisa URL y permisos CORS.');
    if(sequence!==renderSequence)return;
  }
  renderTemplate(data,url);
  showPending([...validation.pending]);
  if (document.fonts) await document.fonts.ready;
  if(sequence!==renderSequence)return;
  const render=TikaymiVisual.validateRender(node);
  const errors=[...validation.errors,...validation.pending,...render.errors];
  statusNode.textContent=previewOnly
    ? 'Vista previa actualizada. Guarda los cambios para validarlos antes de descargar.'+(errors.length?' Pendientes: '+errors.join(' · '):'')
    : errors.length ? 'Revisión pendiente: '+errors.join(' · ') : 'Composición comprobada. Confirma tu revisión humana para descargar.';
  document.getElementById('download').disabled=previewOnly || errors.length>0;
  if(generatedId && !previewOnly) {
    const res=await fetch('/api/generated/'+generatedId+'/render-validation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contenido:originalContent,errors})});
    if(!res.ok){document.getElementById('download').disabled=true;statusNode.textContent=(await res.json()).error;}
    const key='visual-repair-'+generatedId;
    if(render.errors.length && !visualRepairUsed && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key,'1');statusNode.textContent='El texto no cabe. Intentando una versión más breve una vez…';
      const repaired=await fetch('/api/generated/'+generatedId+'/regenerate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({segmento:'pieza',automatic_visual_repair:true,instruccion:'Acorta exclusivamente los textos que no caben. Conserva fotografía, mensaje, idioma y CTA. Errores: '+render.errors.join('; ')})});
      if(repaired.ok){location.reload();return;}statusNode.textContent='Revisión fallida: '+(await repaired.json()).error;
    }
  }
  const copies=document.getElementById('copies'); copies.replaceChildren();
  for(const copy of data.copies || []) copies.append(textElement('h3',copy.plataforma),textElement('pre',copy.text));
}
document.getElementById('file').onchange=async e=>{ try { generatedId=null; await loadApprovals(); await show(JSON.parse(await e.target.files[0].text())); } catch(err){document.getElementById('download').disabled=true;statusNode.textContent=err.message;} };
let previewTimer;
function updateLivePreview(){
  clearTimeout(previewTimer);document.getElementById('download').disabled=true;
  if(!current){statusNode.textContent='Carga un borrador para iniciar la vista previa.';return;}
  statusNode.textContent='Actualizando vista previa…';
  previewTimer=setTimeout(()=>{
    const draft=structuredClone(current),url=document.getElementById('photo-url').value.trim();
    draft.resource={url,pending:url?'':'Fotografía aprobada pendiente'};
    draft.visual=Object.fromEntries(['headline','support','visualCta'].map(field=>[field,document.getElementById(field).value.trim()]));
    draft.alt=document.getElementById('alt').value.trim();
    draft.pending=document.getElementById('pending-data').value.split('\n').map(x=>x.trim()).filter(x=>x && x!=='Fotografía aprobada pendiente');
    if(!url)draft.pending.push('Fotografía aprobada pendiente');
    show(draft,approvedContext,{previewOnly:true}).catch(err=>{statusNode.textContent='No se pudo actualizar la vista previa: '+err.message;});
  },450);
}
for(const field of ['photo-url','headline','support','visualCta','alt','pending-data'])document.getElementById(field).addEventListener('input',updateLivePreview);
document.getElementById('photo').addEventListener('change',e=>{document.getElementById('photo-url').value=e.target.value;updateLivePreview();});
document.getElementById('save-photo').onclick=async()=>{
  try {
    if(!current)throw new Error('Abre primero una pieza');
    const url=document.getElementById('photo-url').value.trim() || document.getElementById('photo').value;
    await loadApprovals();
    if(url && !approvedContext.resources.includes(url))throw new Error('La fotografía ya no está autorizada');
    const next=structuredClone(current);next.resource={url,pending:url?'':'Fotografía aprobada pendiente'};
    next.visual=Object.fromEntries(['headline','support','visualCta'].map(field=>[field,document.getElementById(field).value.trim()]));
    next.alt=document.getElementById('alt').value.trim();
    next.pending=document.getElementById('pending-data').value.split('\n').map(x=>x.trim()).filter(x=>x && x!=='Fotografía aprobada pendiente');
    if(!url)next.pending.push('Fotografía aprobada pendiente');
    if(generatedId){
      const res=await fetch('/api/generated/'+generatedId+'/edit',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({contenido:JSON.stringify(next,null,2),segmento:'pieza',motivo:'Corrección humana de foto, texto o pendientes en revisión visual'})});
      if(!res.ok)throw new Error((await res.json()).error);
      location.reload();return;
    }
    await show(next);
  }catch(err){statusNode.textContent=err.message;document.getElementById('download').disabled=true;}
};
document.getElementById('download').onclick=async()=>{
  try {
    await loadApprovals();
    const contract=TikaymiVisual.validateSingle(current,approvedContext);
    if(!contract.ready)throw new Error([...contract.errors,...contract.pending].join(' · '));
    const result=TikaymiVisual.validateRender(node);
    if(!result.ok || !current.resource?.url) throw new Error(result.errors.join(' · ') || 'Falta fotografía');
    if(!confirm('¿Confirmas que revisaste la fotografía, textos, CTA e idioma?')) return;
    const oldTransform=node.style.transform;node.style.transform='none';
    let canvas;try{canvas=await html2canvas(node,{useCORS:true,allowTaint:false,scale:1,width:1080,height:1350});}finally{node.style.transform=oldTransform;}
    canvas.toBlob(blob=>{ if(!blob){statusNode.textContent='No se pudo crear el PNG.';return;} const a=document.createElement('a'); a.download='tikaymi-imagen-unica.png'; a.href=URL.createObjectURL(blob); a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); });
  } catch(err){statusNode.textContent=err.message;}
};
(async()=>{const id=new URLSearchParams(location.search).get('id'); if(!id)return; try {await loadApprovals();const res=await fetch('/api/generated'); if(!res.ok)throw new Error('Inicia sesión en Tikaymi Lab'); const item=(await res.json()).find(x=>String(x.id)===id); if(!item)throw new Error('Borrador inexistente'); generatedId=id; originalContent=item.contenido; visualRepairUsed=!!item.visual_repair_used; await show(JSON.parse(item.contenido));}catch(err){statusNode.textContent=err.message;}})();
