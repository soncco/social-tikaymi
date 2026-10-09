// Preparación y medición manual de campañas Meta. No llama a Ads Manager ni publica anuncios.
const { parse } = require('csv-parse/sync');
const ads = require('./ads');
const err = (status,message) => Object.assign(new Error(message),{status});
const STATUSES = ['contenido_revision','creatividad_aprobada','campana_preparada','lanzada_manual','resultados_registrados'];
const METRIC_FIELDS = ['spend','impressions','reach','clicks','conversations'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const object = raw => { try { return JSON.parse(raw || '{}'); } catch { return {}; } };
const sourceApproved = (db,s) => s.id && s.tipo!=='pagina_web'
  ? !!db.prepare('SELECT 1 FROM approved_info WHERE id=? AND autorizado_publicar=1').get(s.id)
  : s.url ? !!db.prepare('SELECT 1 FROM site_pages WHERE url=? AND approved=1 AND active=1').get(s.url) : null;

function register(db, generatedId) {
  const row = db.prepare("SELECT g.*,p.brief_json FROM generated g LEFT JOIN content_packages p ON p.id=g.package_id WHERE g.id=? AND g.tipo='anuncio_meta'").get(generatedId);
  if (!row) throw err(404,'No existe el anuncio');
  const existing=db.prepare('SELECT id FROM ad_campaigns WHERE generated_id=? ORDER BY id LIMIT 1').get(generatedId);
  if (existing) return existing.id;
  const ad=object(row.contenido), brief=object(row.brief_json);
  let upgraded=false;
  if(!ad.profile){ad.profile='ads_manager';upgraded=true;}
  if(!ad.saludo){ad.saludo=ads.greeting(ad.idioma,require('./editorial-strategy').get(db).contact_name);upgraded=true;}
  if(!Object.hasOwn(ad,'product_url')){ad.product_url=brief.source_url||null;upgraded=true;}
  if(!Object.hasOwn(ad,'objetivo_negocio')){ad.objetivo_negocio=brief.objetivo_negocio||'consulta_calificada';upgraded=true;}
  if(!Object.hasOwn(ad,'price_label')){ad.price_label=ads.priceText(ad.precio,ad.idioma);upgraded=true;}
  for(const v of ad.variantes||[])if(v.campaign_code&&(!v.mensaje_whatsapp||v.mensaje_whatsapp.length>80||!v.mensaje_whatsapp.includes(v.campaign_code))){v.mensaje_whatsapp=ads.whatsappMessage(ad.idioma,ad.producto,v.campaign_code);upgraded=true;}
  return db.transaction(()=>{
    if(upgraded){
      const version=db.prepare('SELECT COALESCE(MAX(version),0)+1 n FROM generated_revisions WHERE generated_id=?').get(row.id).n;
      db.prepare('INSERT INTO generated_revisions(generated_id,version,contenido,segmento,motivo) VALUES(?,?,?,?,?)').run(row.id,version,JSON.stringify(ad,null,2),'contrato_publicitario','Migración de campos finales para revisión humana');
      db.prepare("UPDATE generated SET contenido=?,estado='revision' WHERE id=?").run(JSON.stringify(ad,null,2),row.id);
    }
    const campaignId=db.prepare('INSERT INTO ad_campaigns(generated_id,package_id,status,brief_json) VALUES(?,?,?,?)')
      .run(row.id,row.package_id,!upgraded&&row.estado==='aprobado'?'creatividad_aprobada':'contenido_revision',JSON.stringify({ product_url:ad.product_url||brief.source_url||null, objective:ad.objetivo_negocio||brief.objetivo_negocio||null, profile:ad.profile||'business_suite', language:ad.idioma||row.idioma })).lastInsertRowid;
    const insert=db.prepare('INSERT INTO ad_variants(campaign_id,generated_id,package_id,letter,code,product_url,language) VALUES(?,?,?,?,?,?,?)');
    for(const v of ad.variantes||[])if(v.campaign_code)insert.run(campaignId,row.id,row.package_id,v.id,v.campaign_code,ad.product_url||brief.source_url||null,ad.idioma||row.idioma);
    return Number(campaignId);
  })();
}
function backfill(db) {
  const rows=db.prepare("SELECT g.id FROM generated g WHERE g.tipo='anuncio_meta' AND NOT EXISTS(SELECT 1 FROM ad_campaigns c WHERE c.generated_id=g.id)").all();
  let count=0;
  for(const row of rows) try { register(db,row.id);count++; } catch(e) { console.warn(`[paid] anuncio histórico #${row.id} sin registro de variantes: ${e.message}`); }
  return count;
}
function syncVariants(db,generatedId) {
  const campaignId=register(db,generatedId);
  const campaign=get(db,campaignId);
  const ad=object(db.prepare('SELECT contenido FROM generated WHERE id=?').get(generatedId)?.contenido);
  const insert=db.prepare('INSERT INTO ad_variants(campaign_id,generated_id,package_id,letter,code,product_url,language,country) VALUES(?,?,?,?,?,?,?,?)');
  for(const v of ad.variantes||[]) {
    const current=campaign.variants.find(x=>x.letter===v.id);
    if(current&&current.code!==v.campaign_code)throw err(409,`El código ${current.code} de la variante ${v.id} no se puede reemplazar`);
    if(!current&&v.campaign_code)insert.run(campaignId,generatedId,campaign.package_id,v.id,v.campaign_code,ad.product_url||campaign.brief.product_url||null,ad.idioma,campaign.country);
  }
  return get(db,campaignId);
}
function get(db,id) {
  const row=db.prepare('SELECT * FROM ad_campaigns WHERE id=?').get(id);
  if(!row)throw err(404,'No existe la campaña');
  const variants=db.prepare('SELECT * FROM ad_variants WHERE campaign_id=? ORDER BY letter').all(id);
  const ad=object(db.prepare('SELECT contenido FROM generated WHERE id=?').get(row.generated_id)?.contenido);
  const visual=db.prepare("SELECT id,tipo,estado FROM generated WHERE package_id=? AND tipo IN ('imagen_unica','carrusel') ORDER BY id LIMIT 1").get(row.package_id);
  return {...row,brief:object(row.brief_json),variants,price:ad.precio||null,price_label:ad.price_label||null,visual:visual||null};
}
function list(db) {
  return db.prepare(`SELECT c.id,c.generated_id,c.package_id,c.country,c.status,c.created_at,c.launched_at,
    json_extract(c.brief_json,'$.product_url') product_url,json_extract(c.brief_json,'$.objective') objective,
    (SELECT COUNT(*) FROM ad_variants v WHERE v.campaign_id=c.id) variants,
    (SELECT COUNT(*) FROM paid_metrics m JOIN ad_variants v ON v.id=m.variant_id WHERE v.campaign_id=c.id) metric_periods
    FROM ad_campaigns c ORDER BY c.id DESC`).all();
}
function update(db,id,input={}) {
  const campaign=get(db,id);
  if(!['contenido_revision','creatividad_aprobada','campana_preparada'].includes(campaign.status))throw err(409,'La campaña ya se registró como lanzada; crea otra para cambiar país o presupuesto');
  const allowed=['country','objective','profile','language','product_url','whatsapp','destination','audience','audience_reason','audience_basis','budget_amount','budget_currency','budget_mode','start_date','end_date','timezone','hours','test_variable','notes','advantage_audience','advantage_creative','claims_confirmed','decisions_confirmed'];
  const brief={...campaign.brief};
  for(const key of allowed)if(Object.hasOwn(input,key))brief[key]=typeof input[key]==='string'?input[key].trim():input[key];
  if(brief.profile&&!ads.PROFILES[brief.profile])throw err(400,'Perfil de interfaz inválido');
  if(brief.destination&&brief.destination!=='whatsapp')throw err(400,'Esta preparación solo admite WhatsApp como destino');
  if(brief.audience_basis&&!['hipotesis','evidencia'].includes(brief.audience_basis))throw err(400,'Marca el público como hipótesis o basado en evidencia');
  if(brief.country&&String(brief.country).length>80)throw err(400,'País: máximo 80 caracteres');
  if(brief.budget_amount!==undefined&&brief.budget_amount!==''&&(!Number.isFinite(Number(brief.budget_amount))||Number(brief.budget_amount)<=0))throw err(400,'Presupuesto: importe inválido');
  const nextStatus=campaign.status==='campana_preparada'?'creatividad_aprobada':campaign.status;
  db.transaction(()=>{
    db.prepare('UPDATE ad_campaigns SET country=?,brief_json=?,status=? WHERE id=?').run(brief.country||null,JSON.stringify(brief),nextStatus,id);
    db.prepare('UPDATE ad_variants SET country=? WHERE campaign_id=?').run(brief.country||null,id);
  })();
  return get(db,id);
}
function cloneForCountry(db,id,country) {
  const source=get(db,id);
  if(!String(country||'').trim())throw err(400,'Confirma el país de ubicación para la nueva campaña');
  const ad=object(db.prepare('SELECT contenido FROM generated WHERE id=?').get(source.generated_id)?.contenido);
  const base=ads.nextBase(db,source.brief.language||ad.idioma);
  const brief={...source.brief,country:String(country).trim(),audience:null,audience_reason:null,audience_basis:null,budget_amount:null,start_date:null,end_date:null,test_variable:null,decisions_confirmed:false};
  return db.transaction(()=>{
    const campaignId=db.prepare('INSERT INTO ad_campaigns(generated_id,package_id,country,status,brief_json) VALUES(?,?,?,?,?)')
      .run(source.generated_id,source.package_id,brief.country,source.status==='contenido_revision'?'contenido_revision':'creatividad_aprobada',JSON.stringify(brief)).lastInsertRowid;
    const insert=db.prepare('INSERT INTO ad_variants(campaign_id,generated_id,package_id,letter,code,product_url,language,country) VALUES(?,?,?,?,?,?,?,?)');
    for(const v of source.variants)insert.run(campaignId,v.generated_id,v.package_id,v.letter,`${base}${v.letter}`,v.product_url,v.language,brief.country);
    return get(db,campaignId);
  })();
}
function updatePrice(db,id,input) {
  const campaign=get(db,id);
  if(['lanzada_manual','resultados_registrados'].includes(campaign.status))throw err(409,'La campaña ya fue lanzada; conserva el histórico y prepara una nueva creatividad');
  const price=ads.normalizePrice({...input,product_url:campaign.brief.product_url});
  const issues=ads.validatePrice(price,{productUrl:campaign.brief.product_url,prepared:true});
  if(issues.length)throw err(422,issues.join('; '));
  const row=db.prepare('SELECT * FROM generated WHERE id=?').get(campaign.generated_id);
  const ad=object(row.contenido),label=ads.priceText(price,ad.idioma);
  ad.precio=price;ad.price_label=label;
  for(const v of ad.variantes||[]){
    if(!String(v.cuerpo||'').includes(price.conditions))v.cuerpo=[v.cuerpo,`${label}. ${price.conditions}`].filter(Boolean).join('\n');
    v.texto_principal=[v.gancho,v.cuerpo].filter(Boolean).join('\n\n');
  }
  const validation=ads.validate(ad,{ready:true,prepared:true,productUrl:campaign.brief.product_url});
  if(!validation.ok)throw err(422,`Corrige los textos antes de guardar el precio: ${validation.errors.join('; ')}`);
  const visual=db.prepare("SELECT * FROM generated WHERE package_id=? AND tipo IN ('imagen_unica','carrusel') ORDER BY id LIMIT 1").get(campaign.package_id);
  if(!visual)throw err(422,'Falta el visual del paquete');
  const image=object(visual.contenido);
  if(visual.tipo==='imagen_unica')image.visual.price=label;
  else {const ficha=image.slides?.find(s=>s.layout==='ficha');if(!ficha)throw err(422,'El carrusel necesita una ficha para mostrar precio y unidad');ficha.data.meta=Array.isArray(ficha.data.meta)?ficha.data.meta:[];const item=ficha.data.meta.find(x=>/precio|price/i.test(x.k||''));if(item)item.v=label;else {if(ficha.data.meta.length>=4)throw err(422,'La ficha ya tiene cuatro datos; libera una fila en el constructor antes de añadir el precio');ficha.data.meta.push({k:ad.idioma==='en'?'Price':'Precio',v:label});}}
  return db.transaction(()=>{
    const save=(generated,contenido)=>{
      const version=db.prepare('SELECT COALESCE(MAX(version),0)+1 n FROM generated_revisions WHERE generated_id=?').get(generated.id).n;
      db.prepare('INSERT INTO generated_revisions(generated_id,version,contenido,segmento,motivo) VALUES(?,?,?,?,?)').run(generated.id,version,contenido,'precio','Precio y condiciones confirmados para este tour');
      db.prepare("UPDATE generated SET contenido=?,estado='revision' WHERE id=?").run(contenido,generated.id);
    };
    save(row,JSON.stringify(ad,null,2));save(visual,JSON.stringify(image,null,2));
    if(campaign.package_id){const pack=db.prepare('SELECT brief_json FROM content_packages WHERE id=?').get(campaign.package_id);db.prepare('UPDATE content_packages SET brief_json=? WHERE id=?').run(JSON.stringify({...object(pack.brief_json),precio:price}),campaign.package_id);}
    db.prepare("UPDATE ad_campaigns SET status='contenido_revision' WHERE generated_id=? AND status IN ('contenido_revision','creatividad_aprobada','campana_preparada')").run(campaign.generated_id);
    return {campaign_id:Number(id),price_label:label,visual_id:visual.id,ad_id:row.id,estado:'contenido_revision'};
  })();
}
function prepare(db,id) {
  const campaign=get(db,id), brief=campaign.brief;
  const generated=db.prepare('SELECT estado,contenido FROM generated WHERE id=?').get(campaign.generated_id);
  if(generated?.estado!=='aprobado')throw err(422,'Aprueba los textos del anuncio antes de preparar la campaña');
  const visual=db.prepare("SELECT tipo,estado FROM generated WHERE package_id=? AND tipo IN ('imagen_unica','carrusel') ORDER BY id LIMIT 1").get(campaign.package_id);
  if(!visual||visual.estado!=='aprobado')throw err(422,'Revisa y aprueba también la imagen o el carrusel antes de preparar la campaña');
  const ad=object(generated.contenido);
  const checks=ads.validate(exportPackage(db,id).ad,{ready:true,prepared:true,profile:brief.profile,productUrl:brief.product_url});
  const missing=[...checks.errors];
  const packageRow=campaign.package_id&&db.prepare('SELECT sources_json FROM content_packages WHERE id=?').get(campaign.package_id);
  const packageSources=packageRow?object(packageRow.sources_json):[];
  if(Array.isArray(packageSources)&&packageSources.some(s=>sourceApproved(db,s)===false))missing.push('Fuentes: una página o ficha usada en el anuncio ya no está aprobada; revisa y regenera la pieza');
  if(!brief.claims_confirmed)missing.push('Afirmaciones: confirma que cada beneficio e inclusión aparece en las fuentes aprobadas del tour');
  if(!brief.decisions_confirmed)missing.push('Decisiones: confirma país, presupuesto, fechas, horario y destino WhatsApp');
  if(!brief.audience_basis)missing.push('Público: indica si es una hipótesis o se basa en evidencia');
  if(brief.destination!=='whatsapp')missing.push('Destino: confirma WhatsApp como destino único');
  const visualContent=object(db.prepare("SELECT contenido FROM generated WHERE package_id=? AND tipo IN ('imagen_unica','carrusel') ORDER BY id LIMIT 1").get(campaign.package_id)?.contenido);
  if(visual?.tipo==='imagen_unica'&&String(visualContent.visual?.price||'')!==String(ad.price_label||''))missing.push('Precio visual: debe coincidir con la etiqueta confirmada del anuncio');
  if(brief.objective==='cotizacion'){
    const cta=visual?.tipo==='imagen_unica'?visualContent.visual?.visualCta:visualContent.slides?.find(s=>s.layout==='cierre')?.data?.ctaText;
    if(/reserva ahora|book now/i.test(String(cta||'')))missing.push('CTA visual: cambia «Reserva ahora» por una invitación a cotizar');
  }
  for(const [key,label] of Object.entries({country:'país de ubicación',audience:'público propuesto',audience_reason:'justificación del público',budget_amount:'presupuesto',budget_currency:'moneda del presupuesto',budget_mode:'modalidad del presupuesto',start_date:'fecha inicial',end_date:'fecha final',timezone:'zona horaria',hours:'horarios reales de atención',test_variable:'variable a probar'}))if(!brief[key])missing.push(`${label}: completa y confirma este dato`);
  if(!brief.whatsapp)missing.push('WhatsApp: confirma el número de destino');
  if(brief.whatsapp&&String(brief.whatsapp).replace(/\D/g,'').length<8)missing.push('WhatsApp: confirma un número con código de país');
  if(!brief.product_url||!db.prepare("SELECT 1 FROM site_pages WHERE url=? AND approved=1 AND active=1 AND kind='tour'").get(brief.product_url))missing.push('Producto: elige un tour aprobado y activo');
  if(brief.start_date&&!DATE.test(brief.start_date)||brief.end_date&&!DATE.test(brief.end_date)||brief.start_date&&brief.end_date&&brief.end_date<brief.start_date)missing.push('Fechas: usa AAAA-MM-DD y un fin posterior al inicio');
  if(brief.budget_currency&&!/^[A-Z]{3}$/.test(brief.budget_currency))missing.push('Moneda: usa código de tres letras');
  if(!campaign.variants.length)missing.push('Variantes: faltan códigos registrados');
  if(missing.length)throw err(422,`Campaña aún no preparada: ${missing.join('; ')}`);
  db.prepare("UPDATE ad_campaigns SET status='campana_preparada' WHERE id=?").run(id);
  return get(db,id);
}
function launch(db,id,{date,external_ids={}}={}) {
  const campaign=get(db,id);
  if(campaign.status!=='campana_preparada')throw err(422,'Completa y prepara la campaña antes de registrar su lanzamiento manual');
  if(!DATE.test(String(date||'')))throw err(400,'Indica la fecha real de lanzamiento (AAAA-MM-DD)');
  db.transaction(()=>{
    const stmt=db.prepare('UPDATE ad_variants SET external_campaign_id=?,external_adset_id=?,external_ad_id=? WHERE id=?');
    for(const v of campaign.variants){const ext=external_ids[v.letter]||{};stmt.run(ext.campaign_id||null,ext.adset_id||null,ext.ad_id||null,v.id);}
    const exported=exportPackage(db,id);
    const snapshot={ad:exported.ad,visual:exported.visual,sources:exported.sources,product:exported.product,pending:exported.pending,validations:exported.validations};
    db.prepare("UPDATE ad_campaigns SET status='lanzada_manual',launched_at=?,launch_snapshot_json=? WHERE id=?").run(date,JSON.stringify(snapshot),id);
  })();
  return get(db,id);
}
function validateMetric(db,input) {
  const v=db.prepare('SELECT id FROM ad_variants WHERE id=?').get(input.variant_id);
  if(!v)throw err(404,'La variante publicitaria no existe');
  if(!DATE.test(String(input.period_start||''))||!DATE.test(String(input.period_end||''))||input.period_end<input.period_start)throw err(400,'Período: fechas AAAA-MM-DD en orden');
  const result={variant_id:Number(input.variant_id),period_start:input.period_start,period_end:input.period_end,source:String(input.source||'manual').trim()};
  if(!result.source)throw err(400,'Indica la fuente de las métricas');
  for(const key of METRIC_FIELDS){const value=input[key];result[key]=value==null||value===''?null:Number(value);if(result[key]!=null&&(!Number.isFinite(result[key])||result[key]<0||(key!=='spend'&&!Number.isInteger(result[key]))))throw err(400,`${key}: indica un número no negativo o deja vacío si falta el dato`);}
  result.currency=input.currency?String(input.currency).toUpperCase():null;
  if(result.spend!=null&&!/^[A-Z]{3}$/.test(result.currency||''))throw err(400,'Gasto: indica moneda de tres letras');
  result.click_definition=input.click_definition?String(input.click_definition).trim():null;
  result.conversation_definition=input.conversation_definition?String(input.conversation_definition).trim():null;
  if(result.clicks!=null&&!result.click_definition)throw err(400,'Clics: indica qué tipo de clic cuenta');
  if(result.conversations!=null&&!result.conversation_definition)throw err(400,'Conversaciones: indica la definición usada por la fuente');
  const overlap=db.prepare('SELECT id FROM paid_metrics WHERE variant_id=? AND NOT(period_end<? OR period_start>?)').get(result.variant_id,result.period_start,result.period_end);
  if(overlap)throw err(409,`Período superpuesto con registro #${overlap.id}; corrige las fechas para evitar doble conteo`);
  return result;
}
function addMetric(db,input) {
  const m=validateMetric(db,input);
  const id=db.prepare('INSERT INTO paid_metrics(variant_id,period_start,period_end,spend,currency,impressions,reach,clicks,click_definition,conversations,conversation_definition,source) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(m.variant_id,m.period_start,m.period_end,m.spend,m.currency,m.impressions,m.reach,m.clicks,m.click_definition,m.conversations,m.conversation_definition,m.source).lastInsertRowid;
  db.prepare("UPDATE ad_campaigns SET status='resultados_registrados' WHERE id=(SELECT campaign_id FROM ad_variants WHERE id=?) AND status='lanzada_manual'").run(m.variant_id);
  return {id:Number(id),...m};
}
function csvPreview(db,{csv,mapping,defaults={}}) {
  if(!csv||!mapping||typeof mapping!=='object')throw err(400,'Selecciona CSV y mapeo de columnas');
  let records;try{records=parse(csv,{columns:true,skip_empty_lines:true,bom:true,trim:true});}catch(e){throw err(400,`CSV inválido: ${e.message}`);}
  if(!records.length)throw err(400,'CSV sin filas');
  if(records.length>500)throw err(400,'CSV: máximo 500 filas por importación');
  const rows=records.map((record,index)=>{
    const data={...defaults};for(const key of ['variant_id','period_start','period_end','spend','currency','impressions','reach','clicks','click_definition','conversations','conversation_definition','source'])if(mapping[key])data[key]=record[mapping[key]];
    try{return {line:index+2,data:validateMetric(db,data),errors:[]};}catch(e){return {line:index+2,data,errors:[e.message]};}
  });
  for(let i=0;i<rows.length;i++)if(!rows[i].errors.length)for(let j=0;j<i;j++)if(!rows[j].errors.length&&rows[i].data.variant_id===rows[j].data.variant_id&&!(rows[i].data.period_end<rows[j].data.period_start||rows[i].data.period_start>rows[j].data.period_end))rows[i].errors.push(`período superpuesto con fila ${rows[j].line}`);
  return {headers:Object.keys(records[0]),rows,valid:rows.every(r=>!r.errors.length)};
}
function csvHeaders(csv) {
  if(!csv)throw err(400,'Selecciona un CSV');
  try{return parse(csv,{to_line:1,bom:true,skip_empty_lines:true})[0]||[];}catch(e){throw err(400,`CSV inválido: ${e.message}`);}
}
function csvImport(db,input) {
  const preview=csvPreview(db,input);
  if(!preview.valid)throw err(422,`Corrige el CSV antes de importarlo: ${preview.rows.filter(r=>r.errors.length).map(r=>`fila ${r.line}: ${r.errors.join(', ')}`).join('; ')}`);
  const byVariant=new Map();for(const r of preview.rows){const rows=byVariant.get(r.data.variant_id)||[];if(rows.some(x=>!(x.period_end<r.data.period_start||x.period_start>r.data.period_end)))throw err(422,`Filas del CSV con períodos superpuestos para variante ${r.data.variant_id}`);rows.push(r.data);byVariant.set(r.data.variant_id,rows);}
  return db.transaction(()=>preview.rows.map(r=>addMetric(db,r.data)))();
}
function results(db,id) {
  const campaign=get(db,id), metrics=db.prepare('SELECT m.*,v.code FROM paid_metrics m JOIN ad_variants v ON v.id=m.variant_id WHERE v.campaign_id=? ORDER BY m.period_start').all(id);
  const currencies=[...new Set(metrics.filter(x=>x.spend!=null).map(x=>x.currency))];
  const spend=metrics.length&&currencies.length===1&&metrics.every(x=>x.spend!=null)?metrics.reduce((n,x)=>n+x.spend,0):null;
  const currency=currencies.length===1?currencies[0]:null;
  const period=metrics.length?{from:metrics.reduce((a,x)=>a<x.period_start?a:x.period_start,metrics[0].period_start),to:metrics.reduce((a,x)=>a>x.period_end?a:x.period_end,metrics[0].period_end)}:null;
  const leadRows=db.prepare(`SELECT l.id,l.estado,l.acquired_at,l.created_at FROM leads l JOIN ad_variants v ON v.id=l.ad_variant_id WHERE v.campaign_id=?`).all(id);
  const leads=period?leadRows.filter(l=>{const date=String(l.acquired_at||l.created_at).slice(0,10);return date>=period.from&&date<=period.to;}):leadRows;
  const qualified=leads.filter(l=>['calificado','cotizado','reservado'].includes(l.estado)||db.prepare("SELECT 1 FROM lead_status_history WHERE lead_id=? AND estado_nuevo IN ('calificado','cotizado','reservado') LIMIT 1").get(l.id)).length;
  const quoted=leads.filter(l=>['cotizado','reservado'].includes(l.estado)||db.prepare("SELECT 1 FROM lead_status_history WHERE lead_id=? AND estado_nuevo IN ('cotizado','reservado') LIMIT 1").get(l.id)).length;
  const reserved=leads.filter(l=>l.estado==='reservado'||db.prepare("SELECT 1 FROM lead_status_history WHERE lead_id=? AND estado_nuevo='reservado' LIMIT 1").get(l.id)).length;
  const total=key=>metrics.length&&metrics.every(m=>m[key]!=null)?metrics.reduce((n,m)=>n+m[key],0):null;
  const conversations=total('conversations');
  const cost=n=>spend!=null&&n!=null&&n>0?spend/n:null;
  return {campaign_id:Number(id),period,spend,currency,impressions:total('impressions'),reach:metrics.length===1?metrics[0].reach:null,reach_note:metrics.length>1?'El alcance de períodos o anuncios distintos no se suma como personas únicas.':null,clicks:total('clicks'),conversations_reported:conversations,conversations_source:'Meta/CSV manual',leads_registered:leads.length,qualified,quoted,reserved,cost_per_conversation:cost(conversations),cost_per_qualified:cost(qualified),cost_per_reservation:cost(reserved),quote_progress:qualified?quoted/qualified:null,reservation_progress:quoted?reserved/quoted:null,metric_periods:metrics.length,currency_mismatch:currencies.length>1,limits:['Los códigos pueden ser editados por la persona; la atribución no es infalible.','Las conversaciones reportadas por Meta y las consultas registradas en Tikaymi son fuentes distintas.','País, creatividad y presupuesto pueden variar: una diferencia no demuestra causalidad.'],metrics};
}
function compareCountries(db,generatedId) {
  const rows=db.prepare('SELECT id FROM ad_campaigns WHERE generated_id=? AND country IS NOT NULL ORDER BY id').all(generatedId);
  return {generated_id:Number(generatedId),countries:rows.map(({id})=>{const c=get(db,id),r=results(db,id);return {campaign_id:id,country:c.country,period:r.period,spend:r.spend,currency:r.currency,impressions:r.impressions,reach:r.reach,conversations_reported:r.conversations_reported,leads_registered:r.leads_registered,qualified:r.qualified,quoted:r.quoted,reserved:r.reserved,cost_per_qualified:r.cost_per_qualified,metric_periods:r.metric_periods};}),limitations:['Los países son ubicaciones de segmentación, no nacionalidades observadas.','Compara gasto, impresiones, período y creatividad antes de interpretar diferencias.','La entrega desigual entre variantes no equivale a una prueba A/B controlada.']};
}
function exportPackage(db,id) {
  const campaign=get(db,id), generated=db.prepare('SELECT contenido,estado FROM generated WHERE id=?').get(campaign.generated_id);
  const pack=campaign.package_id?db.prepare('SELECT * FROM content_packages WHERE id=?').get(campaign.package_id):null;
  const ad=object(generated?.contenido);
  const visual=db.prepare("SELECT id,tipo,contenido,estado FROM generated WHERE package_id=? AND tipo IN ('imagen_unica','carrusel') ORDER BY id LIMIT 1").get(campaign.package_id);
  const variants=campaign.variants.map(v=>{const text=(ad.variantes||[]).find(x=>x.id===v.letter)||{};const base=v.code.slice(0,-1);return {...text,campaign_code:v.code,mensaje_whatsapp:ads.whatsappMessage(ad.idioma,ad.producto,v.code),url_destino:ads.destinationUrl(v.product_url,base,v.letter),external_campaign_id:v.external_campaign_id,external_adset_id:v.external_adset_id,external_ad_id:v.external_ad_id};});
  const exportedAd={...ad,variantes:variants};
  const sources=pack?object(pack.sources_json):[];
  const annotatedSources=Array.isArray(sources)?sources.map(s=>({...s,approved_now:sourceApproved(db,s)})):[];
  const snapshot=campaign.launch_snapshot_json?object(campaign.launch_snapshot_json):null;
  const finalAd=snapshot?.ad||exportedAd;
  return {contract:'tikaymi-meta-review',version:1,exported_at:new Date().toISOString(),campaign:{id:campaign.id,status:campaign.status,country:campaign.country,brief:campaign.brief,launched_at:campaign.launched_at},product:snapshot?.product||{url:ad.product_url||campaign.brief.product_url,title:ad.producto},sources:snapshot?.sources||annotatedSources,visual:snapshot?.visual||(visual?{id:visual.id,tipo:visual.tipo,estado:visual.estado,contenido:object(visual.contenido)}:null),ad:finalAd,validations:ads.validate(finalAd,{ready:true,prepared:campaign.status==='campana_preparada'||campaign.status==='lanzada_manual'||campaign.status==='resultados_registrados'}),pending:snapshot?.pending||ad.pending||[],results:results(db,id)};
}
module.exports={STATUSES,register,backfill,syncVariants,get,list,update,updatePrice,cloneForCountry,prepare,launch,addMetric,csvHeaders,csvPreview,csvImport,results,compareCountries,exportPackage};
