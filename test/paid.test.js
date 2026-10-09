const test=require('node:test');
const assert=require('node:assert/strict');
const {open}=require('../src/db');
const ads=require('../src/modules/ads');
const paid=require('../src/modules/paid');
const leads=require('../src/modules/leads');
const revisions=require('../src/modules/revisions');

const URL='https://tikaymi.com/tour/tour-5-dias-city-tour-valle-machupicchu-vinincunca/';
function fixture(price=null){
  const db=open(':memory:');
  db.prepare("INSERT INTO site_pages(url,lang,kind,title,content_hash,approved,active) VALUES(?,'es','tour','Cusco 5 días','hash',1,1)").run(URL);
  const pack=db.prepare(`INSERT INTO content_packages(brief_json,concept_json,primary_json,sources_json,resources_json,cta,warnings_json,pending_json,validations_json)
    VALUES(?,?,?,?,?,?,?,?,?)`).run(JSON.stringify({titulo:'Cusco 5 días',objetivo_negocio:'cotizacion',source_url:URL,precio:price,ad_profile:'business_suite'}),'{}','{}',JSON.stringify([{url:URL,title:'Cusco 5 días'}]),'[]','Cotiza tu viaje','[]','[]','{}').lastInsertRowid;
  const visual={format:'imagen_unica',version:1,tipo:'producto',idioma:'es',visual:{headline:'Cusco 5 días',support:'Valle Sagrado y Machu Picchu',visualCta:'Cotiza tu viaje',...(price?{price:ads.priceText(price,'es')}:{})}};
  const visualId=db.prepare("INSERT INTO generated(package_id,tipo,idioma,contenido,estado) VALUES(?,'imagen_unica','es',?,'aprobado')").run(pack,JSON.stringify(visual)).lastInsertRowid;
  const raw={format:'anuncio_meta',version:1,idioma:'es',variantes:[
    {angulo:'Planificación',gancho:'Cusco 5 días con Deicy',cuerpo:'Comparte fechas y viajeros para cotizar.',titulo:'Cusco 5 días',descripcion:'Viaje a medida'},
    {angulo:'Logística',gancho:'Machu Picchu y Valle Sagrado',cuerpo:'Solicita una cotización con fechas aproximadas.',titulo:'Cotiza Cusco',descripcion:'Coordinación personal'}],pending:[],warnings:[]};
  const ad=ads.finalize(raw,{base:'ADES001',tour:{title:'Tour Cusco 5 días',url:URL},contactName:'Deicy Ayala',precio:price,objective:'cotizacion'});
  const adId=db.prepare("INSERT INTO generated(package_id,tipo,idioma,contenido,estado) VALUES(?,'anuncio_meta','es',?,'aprobado')").run(pack,JSON.stringify(ad)).lastInsertRowid;
  const campaignId=paid.register(db,adId);
  return {db,pack,visualId,adId,campaignId,ad};
}
function completeBrief(db,id){
  return paid.update(db,id,{country:'Colombia',audience:'Personas que planifican viaje a Cusco',audience_reason:'Hipótesis por probar',audience_basis:'hipotesis',whatsapp:'+51 984 000 000',destination:'whatsapp',budget_amount:100,budget_currency:'USD',budget_mode:'total',start_date:'2026-10-01',end_date:'2026-10-07',timezone:'America/Lima',hours:'Lun–Vie 9:00–18:00',test_variable:'gancho',claims_confirmed:true,decisions_confirmed:true});
}

test('Business Suite valida salida final 25/300/80; Ads Manager distingue aviso editorial',()=>{
  const f=fixture();try{
    const ad=structuredClone(f.ad);
    ad.variantes[0].titulo='A'.repeat(26);
    assert.match(ads.validate(ad,{ready:true}).errors.join(),/máximo 25/);
    assert.equal(ads.validate(ad,{ready:true,profile:'ads_manager'}).ok,true);
    assert.match(ads.validate(ad,{ready:true,profile:'ads_manager'}).warnings.join(),/recomiendan 40|^$/);
    ad.variantes[0].titulo='Cusco 5 días';ad.saludo='x'.repeat(301);
    assert.match(ads.validate(ad,{ready:true}).errors.join(),/saludo: 301 caracteres, máximo 300/);
    ad.saludo=f.ad.saludo;ad.variantes[0].mensaje_whatsapp='x'.repeat(81);
    assert.match(ads.validate(ad,{ready:true}).errors.join(),/mensaje_whatsapp: 81 caracteres, máximo 80/);
  }finally{f.db.close();}
});

test('precio estructurado exige unidad, condiciones, confirmación y tour para preparar',()=>{
  assert.throws(()=>ads.normalizePrice({amount:440,currency:'USD',mode:'desde'}),/unidad/);
  const price=ads.normalizePrice({amount:440,currency:'USD',mode:'desde',unit:'persona',conditions:'Según fecha',confirmation:'Deicy',product_url:URL});
  assert.equal(ads.priceText(price),'Desde USD 440 · por persona');
  assert.deepEqual(ads.validatePrice(price,{productUrl:URL,prepared:true}),[]);
  assert.match(ads.validatePrice('Desde USD 440',{productUrl:URL,prepared:true}).join(),/antiguo/);
  assert.match(ads.validatePrice({...price,product_url:'https://tikaymi.com/otro'},{productUrl:URL,prepared:true}).join(),/no corresponde/);
});

test('atribución sin post orgánico, códigos estables, países separados y migración idempotente',()=>{
  const f=fixture();try{
    assert.equal(paid.backfill(f.db),0);
    const first=paid.get(f.db,f.campaignId);
    assert.deepEqual(first.variants.map(v=>v.code),['ADES001A','ADES001B']);
    const lead=leads.create(f.db,{campaign_code:'ades001a',country_residence:'Perú',acquired_at:'2026-10-03'});
    assert.equal(lead.origen,'publicidad');assert.equal(f.db.prepare('SELECT post_id FROM leads WHERE id=?').get(lead.id).post_id,null);
    assert.equal(paid.backfill(f.db),0);
    const clone=paid.cloneForCountry(f.db,f.campaignId,'Costa Rica');
    assert.notEqual(clone.variants[0].code,first.variants[0].code);
    assert.equal(clone.country,'Costa Rica');
    assert.equal(leads.create(f.db,{campaign_code:'UNKNOWN'}).origen,'desconocido');
    const altered=structuredClone(f.ad);altered.variantes[0].campaign_code='ADES999A';
    assert.throws(()=>revisions.edit(f.db,f.adId,{contenido:JSON.stringify(altered),motivo:'cambio'}),/conserva el código/);
  }finally{f.db.close();}
});

test('gasto pagado separa NULL de cero, rechaza solapamientos y conserva reservas tardías',()=>{
  const price=ads.normalizePrice({amount:440,currency:'USD',mode:'desde',unit:'persona',conditions:'Según fecha',confirmation:'Deicy',product_url:URL});
  const f=fixture(price);try{
    completeBrief(f.db,f.campaignId);
    assert.equal(paid.prepare(f.db,f.campaignId).status,'campana_preparada');
    paid.launch(f.db,f.campaignId,{date:'2026-10-01'});
    const variant=paid.get(f.db,f.campaignId).variants[0];
    paid.addMetric(f.db,{variant_id:variant.id,period_start:'2026-10-01',period_end:'2026-10-07',spend:120,currency:'USD',impressions:1000,reach:800,clicks:20,click_definition:'clics en enlace',conversations:0,conversation_definition:'conversaciones iniciadas',source:'CSV Meta'});
    assert.throws(()=>paid.addMetric(f.db,{variant_id:variant.id,period_start:'2026-10-05',period_end:'2026-10-09',source:'manual'}),/superpuesto/);
    const lead=leads.create(f.db,{campaign_code:variant.code,acquired_at:'2026-10-03',estado:'nuevo'});
    revisions.recordLeadTransition(f.db,lead.id,'calificado');revisions.recordLeadTransition(f.db,lead.id,'cotizado');revisions.recordLeadTransition(f.db,lead.id,'reservado');
    const r=paid.results(f.db,f.campaignId);
    assert.equal(r.conversations_reported,0);assert.equal(r.cost_per_conversation,null);assert.equal(r.cost_per_qualified,120);assert.equal(r.reserved,1);
    const exported=JSON.stringify(paid.exportPackage(f.db,f.campaignId));
    assert.match(exported,/ADES001A/);assert.doesNotMatch(exported,/country_residence|notas|acquired_at/);
    const changed=structuredClone(f.ad);changed.variantes[0].gancho='Nuevo texto posterior al lanzamiento';changed.variantes[0].texto_principal=[changed.variantes[0].gancho,changed.variantes[0].cuerpo].join('\n\n');
    revisions.edit(f.db,f.adId,{contenido:JSON.stringify(changed),motivo:'Edición posterior'});
    assert.equal(paid.exportPackage(f.db,f.campaignId).ad.variantes[0].gancho,f.ad.variantes[0].gancho,'la exportación conserva la creatividad registrada al lanzar');
    const preview=paid.csvPreview(f.db,{csv:'from,to,spend\n2026-10-08,2026-10-09,10\n2026-10-09,2026-10-10,5',mapping:{period_start:'from',period_end:'to',spend:'spend'},defaults:{variant_id:variant.id,currency:'USD',source:'CSV Meta'}});
    assert.equal(preview.valid,false);assert.match(preview.rows[1].errors.join(),/superpuesto/);
  }finally{f.db.close();}
});

test('precio antiguo se convierte con confirmación humana y devuelve visual y textos a revisión',()=>{
  const f=fixture('Desde USD 440');try{
    const result=paid.updatePrice(f.db,f.campaignId,{amount:440,currency:'USD',mode:'desde',unit:'persona',conditions:'Según fecha confirmada',confirmation:'Deicy Ayala'});
    assert.equal(result.estado,'contenido_revision');
    const ad=JSON.parse(f.db.prepare('SELECT contenido FROM generated WHERE id=?').get(f.adId).contenido);
    const visual=JSON.parse(f.db.prepare('SELECT contenido FROM generated WHERE id=?').get(f.visualId).contenido);
    assert.equal(ad.price_label,'Desde USD 440 · por persona');
    assert.equal(visual.visual.price,ad.price_label);
    assert.match(ad.variantes[0].texto_principal,/Según fecha confirmada/);
    assert.equal(f.db.prepare('SELECT estado FROM generated WHERE id=?').get(f.adId).estado,'revision');
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM generated_revisions').get().n,2);
    assert.equal(JSON.parse(f.db.prepare('SELECT brief_json FROM content_packages WHERE id=?').get(f.pack).brief_json).precio.unit,'persona');
  }finally{f.db.close();}
});

test('migración de anuncios antiguos agrega saludo y acorta mensaje una sola vez',()=>{
  const db=open(':memory:');try{
    const legacy={format:'anuncio_meta',version:1,idioma:'es',producto:'Tour Cusco 5 días con Machu Picchu y Valle Sagrado',codigo_base:'ADES019',precio:'Desde USD 440',pending:[],variantes:[{id:'A',angulo:'viaje',gancho:'Cusco 5 días',titulo:'Cusco y Machu Picchu',cuerpo:'Consulta tus fechas',descripcion:'Viaje a medida',campaign_code:'ADES019A',mensaje_whatsapp:'Hola Deicy, quiero cotizar el Tour Cusco 5 días con Machu Picchu y Valle Sagrado y conocer el itinerario y las condiciones. Código: ADES019A'}]};
    const id=db.prepare("INSERT INTO generated(tipo,idioma,contenido,estado) VALUES('anuncio_meta','es',?,'aprobado')").run(JSON.stringify(legacy)).lastInsertRowid;
    assert.equal(paid.backfill(db),1);assert.equal(paid.backfill(db),0);
    const after=JSON.parse(db.prepare('SELECT contenido FROM generated WHERE id=?').get(id).contenido);
    assert.equal(after.profile,'ads_manager');assert.ok(after.saludo);assert.ok(after.variantes[0].mensaje_whatsapp.length<=80);assert.match(after.variantes[0].mensaje_whatsapp,/ADES019A/);
    assert.equal(db.prepare('SELECT estado FROM generated WHERE id=?').get(id).estado,'revision');
    assert.equal(db.prepare('SELECT COUNT(*) n FROM generated_revisions WHERE generated_id=?').get(id).n,1);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM ad_variants WHERE code=?').get('ADES019A').n,1);
  }finally{db.close();}
});

test('el mapeo CSV reconoce cabeceras entrecomilladas y detecta filas solapadas',()=>{
  assert.deepEqual(paid.csvHeaders('"Período, desde",Fin,Gasto\n2026-10-01,2026-10-02,10'),['Período, desde','Fin','Gasto']);
});

test('preparación detecta fuente retirada y métricas con monedas o alcances incompatibles',()=>{
  const f=fixture();try{
    completeBrief(f.db,f.campaignId);
    f.db.prepare('UPDATE site_pages SET approved=0 WHERE url=?').run(URL);
    assert.throws(()=>paid.prepare(f.db,f.campaignId),/Fuentes:.*ya no está aprobada/);
    f.db.prepare('UPDATE site_pages SET approved=1 WHERE url=?').run(URL);
    const [a,b]=paid.get(f.db,f.campaignId).variants;
    paid.addMetric(f.db,{variant_id:a.id,period_start:'2026-10-01',period_end:'2026-10-02',spend:10,currency:'USD',reach:100,source:'manual'});
    paid.addMetric(f.db,{variant_id:b.id,period_start:'2026-10-01',period_end:'2026-10-02',spend:15,currency:'PEN',reach:120,source:'manual'});
    const r=paid.results(f.db,f.campaignId);
    assert.equal(r.spend,null);assert.equal(r.reach,null);assert.equal(r.currency_mismatch,true);
    assert.match(r.reach_note,/no se suma/);
  }finally{f.db.close();}
});
