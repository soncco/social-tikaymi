/* Renderer independiente: una publicación, un lienzo y un único PNG. */
let current, generatedId, originalContent, renderSequence=0, visualRepairUsed=false;
let approvedContext={resources:[],allowCloudinary:true,revoked:[],testimonials:[],attributions:[]}, approvedPhotos=[];
const node = document.getElementById('canvas'), statusNode = document.getElementById('status');
const preview = document.querySelector('.preview'), previewFrame = document.getElementById('preview-frame');
function fitPreview(){
  const style=getComputedStyle(preview), available=preview.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
  const scale=Math.min(.72,Math.max(.15,available/1080));
  previewFrame.style.width=(1080*scale)+'px';previewFrame.style.height=((node.classList.contains('story')?1920:1350)*scale)+'px';
  node.style.setProperty('--preview-scale',scale);
}
new ResizeObserver(fitPreview).observe(preview);fitPreview();
function textElement(tag, text) { const el=document.createElement(tag); el.textContent=text || ''; return el; }
const LABELS={es:{producto:'Viajes a medida',informativo:'Guía práctica',testimonio:'Experiencia viajera',photo:'Fotografía necesaria',photoNote:'Pega una foto de Cloudinary'},
  en:{producto:'Tailor-made travel',informativo:'Practical guide',testimonio:'Traveler experience',photo:'Photo needed',photoNote:'Paste a Cloudinary photo'}};
// Silueta de la montaña del logo de Tikaymi (pico menor, pico mayor y su pliegue).
const RIDGE=['M3 61 L19 38 L35 54 L42 44 L47 47 L53 41 L60 42 L91 3 L130 32 L134 31 L157 61','M60 42 L77 52 L92 5'];
function div(className,...children){const el=document.createElement('div');el.className=className;el.append(...children);return el;}
function photoBlock(url,lang,className=''){
  if(url){const img=div('t-photo-img');img.style.backgroundImage=`url("${url.replace(/"/g,'%22')}")`;img.setAttribute('role','img');return div(('t-photo '+className).trim(),img);}
  const note=div('t-ph-note');note.append(textElement('b',LABELS[lang].photo),document.createTextNode(LABELS[lang].photoNote));return div(('t-ph '+className).trim(),note);
}
function ridge(margin){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','t-ridge');svg.setAttribute('viewBox','0 0 160 64');svg.style.marginTop=margin+'px';for(const d of RIDGE){const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);svg.appendChild(path);}return svg;}
function footBlock(onPhoto){
  const logo=document.createElement('img');logo.className='t-logo'+(onPhoto?' on-photo':'');logo.src='tikaymi-logo.png';logo.alt='Tikaymi Travel';
  const site=textElement('span','tikaymi.com');site.className='t-site'+(onPhoto?' on-dark':'');
  const foot=div('t-foot',logo,site);foot.dataset.safeZone='true';return foot;
}
function ctaBlock(text,margin){if(!text?.trim())return null;const cta=textElement('span',text);cta.className='t-cta';cta.style.marginTop=margin+'px';return cta;}
function ridgeRow(ctaText,margin,decoration=true){const row=div('t-ridge-row');row.style.marginTop=margin+'px';if(decoration)row.append(ridge(0));const cta=ctaBlock(ctaText,0);if(cta)row.appendChild(cta);return row;}
function withClass(el,className,style={}){el.className=className;Object.assign(el.style,style);return el;}
function isSingleExportWarning(error){return /^visual\.(headline|support|visualCta|price): (máximo|excede el límite)/.test(error);}
function singleLayoutWarnings(data,element=node,contractWarnings=[]){
  const warnings=[...contractWarnings,...TikaymiVisual.validateRender(element).errors];
  if(data.visual?.aspect==='9:16'){
    const bounds=element.getBoundingClientRect(),top=bounds.top+bounds.height*Number(data.visual?.safeTop??12)/100,bottom=bounds.bottom-bounds.height*Number(data.visual?.safeBottom??18)/100;
    for(const el of element.querySelectorAll('.t-h1,.t-body,.t-cta,.t-price,.t-logo,.t-site,.t-quote')){const r=el.getBoundingClientRect();if(r.top<top-2||r.bottom>bottom+2)warnings.push(`Story: ${el.className} invade una zona orientativa cubierta por la interfaz`);}
  }
  if(['producto','testimonio'].includes(data.tipo)&&Number(data.visual?.overlayStrength??70)<55)warnings.push('Contraste: aumenta el oscurecimiento detrás del texto para revisarlo a tamaño de teléfono');
  return [...new Set(warnings)];
}
// Precio del anuncio: etiqueta con borde lima, solo si una persona lo indicó.
function priceTag(text,margin,onDark){return text?.trim()?withClass(textElement('span',text.trim()),'t-price'+(onDark?' on-dark':''),{marginTop:margin+'px'}):null;}
const appendIf=(parent,el)=>{if(el)parent.appendChild(el);};
// Mismas plantillas del constructor: producto → Portada foto a sangre, informativo → Portada editorial, testimonio → Cita.
function renderTemplate(data,url){
  const lang=data.idioma==='en'?'en':'es', label=LABELS[lang][data.tipo] || 'Tikaymi', v=data.visual || {};
  if(data.tipo==='informativo'){
    const top=div('t-editorial');
    const head=div('',withClass(textElement('span',label),'t-badge'));
    top.append(head,withClass(div(''),'t-rule',{marginTop:'38px'}),withClass(textElement('h1',v.headline),'t-h1',{marginTop:'44px'}));
    if(v.support)top.appendChild(withClass(textElement('p',v.support),'t-body',{marginTop:'32px'}));
    appendIf(top,priceTag(v.price,32,false));
    top.appendChild(ridgeRow(v.visualCta,40,v.decoration!==false));
    node.append(top,photoBlock(url,lang,'t-editorial-photo'),footBlock(false));
    return;
  }
  node.appendChild(div('t-full',photoBlock(url,lang)));
  const overlay=div('t-overlay');
  const shade=Math.min(100,Math.max(0,Number(v.overlayStrength??70)))/100;
  overlay.style.background=`linear-gradient(to top,rgba(10,30,29,${(.42+.52*shade).toFixed(2)}) 0%,rgba(10,30,29,${(.12+.62*shade).toFixed(2)}) 48%,rgba(10,30,29,${(.04+.22*shade).toFixed(2)}) 100%)`;
  node.appendChild(overlay);
  const bottom=div('t-bottom');
  if(data.tipo==='testimonio'){
    bottom.append(withClass(textElement('span',v.headline || label),'t-eyebrow on-dark'),withClass(textElement('div','“'),'t-quote-mark',{marginTop:'40px'}),withClass(textElement('p',v.support),'t-quote'));
    if(data.testimonial?.by)bottom.appendChild(withClass(textElement('div',data.testimonial.by),'t-by'));
  } else {
    bottom.append(withClass(textElement('span',label),'t-eyebrow on-dark'),withClass(textElement('h1',v.headline),'t-h1',{marginTop:'26px',color:'#fff'}));
    if(v.support)bottom.appendChild(withClass(textElement('p',v.support),'t-body on-dark',{marginTop:'32px'}));
    appendIf(bottom,priceTag(v.price,32,true));
    bottom.appendChild(ridgeRow(v.visualCta,42,v.decoration!==false));
  }
  if(data.tipo==='testimonio' && v.visualCta?.trim())bottom.appendChild(ctaBlock(v.visualCta,36));
  node.append(bottom,footBlock(true));
}
const PHOTO_PENDING='Fotografía aprobada pendiente';
// Cada pendiente se resuelve aquí mismo: la foto en el bloque superior; un dato, retirándolo
// cuando la imagen no lo afirma o ya se comprobó (queda registrado como corrección humana).
function showPending(items,previewOnly){
  const card=document.getElementById('pending-card'),list=document.getElementById('pending-summary');
  list.replaceChildren(...items.map(x=>{
    const li=textElement('li',String(x).replace(/^\[FALTA DATO:\s*|\]$/g,''));
    if(x===PHOTO_PENDING){li.appendChild(withClass(textElement('small',' Elige o pega una foto arriba.'),'muted'));return li;}
    const b=textElement('button','La imagen no lo afirma · retirar');b.type='button';b.className='secondary small-btn';b.disabled=previewOnly;
    b.onclick=()=>{
      if(!confirm('¿Confirmas que la imagen no afirma este dato o que ya lo comprobaste?'))return;
      const box=document.getElementById('pending-data');
      box.value=box.value.split('\n').filter(line=>line.trim()!==String(x).trim()).join('\n');
      savePiece('Retiro de dato pendiente: '+String(x).slice(0,120));
    };
    li.appendChild(b);return li;
  }));
  card.hidden=!items.length;
}
async function loadApprovals(){
  const responses=await Promise.all([fetch('/api/assets'),fetch('/api/approved-info')]);
  if(responses.some(res=>!res.ok))throw new Error('Inicia sesión para comprobar recursos y testimonios autorizados');
  const [assets,info]=await Promise.all(responses.map(res=>res.json()));
  approvedPhotos=assets.filter(x=>x.tipo==='foto' && x.autorizado_publicar);
  const testimonials=info.filter(x=>x.tipo==='testimonio' && x.autorizado_publicar);
  const revoked=assets.filter(x=>x.tipo==='foto' && !x.autorizado_publicar).map(x=>x.url);
  approvedContext={resources:approvedPhotos.map(x=>x.url),allowCloudinary:true,revoked,testimonials:testimonials.map(x=>x.texto),attributions:testimonials.map(x=>x.titulo)};
  const select=document.getElementById('photo');select.replaceChildren(new Option('— Fotografía pendiente —',''));
  approvedPhotos.forEach(x=>select.add(new Option([x.descripcion,x.destino].filter(Boolean).join(' · ') || x.url,x.url)));
  select.value=current?.resource?.url || '';
  TikaymiSearchableSelect(select,{placeholder:'Busca foto por descripción o destino…'});
}
async function show(data, approvals=approvedContext, options={}) {
  if(!data || typeof data!=='object' || Array.isArray(data))throw new Error('El archivo debe contener un objeto con el contrato de imagen única');
  const previewOnly=!!options.previewOnly;
  const sequence=++renderSequence;
  if(!previewOnly)current=data;
  for(const field of ['headline','support','visualCta','price'])document.getElementById(field).value=data.visual?.[field] || '';
  document.getElementById('aspect').value=data.visual?.aspect||'4:5';
  document.getElementById('overlayStrength').value=data.visual?.overlayStrength??70;
  document.getElementById('decoration').checked=data.visual?.decoration!==false;
  document.getElementById('safeTop').value=data.visual?.safeTop??12;
  document.getElementById('safeBottom').value=data.visual?.safeBottom??18;
  document.getElementById('alt').value=data.alt || '';
  document.getElementById('pending-data').value=Array.isArray(data.pending)?data.pending.join('\n'):'';
  document.getElementById('download').disabled=true;
  const validation=TikaymiVisual.validateSingle(data, approvals);
  document.getElementById('photo').value=data.resource?.url || '';
  document.getElementById('photo-url').value=data.resource?.url || '';
  node.replaceChildren(); node.className='canvas '+data.tipo+(data.visual?.aspect==='9:16'?' story':'');fitPreview();
  previewFrame.querySelector('.safe-guide.top').style.height=(data.visual?.aspect==='9:16'?(Number(data.visual?.safeTop??12)/100*previewFrame.clientHeight):0)+'px';
  previewFrame.querySelector('.safe-guide.bottom').style.height=(data.visual?.aspect==='9:16'?(Number(data.visual?.safeBottom??18)/100*previewFrame.clientHeight):0)+'px';
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
  showPending([...validation.pending],previewOnly);
  if (document.fonts) await document.fonts.ready;
  if(sequence!==renderSequence)return;
  const renderErrors=TikaymiVisual.validateRender(node).errors,contractWarnings=validation.errors.filter(isSingleExportWarning),warnings=singleLayoutWarnings(data,node,contractWarnings),blockers=[...validation.errors.filter(e=>!isSingleExportWarning(e)),...validation.pending],errors=[...blockers,...warnings];
  statusNode.textContent=previewOnly
    ? 'Vista previa actualizada. Guarda los cambios para validarlos antes de descargar.'+(errors.length?' Pendientes: '+errors.join(' · '):'')
    : blockers.length ? (validation.pending.length && validation.pending.length===blockers.length
        ? `Para descargar, resuelve ${blockers.length===1?'el dato pendiente':'los '+blockers.length+' datos pendientes'} en «Datos que faltan» (arriba).`
        : 'No se puede descargar todavía: '+blockers.join(' · ')) : warnings.length
          ? 'Hay advertencias de composición. Puedes descargar si las revisaste y aceptas el resultado.'
          : 'Composición comprobada. Confirma tu revisión humana para descargar.';
  document.getElementById('download').disabled=previewOnly || blockers.length>0;
  if(generatedId && !previewOnly) {
    const res=await fetch('/api/generated/'+generatedId+'/render-validation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contenido:originalContent,errors})});
    if(!res.ok){document.getElementById('download').disabled=true;statusNode.textContent=(await res.json()).error;}
    const key='visual-repair-'+generatedId;
    if(renderErrors.length && !visualRepairUsed && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key,'1');statusNode.textContent='El texto no cabe. Intentando una versión más breve una vez…';
      const repaired=await fetch('/api/generated/'+generatedId+'/regenerate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({segmento:'pieza',automatic_visual_repair:true,instruccion:'Acorta exclusivamente los textos que no caben. Conserva fotografía, mensaje, idioma y CTA. Errores: '+renderErrors.join('; ')})});
      if(repaired.ok){location.reload();return;}statusNode.textContent='Revisión fallida: '+(await repaired.json()).error;
    }
  }
  const copies=document.getElementById('copies'); copies.replaceChildren();
  for(const copy of data.copies || []) copies.append(textElement('h3',copy.plataforma),textElement('pre',copy.text));
}
document.getElementById('file').onchange=async e=>{ try { generatedId=null; await loadApprovals(); await show(JSON.parse(await e.target.files[0].text())); } catch(err){document.getElementById('download').disabled=true;statusNode.textContent=err.message;} };
// El precio vacío se omite: la imagen no muestra etiqueta.
function visualFromInputs(){const v=Object.fromEntries(['headline','support','visualCta','price'].map(field=>[field,document.getElementById(field).value.trim()]));if(!v.price)delete v.price;v.aspect=document.getElementById('aspect').value;v.overlayStrength=Number(document.getElementById('overlayStrength').value);v.decoration=document.getElementById('decoration').checked;v.safeTop=Number(document.getElementById('safeTop').value);v.safeBottom=Number(document.getElementById('safeBottom').value);return v;}
let previewTimer;
function updateLivePreview(){
  clearTimeout(previewTimer);document.getElementById('download').disabled=true;
  if(!current){statusNode.textContent='Carga un borrador para iniciar la vista previa.';return;}
  statusNode.textContent='Actualizando vista previa…';
  previewTimer=setTimeout(()=>{
    const draft=structuredClone(current),url=document.getElementById('photo-url').value.trim();
    draft.resource={url,pending:url?'':'Fotografía aprobada pendiente'};
    draft.visual=visualFromInputs();
    draft.alt=document.getElementById('alt').value.trim();
    draft.pending=document.getElementById('pending-data').value.split('\n').map(x=>x.trim()).filter(x=>x && x!==PHOTO_PENDING);
    if(!url)draft.pending.push('Fotografía aprobada pendiente');
    show(draft,approvedContext,{previewOnly:true}).catch(err=>{statusNode.textContent='No se pudo actualizar la vista previa: '+err.message;});
  },450);
}
for(const field of ['photo-url','headline','support','visualCta','price','alt','pending-data','aspect','overlayStrength','decoration','safeTop','safeBottom'])document.getElementById(field).addEventListener('input',updateLivePreview);
document.getElementById('photo').addEventListener('change',e=>{document.getElementById('photo-url').value=e.target.value;updateLivePreview();});
document.getElementById('save-photo').onclick=()=>savePiece('Corrección humana de foto, texto o pendientes en revisión visual');
async function savePiece(motivo){
  try {
    if(!current)throw new Error('Abre primero una pieza');
    const url=document.getElementById('photo-url').value.trim() || document.getElementById('photo').value;
    await loadApprovals();
    if(url && approvedContext.revoked.includes(url))throw new Error('Esa fotografía fue retirada en Biblioteca');
    if(url && !TikaymiVisual.photoAllowed(url,approvedContext))throw new Error('Pega una URL de '+TikaymiVisual.CLOUDINARY_PHOTO_BASE+'… o elige una foto de Biblioteca');
    const next=structuredClone(current);next.resource={url,pending:url?'':'Fotografía aprobada pendiente'};
    next.visual=visualFromInputs();
    next.alt=document.getElementById('alt').value.trim();
    next.pending=document.getElementById('pending-data').value.split('\n').map(x=>x.trim()).filter(x=>x && x!==PHOTO_PENDING);
    if(!url)next.pending.push('Fotografía aprobada pendiente');
    if(generatedId){
      const res=await fetch('/api/generated/'+generatedId+'/edit',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({contenido:JSON.stringify(next,null,2),segmento:'pieza',motivo})});
      if(!res.ok)throw new Error((await res.json()).error);
      location.reload();return;
    }
    await show(next);
  }catch(err){statusNode.textContent=err.message;document.getElementById('download').disabled=true;}
}
document.getElementById('download').onclick=async()=>{
  try {
    await loadApprovals();
    const contract=TikaymiVisual.validateSingle(current,approvedContext);
    const contractWarnings=contract.errors.filter(isSingleExportWarning);
    const blockers=[...contract.errors.filter(e=>!isSingleExportWarning(e)),...contract.pending];
    if(blockers.length)throw new Error('Resuelve estos bloqueos antes de exportar: '+blockers.join(' · '));
    if(!current.resource?.url)throw new Error('Falta fotografía. Elige una imagen válida antes de exportar.');
    const warnings=singleLayoutWarnings(current,node,contractWarnings);
    if(warnings.length){
      if(!confirm('La imagen tiene advertencias de composición. Puedes exportarla de todos modos, pero el PNG conservará estos problemas:\n\n'+warnings.join('\n')+'\n\nSi continúas, confirmas que revisaste la fotografía, los textos, el CTA y el idioma. ¿Exportar de todos modos?'))return;
    } else if(!confirm('¿Confirmas que revisaste la fotografía, textos, CTA e idioma?')) return;
    const oldTransform=node.style.transform;node.style.transform='none';
    const height=current.visual?.aspect==='9:16'?1920:1350;
    let canvas;try{canvas=await html2canvas(node,{useCORS:true,allowTaint:false,scale:1,width:1080,height});}finally{node.style.transform=oldTransform;}
    canvas.toBlob(blob=>{ if(!blob){statusNode.textContent='No se pudo crear el PNG.';return;} const a=document.createElement('a'); a.download=`tikaymi-imagen-unica-${height===1920?'9x16':'4x5'}.png`; a.href=URL.createObjectURL(blob); a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); });
  } catch(err){statusNode.textContent=err.message;}
};
(async()=>{const id=new URLSearchParams(location.search).get('id'); if(!id)return; try {await loadApprovals();const res=await fetch('/api/generated'); if(!res.ok)throw new Error('Inicia sesión en Tikaymi Lab'); const item=(await res.json()).find(x=>String(x.id)===id); if(!item)throw new Error('Borrador inexistente'); generatedId=id; originalContent=item.contenido; visualRepairUsed=!!item.visual_repair_used; await show(JSON.parse(item.contenido));}catch(err){statusNode.textContent=err.message;}})();
