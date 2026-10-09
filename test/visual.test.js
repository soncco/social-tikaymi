const test=require('node:test');
const assert=require('node:assert/strict');
const {open,migrate}=require('../src/db');
const content=require('../src/modules/content');
const visual=require('../public/visual-contract');
const review=require('../src/modules/visual-review');
const revisions=require('../src/modules/revisions');
const brief={titulo:'Humantay',plataforma:'instagram',plataformas_destino:['instagram','facebook'],objetivo_negocio:'consulta_calificada',objetivo_marketing:'Ayudar a decidir',objetivo_contenido:'explicar',audiencia:'Viajeros',etapa_embudo:'consideracion',cta:'Escríbenos',metrica_principal:'consultas',idioma:'es'};
const image=(tipo='producto',url='https://fixture.invalid/foto.jpg')=>({format:'imagen_unica',version:1,tipo,plataforma:'instagram',idioma:'es',resource:{url},visual:{headline:'Planifica Humantay',support:'Una decisión para tu viaje',visualCta:'Escríbenos'},alt:'Fotografía de Humantay',cta:{text:'Escríbenos',destination:''},warnings:[],pending:[]});
function setup(){const db=open(':memory:');db.prepare("INSERT INTO approved_info(tipo,titulo,texto,autorizado_publicar) VALUES('servicio','Humantay','Planificación de Humantay',1)").run();db.prepare("INSERT INTO assets(tipo,url,destino,autorizado_publicar) VALUES('foto','https://fixture.invalid/foto.jpg','Humantay',1)").run();return db;}
test('imagen única tiene contrato propio, copies aislados y permanece en revisión',async()=>{
  const db=setup(),old=process.env.ANTHROPIC_API_KEY;process.env.ANTHROPIC_API_KEY='fixture';
  const originalBrief=structuredClone(brief);
  const prompts=[];
  try {
    const result=await content.generatePackage(db,{brief,extra:'imagen_unica'},{fetchImpl:async(_url,opts)=>{
      const prompt=JSON.parse(opts.body).messages[0].content;prompts.push(prompt);
      return {ok:true,json:async()=>({content:[{type:'text',text:prompts.length===1?JSON.stringify(image()):prompt.includes('Plataforma: facebook')?'Copy Facebook':'Copy Instagram'}]})};
    }});
    const output=JSON.parse(result.primary.contenido);
    assert.equal(output.format,'imagen_unica');assert.equal(output.slides,undefined);
    assert.deepEqual(output.copies.map(x=>x.text),['Copy Instagram','Copy Facebook']);
    assert.deepEqual(db.prepare("SELECT plataforma FROM generated WHERE tipo='copy' ORDER BY id").all().map(x=>x.plataforma),['instagram','facebook']);
    assert.deepEqual(brief,originalBrief,'generar no modifica el brief proporcionado');
    assert.equal(result.package.brief.plataforma,'instagram');
    assert.deepEqual(result.package.brief.plataformas_destino,['instagram','facebook']);
    assert.ok(!prompts[1].includes('instagram, facebook'));
    assert.match(prompts[1],/Gancho breve/);assert.match(prompts[2],/tono conversacional/);
    assert.equal(result.primary.estado,'revision');
    assert.throws(()=>content.setEstado(db,result.primary.id,'aprobado'),/revisión visual/);
    review.record(db,result.primary.id,{contenido:result.primary.contenido,errors:[]});
    assert.equal(content.setEstado(db,result.primary.id,'aprobado').estado,'aprobado');
    assert.throws(()=>content.setEstado(db,result.primary.id,'publicado'),/inválido/);
  } finally {if(old===undefined)delete process.env.ANTHROPIC_API_KEY;else process.env.ANTHROPIC_API_KEY=old;db.close();}
});
test('plantillas producto, informativo y testimonio requieren recursos y citas aprobados',()=>{
  for(const tipo of ['producto','informativo'])assert.ok(visual.validateSingle(image(tipo),{resources:['https://fixture.invalid/foto.jpg']}).ready);
  const quote=image('testimonio');quote.testimonial={quote:'Planificaron nuestro viaje.',by:'Fixture ficticio'};quote.visual.support=quote.testimonial.quote;
  assert.ok(visual.validateSingle(quote,{testimonials:[quote.testimonial.quote]}).ok);
  assert.equal(visual.validateSingle(quote,{testimonials:[]}).ok,false);
  assert.equal(visual.validateSingle(image(),{resources:[]}).ok,false);
  assert.equal(visual.validateSingle(image('producto','')).ready,false);
  assert.equal(visual.validateSingle({...image(),pending:['Confirmar información pendiente']}).ready,false);
});
test('imagen única admite 4:5 y 9:16 sin alterar el contrato del carrusel',()=>{
  for(const aspect of ['4:5','9:16']){
    const sample=image();sample.visual={...sample.visual,aspect,overlayStrength:70,decoration:false,safeTop:12,safeBottom:18};
    assert.equal(visual.validateSingle(sample,{resources:[sample.resource.url]}).ready,true);
  }
  const invalid=image();invalid.visual.aspect='horizontal';
  assert.match(visual.validateSingle(invalid).errors.join(),/visual.aspect/);
});
test('límites por layout rechazan portada, cuerpo, pasos y columnas densos',()=>{
  const long='palabra '.repeat(30);
  for(const [layout,data] of [['portada',{h1:long}],['ficha',{body:long}],['pasos',{steps:[{title:'Paso',text:long}]}],['bueno-saberlo',{notes:[{title:'Consejo',text:long}]}],['columnas',{colA:{heading:'Opciones',items:[long]}}]]){
    const result=visual.validateCarousel({slides:[{layout,data}]});assert.equal(result.ok,false);assert.match(result.errors.join(' '),/máximo/);
  }
  assert.equal(visual.validateCarousel({slides:[{layout:'pasos',data:{steps:'invalid'}}]}).ok,false);
  assert.equal(visual.validateCarousel({slides:'invalid'}).ok,false);
  assert.equal(visual.validateSingle({...image(),alt:123}).ok,false);
  assert.equal(visual.validateSingle({...image(),visual:{...image().visual,headline:'x'.repeat(150)}}).ok,false);
});
test('render detecta corte y solapamiento con zonas seguras',()=>{
  const rect=(left,top,right,bottom)=>({left,top,right,bottom});
  const text={textContent:'Texto extenso',childNodes:[{nodeType:3,textContent:'Texto extenso'}],scrollHeight:50,clientHeight:20,scrollWidth:20,clientWidth:20,getBoundingClientRect:()=>rect(0,90,100,120),contains:()=>false};
  const safe={getBoundingClientRect:()=>rect(0,100,100,130),contains:()=>false};
  const node={getBoundingClientRect:()=>rect(0,0,100,130),querySelectorAll:q=>q==='*'?[text]:[safe]};
  const result=visual.validateRender(node);assert.equal(result.ok,false);assert.match(result.errors.join(' '),/cortado/);assert.match(result.errors.join(' '),/solapa/);
});
test('render fallido o contenido modificado no autoriza aprobación',()=>{
  const db=setup();const raw=JSON.stringify(image());
  const id=db.prepare("INSERT INTO generated(tipo,idioma,contenido) VALUES('imagen_unica','es',?)").run(raw).lastInsertRowid;
  review.record(db,id,{contenido:raw,errors:['Texto cortado']});assert.throws(()=>content.setEstado(db,id,'aprobado'),/composición/);
  review.record(db,id,{contenido:raw,errors:[]});db.prepare('UPDATE generated SET contenido=? WHERE id=?').run(JSON.stringify({...image(),alt:'Otra versión'}),id);
  assert.throws(()=>content.setEstado(db,id,'aprobado'),/composición/);db.close();
});
test('fotografía pendiente o autorización retirada impiden aprobar aunque el navegador reporte OK',()=>{
  const db=setup();
  try {
    const pending=JSON.stringify(image('producto',''));
    const id=db.prepare("INSERT INTO generated(tipo,idioma,contenido) VALUES('imagen_unica','es',?)").run(pending).lastInsertRowid;
    review.record(db,id,{contenido:pending,errors:[]});
    assert.throws(()=>content.setEstado(db,id,'aprobado'),/Fotografía aprobada pendiente/);
    const raw=JSON.stringify(image());db.prepare('UPDATE generated SET contenido=? WHERE id=?').run(raw,id);
    review.record(db,id,{contenido:raw,errors:[]});
    db.prepare('UPDATE assets SET autorizado_publicar=0').run();
    assert.throws(()=>content.setEstado(db,id,'aprobado'),/no autorizado/);
  }finally{db.close();}
});
test('una reparación automática como máximo; un segundo fallo se conserva sin guardar paquete',async()=>{
  const db=setup(),old=process.env.ANTHROPIC_API_KEY;process.env.ANTHROPIC_API_KEY='fixture';let calls=0;
  try {
    await assert.rejects(content.generatePackage(db,{brief,extra:'imagen_unica'},{fetchImpl:async()=>{
      calls++;return {ok:true,json:async()=>({content:[{type:'text',text:'JSON incorrecto'}]})};
    }}),/revisión fallida/);
    assert.equal(calls,2);assert.equal(db.prepare('SELECT COUNT(*) n FROM failed_visual_reviews').get().n,1);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM generated').get().n,0);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM content_packages').get().n,0);
  }finally{if(old===undefined)delete process.env.ANTHROPIC_API_KEY;else process.env.ANTHROPIC_API_KEY=old;db.close();}
});
test('regenerar imagen conserva copies y vuelve a revisión',async()=>{
  const db=setup(),original={...image(),copies:[{plataforma:'instagram',idioma:'es',text:'Copy aprobado por el fixture'}]};
  try {
    const id=db.prepare("INSERT INTO generated(tipo,idioma,contenido,estado) VALUES('imagen_unica','es',?,'aprobado')").run(JSON.stringify(original)).lastInsertRowid;
    await revisions.regenerate(db,id,{}, {content:{generate:async()=>({contenido:JSON.stringify(image())})}});
    const row=db.prepare('SELECT * FROM generated WHERE id=?').get(id);
    assert.deepEqual(JSON.parse(row.contenido).copies,original.copies);assert.equal(row.estado,'revision');
  }finally{db.close();}
});
test('carrusel de 3–5 respeta layouts y requiere foto autorizada, CTA y render vigente',()=>{
  const db=setup();
  const slides=[{layout:'portada',data:{eyebrow:'Tu viaje',h1:'Planifica Humantay',imageUrl:'https://fixture.invalid/foto.jpg'}},{layout:'pasos',data:{eyebrow:'Paso a paso',h2:'Organiza tu visita',steps:[{title:'Consulta',text:'Consulta las opciones disponibles.'}]}},{layout:'cierre',data:{eyebrow:'Tu siguiente paso',h2:'Consulta tus fechas',body:'Comparte tus fechas de viaje.',ctaText:'Escríbenos'}}];
  for(const n of [3,4,5])assert.equal(content.validateCarouselStrict({tipo:'informativo',slides:[slides[0],...Array.from({length:n-2},()=>slides[1]),slides[2]]}).ok,true);
  assert.equal(content.validateCarouselStrict({tipo:'informativo',slides:[slides[0],slides[1],slides[1]]}).ok,false);
  try {
    const raw=JSON.stringify({tipo:'informativo',slides});
    const id=db.prepare("INSERT INTO generated(tipo,idioma,contenido) VALUES('carrusel','es',?)").run(raw).lastInsertRowid;
    review.record(db,id,{contenido:raw,errors:[]});assert.equal(content.setEstado(db,id,'aprobado').estado,'aprobado');
    db.prepare('UPDATE assets SET autorizado_publicar=0').run();assert.throws(()=>content.setEstado(db,id,'aprobado'),/imagen no autorizada/);
  }finally{db.close();}
});
test('sugerencia de formato usa consultas comparables, no likes ni mezcla de plataformas',()=>{
  assert.match(visual.formatRecommendation(null),/Hipótesis/);
  const group=(n,consultas,platform='instagram')=>({n,negocio:{consultas},plataformas:[platform],confianza:'senal_inicial'});
  const data={por_formato:{imagen_unica:group(5,3),carrusel:group(5,4)}};
  assert.match(visual.formatRecommendation(data),/Sugerencia exploratoria: Carrusel/);
  assert.match(visual.formatRecommendation({por_formato:{imagen_unica:group(5,3),carrusel:group(5,4,'facebook')}}),/Hipótesis/);
  assert.match(visual.formatRecommendation({por_formato:{imagen_unica:group(5,0),carrusel:{...group(5,0),likes:99999}}}),/Hipótesis/);
});
test('migraciones son idempotentes y no autorizan recursos existentes',()=>{
  const db=open(':memory:');
  try{
    const id=db.prepare("INSERT INTO assets(tipo,url) VALUES('foto','https://fixture.invalid/historica.jpg')").run().lastInsertRowid;
    db.exec('ALTER TABLE assets DROP COLUMN autorizado_publicar');
    db.exec('ALTER TABLE generated DROP COLUMN plataforma');
    db.exec('ALTER TABLE generated DROP COLUMN visual_repair_used');
    migrate(db);migrate(db);
    assert.equal(db.prepare('SELECT autorizado_publicar FROM assets WHERE id=?').get(id).autorizado_publicar,0);
    assert.ok(db.prepare('PRAGMA table_info(generated)').all().some(x=>x.name==='plataforma'));
  }finally{db.close();}
});
test('presupuesto automático persistido no se renueva al repetir la revisión',async()=>{
  const db=setup();let calls=0;
  try{
    const id=db.prepare("INSERT INTO generated(tipo,idioma,contenido) VALUES('imagen_unica','es',?)").run(JSON.stringify(image())).lastInsertRowid;
    const deps={content:{generate:async()=>{calls++;return {contenido:JSON.stringify(image())};}}};
    await revisions.regenerate(db,id,{automatic_visual_repair:true},deps);
    await assert.rejects(revisions.regenerate(db,id,{automatic_visual_repair:true},deps),/Ya se usó/);
    assert.equal(calls,1);assert.equal(db.prepare('SELECT visual_repair_used FROM generated WHERE id=?').get(id).visual_repair_used,1);
    await revisions.regenerate(db,id,{instruccion:'Corrección humana solicitada'},deps);assert.equal(calls,2);
  }finally{db.close();}
});
test('reparar imagen única conserva la plataforma de destino y no modifica el brief',async()=>{
  const db=setup(),old=process.env.ANTHROPIC_API_KEY;process.env.ANTHROPIC_API_KEY='fixture';
  const source=structuredClone(brief),before=structuredClone(source),prompts=[];
  try {
    const result=await content.generate(db,{brief:source,tipo:'imagen_unica',platform_override:'facebook'},{fetchImpl:async(_url,opts)=>{
      prompts.push(JSON.parse(opts.body).messages[0].content);
      const data=image();data.plataforma='facebook';
      if(prompts.length===1)data.visual.headline='palabra '.repeat(9).trim();
      return {ok:true,json:async()=>({content:[{type:'text',text:JSON.stringify(data)}]})};
    }});
    assert.equal(prompts.length,2);
    assert.ok(prompts.every(prompt=>prompt.includes('Plataforma: facebook')));
    assert.equal(result.plataforma,'facebook');assert.equal(JSON.parse(result.contenido).plataforma,'facebook');
    assert.equal(result.visual_repair_used,1);assert.deepEqual(source,before);
  }finally{if(old===undefined)delete process.env.ANTHROPIC_API_KEY;else process.env.ANTHROPIC_API_KEY=old;db.close();}
});
test('foto de Cloudinary de Tikaymi pegada por una persona se registra y permite aprobar; ajenas o retiradas no',()=>{
  assert.equal(visual.isCloudinaryPhoto('https://res.cloudinary.com/tikaymi/image/upload/c_fill,ar_4:5/v1/tours/machu.jpg'),true);
  for(const url of ['https://res.cloudinary.com/otra/image/upload/x.jpg','https://res.cloudinary.com/tikaymi/image/fetch/https://evil.example/x.jpg','http://res.cloudinary.com/tikaymi/image/upload/x.jpg','https://res.cloudinary.com/tikaymi/image/upload/','no es url'])
    assert.equal(visual.isCloudinaryPhoto(url),false,url);
  const db=setup(),url='https://res.cloudinary.com/tikaymi/image/upload/v1/tours/machu.jpg';
  try{
    // La IA no puede usar una URL de Cloudinary no registrada: la validación de generación no admite pegadas.
    assert.match(visual.validateSingle(image('producto',url),{resources:['https://fixture.invalid/foto.jpg']}).errors.join(),/no autorizado/);
    assert.equal(visual.validateSingle(image('producto',url),{resources:[],allowCloudinary:true,revoked:[]}).ok,true);
    const id=db.prepare("INSERT INTO generated(tipo,idioma,contenido) VALUES('imagen_unica','es',?)").run(JSON.stringify(image())).lastInsertRowid;
    const raw=JSON.stringify(image('producto',url));
    assert.deepEqual(revisions.edit(db,id,{contenido:raw,segmento:'pieza',motivo:'Foto desde Cloudinary'}).fotos_registradas,[url]);
    assert.deepEqual(revisions.edit(db,id,{contenido:raw,segmento:'pieza',motivo:'Repetir'}).fotos_registradas,[]);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM assets WHERE url=? AND autorizado_publicar=1').get(url).n,1);
    review.record(db,id,{contenido:raw,errors:[]});assert.equal(content.setEstado(db,id,'aprobado').estado,'aprobado');
    // Retirarla en Biblioteca bloquea la aprobación y una nueva edición no la reautoriza.
    db.prepare('UPDATE assets SET autorizado_publicar=0 WHERE url=?').run(url);
    revisions.edit(db,id,{contenido:raw,segmento:'pieza',motivo:'Otra vez'});
    review.record(db,id,{contenido:raw,errors:[]});assert.throws(()=>content.setEstado(db,id,'aprobado'),/no autorizado/);
    assert.equal(visual.validateSingle(image('producto',url),{resources:[],allowCloudinary:true,revoked:[url]}).ok,false);
    // Ajena a la cuenta: no se registra.
    const other=JSON.stringify(image('producto','https://res.cloudinary.com/otra/image/upload/x.jpg'));
    assert.deepEqual(revisions.edit(db,id,{contenido:other,segmento:'pieza',motivo:'Ajena'}).fotos_registradas,[]);
  }finally{db.close();}
});
test('carrusel registra fotos pegadas de portada, galería y antes/después',()=>{
  const db=setup(),base='https://res.cloudinary.com/tikaymi/image/upload/v1/';
  try{
    const slides=[{layout:'portada',data:{imageUrl:base+'a.jpg'}},{layout:'galeria',data:{photos:[{imageUrl:base+'b.jpg'},{imageUrl:base+'a.jpg'}]}},{layout:'antes-despues',data:{beforeUrl:base+'c.jpg',afterUrl:'https://fixture.invalid/foto.jpg'}}];
    const id=db.prepare("INSERT INTO generated(tipo,idioma,contenido) VALUES('carrusel','es','{}')").run().lastInsertRowid;
    assert.deepEqual(revisions.edit(db,id,{contenido:JSON.stringify({tipo:'producto',slides}),segmento:'pieza',motivo:'Fotos'}).fotos_registradas,[base+'a.jpg',base+'b.jpg',base+'c.jpg']);
    const copyId=db.prepare("INSERT INTO generated(tipo,idioma,contenido) VALUES('copy','es','x')").run().lastInsertRowid;
    assert.deepEqual(revisions.edit(db,copyId,{contenido:'Mira '+base+'d.jpg',motivo:'Texto'}).fotos_registradas,[]);
  }finally{db.close();}
});
