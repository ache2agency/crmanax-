import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as crypto from 'node:crypto'
import { Buffer } from 'node:buffer'
import ts from 'typescript'
import { createClient } from '@supabase/supabase-js'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cache = new Map()
function load(path, overrides = {}) {
  path = resolve(root,path)
  if (!Object.keys(overrides).length && cache.has(path)) return cache.get(path)
  const exports = {}
  if (!Object.keys(overrides).length) cache.set(path,exports)
  runInNewContext(ts.transpileModule(readFileSync(path,'utf8'), { compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022} }).outputText,
    { exports, URL, Request, Response, AbortController, setTimeout, clearTimeout, Date, console:{warn(){}}, require(name) {
      if (name in overrides) return overrides[name]
      if (name === 'node:crypto') return crypto
      if (name === 'node:buffer') return { Buffer }
      if (name.startsWith('.')) return load(resolve(dirname(path),name)+'.ts')
      if (name.startsWith('@/lib/')) return load(name.replace('@/','')+'.ts')
      throw Error('Import externo no autorizado: '+name)
    } })
  return exports
}
const { calcularResumen, crearResumen, resumenTexto, proximoInicio } = load('lib/lectura/resumen.ts')
const { configuracionResumen: config } = load('lib/lectura/resumen-config.ts')
const { crearLectura } = load('lib/lectura/servicio.ts')
const isWindsor = config.crm === 'Windsor'
const now = Date.parse('2026-11-10T15:45:00Z') // 9:45 CDMX
const iso = hours => new Date(now-hours*3600000).toISOString()
const empty = () => ({conversaciones:[],mensajes:[],nuevos:[],actividades:[]})
function chat(d, { id='c1', fase='saludo', stage='nuevo_contacto', humano=false, curso='Inglés', telefono='+525500000054', created=iso(70), paso=iso(70) } = {}) {
  const c={id,whatsapp:telefono,fase,modo_humano:humano,ultimo_mensaje_at:iso(1),lead:{id:'l'+id,nombre:'Persona ficticia',curso,loft_id:'loft-ficticio',stage,created_at:created,paso_desde:paso}}
  d.conversaciones.push(c); return c
}
function msg(d, rol, contenido, horas=1, c='c1') { const m={id:String(d.mensajes.length).padStart(5,'0'),conversacion_id:c,rol,contenido,created_at:iso(horas)}; d.mensajes.push(m);return m }
const calc = (d, horas=24) => JSON.parse(JSON.stringify(calcularResumen(d,config,now,horas)))
const reglas = r => r.requieren_atencion.flatMap(c=>c.razones.map(x=>x.regla))
function activity(d,c,destino,horas=30) { d.actividades.push({lead_id:c.lead.id,event_type:'stage_changed',destino,created_at:iso(horas),lead:{whatsapp:c.whatsapp,conversaciones:[{fase:c.fase}]}}) }

test('a: >15 min sin bot/agente; límite exacto, respondido y fuera de periodo',()=>{
  for(const [hours,respond,expected] of [[.251,false,true],[.25,false,false],[1,true,false],[25,false,false]]) {
    const d=empty();chat(d);msg(d,'usuario','Hola',hours);if(respond) msg(d,'bot','Hola',hours-.01)
    assert.equal(reglas(calc(d)).includes('a'),expected)
  }
})
test('b: humano requiere agente aunque haya bot; agente posterior resuelve',()=>{
  const d=empty();chat(d,{humano:true});msg(d,'usuario','Hola');msg(d,'bot','Hola',.9)
  assert.ok(reglas(calc(d)).includes('b'));msg(d,'agente','Te atiendo',.8);assert.ok(!reglas(calc(d)).includes('b'))
})
test('c: intención/etapa estancada 24h; avance reciente y terminal evitan alerta',()=>{
  const d=empty(), c=chat(d,{fase:isWindsor?'inscribiendo':'esperando_asesor', stage:isWindsor?'inscripcion_pendiente':'deposito_pendiente'})
  msg(d,'usuario',isWindsor?'Quiero inscribirme':'Quiero reservar',25)
  assert.ok(reglas(calc(d)).includes('c'))
  activity(d,c,isWindsor?'inscripcion_pendiente':'deposito_pendiente',1)
  assert.ok(!reglas(calc(d)).includes('c'))
  c.lead.stage=config.logros[0];d.actividades=[];assert.ok(!reglas(calc(d)).includes('c'))
  const n=empty();chat(n);msg(n,'usuario','No quiero reservar',25);assert.ok(!reglas(calc(n)).includes('c'))
})
for(const [tema,pregunta,respuesta] of [['precio','¿Cuál es el costo?','El costo es $649'],['promoción','¿Hay promociones?','30% de descuento'],['dirección','¿Dónde están?','Calle Ficticia 123'],['horario','¿Cuál es el horario?','Miércoles de 7 a 9 pm']]) test('d: '+tema+' sin dato, dato posterior y agente',()=>{
  const d=empty();chat(d);msg(d,'usuario',pregunta);msg(d,'bot','¿Cómo te llamas?',.9)
  assert.ok(reglas(calc(d)).includes('d'))
  msg(d,'bot',respuesta,.8);assert.ok(!reglas(calc(d)).includes('d'))
  const e=empty();chat(e);msg(e,'usuario',pregunta);msg(e,'agente','Revisaré tu caso',.9);assert.ok(!reglas(calc(e)).includes('d'))
})
test('e: calendario oficial próximo ≤2 días, nunca individual ni terminal',()=>{
  const d=empty(), c=chat(d,{curso:'Diplomado ficticio'})
  const r=calc(d);assert.ok(!reglas(r).includes('e'));assert.equal(r.totales.diplomados_inicio_proximo?.sin_inscribir,isWindsor?1:undefined)
  assert.equal(proximoInicio('11 de noviembre de 2026; 20 de enero de 2027',now),'2026-11-11')
  c.lead.curso+=' individual';assert.equal(calc(d).totales.diplomados_inicio_proximo?.sin_inscribir || 0,0)
  c.lead.curso='Diplomado ficticio';c.lead.stage=config.logros[0];assert.equal(calc(d).totales.diplomados_inicio_proximo?.sin_inscribir || 0,0)
  assert.equal(proximoInicio('20 de enero de 2027',now),null)
  assert.equal(proximoInicio('8 de noviembre de 2026',now),null)
})
test('f: caliente >21 y <24h; bot reciente no reabre, terminal no alerta',()=>{
  for(const [hours,expected] of [[21,false],[21.01,true],[23.99,true],[24,false],[25,false]]) {
    const d=empty();chat(d);msg(d,'usuario','Quiero reservar',hours);msg(d,'bot','Listo',.1)
    assert.equal(reglas(calc(d)).includes('f'),expected)
    assert.equal(calc(d).totales.ventana_24h,hours<24?1:0)
  }
})
test('g: automático de negocio prevalece; preguntar horario no es automático',()=>{
  const d=empty();chat(d,{humano:true});msg(d,'usuario','Gracias por comunicarte con Restaurante Ficticio. Horario de atención: 9 am')
  assert.deepEqual(reglas(calc(d)),['g'])
  assert.match(calc(d).requieren_atencion[0].razones[0].motivo,/no es lead/)
  const n=empty();chat(n);msg(n,'usuario','¿Cuál es su horario de atención?');assert.ok(!reglas(calc(n)).includes('g'))
})
test('corte ficticio 10-nov 9:45 CDMX: 42, Programa11/Decidiendo9/Saludo8/Info5/Inscribiéndose4/Correo2/Archivado2/Dudas1',()=>{
  if(!isWindsor)return
  const d=empty();let n=0
  for(const [fase,cantidad] of [['programa',11],['accion',9],['saludo',8],['info_enviada',5],['inscribiendo',4],['correo',2],['archivado',2],['dudas',1]]) for(let j=0;j<cantidad;j++) {
    const id='c'+n;chat(d,{id,telefono:'+525500'+String(n++).padStart(6,'0'),fase});msg(d,'usuario','Hola',23,id);msg(d,'bot','Hola',1,id)
  }
  chat(d,{id:'solo-bot'});msg(d,'bot','Envío no abre ventana',1,'solo-bot')
  chat(d,{id:'interno',telefono:'+527474722466'});msg(d,'usuario','Hola',1,'interno')
  chat(d,{id:'nota',fase:'nota'});msg(d,'usuario','Hola',1,'nota')
  const r=calc(d);assert.equal(r.totales.ventana_24h,42)
  assert.deepEqual(r.por_fase,{'Programa':11,'Decidiendo':9,'Saludo':8,'Info':5,'Inscribiéndose':4,'Correo':2,'Archivado':2,'Dudas':1})
})
test('nuevos por día CDMX incluye leads sin chat, excluye notas/interno; ayer transiciones únicas, no etapa actual',()=>{
  const d=empty(), c=chat(d,{stage:config.logros[0],paso:iso(70)})
  msg(d,'usuario','Hola');assert.equal(calc(d).ayer[isWindsor?'inscritos':'reservas'],0)
  activity(d,c,config.logros[0],20);activity(d,c,config.logros[0],21)
  activity(d,c,config.archivados[0],20)
  d.nuevos=[{id:'nuevo',whatsapp:'+525500000099',created_at:'2026-11-10T06:00:00Z'}, {id:'ayer',created_at:'2026-11-10T05:59:59Z'}, {id:'nota',created_at:iso(1),conversaciones:[{fase:'nota'}]}]
  if(isWindsor)d.nuevos.push({id:'interno',whatsapp:'+527474722466',created_at:iso(1)})
  const r=calc(d);assert.equal(r.totales.leads_nuevos_hoy,1);assert.equal(r.totales.leads_nuevos_ayer,1)
  assert.equal(r.ayer[isWindsor?'inscritos':'reservas'],1);assert.equal(r.ayer.archivados,1)
  msg(d,'bot','[Template: ficticia]',20);msg(d,'usuario','[Template: engaño]',20)
  Object.assign(msg(d,'agente','Inicio ficticio',21),{plantilla:'ficticia',envio_estado:'pendiente'})
  assert.equal(calc(d).ayer.plantillas_enviadas_detectadas,1)
})
test('salida solo campos autorizados, texto sensible/enlaces/control filtrados; sin mensajes originales',()=>{
  const d=empty(),c=chat(d,{humano:true});c.lead.nombre='token=oculto';c.lead.curso='https://privado.invalid/secreto';c.raw_payload={secreto:'NO MOSTRAR'}
  msg(d,'usuario','CLABE 012345678901234567');const r=calc(d),text=JSON.stringify(r)
  assert.ok(!/0123456789|NO MOSTRAR|privado.invalid|token=oculto|raw_payload/.test(text))
  assert.equal(r.requieren_atencion[0].nombre,'[contenido sensible omitido]')
  assert.ok(!('mensajes' in r));assert.match(resumenTexto(r),/Solo lectura/)
})

function setup({datos=empty(),token='ficticio',errorTable,delay=0,cap,serverPage=1000}={}) {
  let clients=0
  const calls=[]
  const db=createClient('https://resumen.invalid','ficticio',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init)=>{
    const req=new Request(input,init),u=new URL(req.url),table=u.pathname.split('/').at(-1)
    assert.equal(u.hostname,'resumen.invalid');assert.equal(req.method,'GET');assert.ok(!u.pathname.includes('rpc'))
    calls.push({table,params:u.searchParams})
    if(delay)await new Promise((ok,no)=>{const t=setTimeout(ok,delay);req.signal.addEventListener('abort',()=>{clearTimeout(t);no(new Error('abortado'))},{once:true})})
    if(table===errorTable)return Response.json({message:'credencial-proveedor'},{status:500})
    const selects={
      whatsapp_conversaciones:`id,whatsapp,fase,modo_humano,ultimo_mensaje_at,lead:leads(${config.leadSelect})`,
      whatsapp_mensajes:'id,conversacion_id,rol,contenido,created_at,plantilla:raw_payload->>template,plantilla_motor:raw_payload->seguimiento_motor->>templateName,envio_estado:raw_payload->>status',
      leads:'id,whatsapp,created_at,conversaciones:whatsapp_conversaciones(fase)',
      lead_activities:'lead_id,event_type,created_at,destino:meta->>to,lead:leads!inner(whatsapp,conversaciones:whatsapp_conversaciones(fase))',
    }
    assert.equal(u.searchParams.get('select'),selects[table])
    let rows={whatsapp_conversaciones:datos.conversaciones,whatsapp_mensajes:datos.mensajes,leads:datos.nuevos,lead_activities:datos.actividades}[table]
    if(cap&&table==='whatsapp_mensajes') rows=Array.from({length:cap},(_,i)=>({id:String(i),conversacion_id:'c1',rol:'bot',contenido:'Hola',created_at:iso(1)}))
    for(const [k,v] of u.searchParams) {
      if(v.startsWith('gte.'))rows=rows.filter(x=>x[k]>=v.slice(4))
      if(v.startsWith('lte.'))rows=rows.filter(x=>x[k]<=v.slice(4))
    }
    const offset=Number(u.searchParams.get('offset')||0),limit=Number(u.searchParams.get('limit'))
    assert.ok(limit<=1000);return Response.json(rows.slice(offset,offset+Math.min(limit,serverPage)),{headers:{'content-range':`${offset}-${Math.min(offset+limit,rows.length)-1}/${rows.length}`}})
  }}})
  const lectura=crearLectura({client(){clients++;return db},token:()=>token,now:()=>now,resumen:crearResumen(config)})
  const call=(query='',auth='Bearer ficticio',method='GET',tipo='resumen')=>lectura(new Request('https://local.invalid/api/lectura/resumen'+query,{method,headers:auth?{Authorization:auth}:{}}),tipo)
  return {call,calls,clients:()=>clients}
}
test('candado real T52: 401/503 y métodos/parametros sin inicializar BD; cuota compartida',async()=>{
  const s=setup()
  for(const auth of [null,'Bearer malo','Basic ficticio'])assert.equal((await s.call('',auth)).status,401)
  assert.equal((await setup({token:''}).call()).status,503)
  for(const method of ['POST','PUT','PATCH','DELETE','HEAD','OPTIONS'])assert.equal((await s.call('',null,method)).status,405)
  for(const q of ['?horas=0','?horas=169','?horas=1.5','?horas=','?horas=24&horas=48','?formato=html','?formato=texto&formato=json','?token=ficticio','?limite=1'])assert.equal((await s.call(q)).status,400,q)
  assert.equal(s.clients(),0)
  for(let i=0;i<60-9;i++)assert.equal((await s.call()).status,200)
  const r=await s.call('','Bearer ficticio','GET',false);assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'600')
})
test('endpoint SELECT real con fetch falso: JSON/texto, headers, ventana, tiempo <3s',async()=>{
  const d=empty();chat(d);msg(d,'usuario','Hola')
  const s=setup({datos:d}),start=performance.now(),r=await s.call()
  assert.equal(r.status,200);const b=await r.json();assert.equal(b.totales.ventana_24h,1)
  assert.ok(performance.now()-start<3000);assert.match(r.headers.get('cache-control'),/no-store/);assert.equal(r.headers.get('vary'),'Authorization');assert.equal(r.headers.get('access-control-allow-origin'),null)
  const t=await s.call('?formato=texto&horas=168');assert.match(t.headers.get('content-type'),/text\/plain/);assert.ok((await t.text()).split('\n').length<=31)
  assert.equal(s.calls.length,8)
  assert.deepEqual(s.calls.find(x=>x.table==='whatsapp_mensajes').params.getAll('created_at'),['gte.2026-11-03T15:45:00.000Z','lte.2026-11-10T15:45:00.000Z']) // filtros gte/lte repiten columna
})
test('paginación supera topes anteriores: conteos completos y páginas servidor de 400',async()=>{
  const d=empty()
  for(let i=0;i<1200;i++) { const id='c'+i;chat(d,{id});msg(d,'usuario','Hola',1,id);d.nuevos.push({id,created_at:iso(1)}) }
  const completo=await(await setup({datos:d,serverPage:400}).call()).json()
  assert.equal(completo.totales.ventana_24h,1200);assert.equal(completo.parcial,false)
  const s=setup({datos:d,cap:6000,serverPage:400}),start=performance.now()
  const b=await(await s.call()).json();assert.equal(b.parcial,false);assert.equal(b.totales.leads_nuevos_hoy,1200)
  assert.equal(s.calls.filter(x=>x.table==='whatsapp_conversaciones').length,3)
  assert.equal(s.calls.filter(x=>x.table==='whatsapp_mensajes').length,15)
  assert.ok(performance.now()-start<5000)
  assert.ok(!(await(await s.call('?formato=texto')).text()).includes('PARCIAL'))
})
test('tope exacto no es parcial; desborde informa cuántas filas faltaron',async()=>{
  const d=empty();chat(d);const start=performance.now()
  const exact=await(await setup({datos:d,cap:50000}).call()).json();assert.equal(exact.parcial,false)
  const s=setup({datos:d,cap:50007})
  const b=await(await s.call()).json();assert.equal(b.parcial,true);assert.equal(b.filas_faltantes.whatsapp_mensajes,7)
  assert.equal(s.calls.filter(x=>x.table==='whatsapp_mensajes').length,50)
  assert.ok(performance.now()-start<5000)
  assert.match(await(await setup({datos:d,cap:50007}).call('?formato=texto')).text(),/whatsapp_mensajes: faltaron 7 filas/)
})
test('fallo remoto genérico sin datos internos; deadline aborta <5s',async()=>{
  const r=await setup({errorTable:'leads'}).call();assert.equal(r.status,500);assert.ok(!(await r.text()).includes('credencial-proveedor'))
  const start=performance.now(),r2=await setup({delay:6000}).call();assert.equal(r2.status,504);assert.ok(performance.now()-start<5000)
})
test('ruta real usa singleton y rechaza HEAD/OPTIONS',async()=>{
  let seen
  const route=load('app/api/lectura/resumen/route.ts',{'@/lib/lectura/server':{lectura(req,tipo){seen=tipo;return Response.json({ok:true})}}})
  assert.equal((await route.GET(new Request('https://local.invalid'))).status,200);assert.equal(seen,'resumen')
  assert.equal(route.HEAD().status,405);assert.equal(route.OPTIONS().status,405)
})

test('Anax conserva etapas y equivalencias del Kanban actual; agregado por etapa en ventana',()=>{
  if(isWindsor)return
  const source=readFileSync(resolve(root,'app/crm.jsx'),'utf8')
  const etapas=Object.fromEntries([...source.slice(source.indexOf('const STAGES'),source.indexOf('const LEGACY_STAGE_MAP')).matchAll(/id: "([^"]+)"\s*,\s*label: "([^"]+)"/g)].map(m=>[m[1],m[2]]))
  assert.deepEqual(JSON.parse(JSON.stringify(config.etapas)),etapas)
  const d=empty();chat(d,{stage:'inscripcion_pendiente'});msg(d,'usuario','Hola');assert.deepEqual(calc(d).por_etapa,{'Deposito pendiente':1})
})

test('campos nulos de lead y conversación sin lead no rompen el resumen',()=>{
  const d=empty(), c=chat(d);c.lead.curso=null;c.lead.loft_id=null;c.lead.nombre=null
  msg(d,'usuario','Hola');assert.equal(calc(d).totales.ventana_24h,1)
  c.lead=null;assert.equal(calc(d).requieren_atencion[0].nombre,null)
})

test('120 diplomados próximos + a/b/d: agregado único y urgencias primero, también vía endpoint',async()=>{
  const d=empty()
  for(let i=0;i<120;i++) {
    const id='e'+i;chat(d,{id,curso:'Diplomado '+(i<80?'Restaurantes':'Terapia'),telefono:'+525500'+String(i).padStart(6,'0')})
    msg(d,'usuario','Hola',1,id);msg(d,'bot','Hola',.9,id)
  }
  chat(d,{id:'a',telefono:'+525599000001'});msg(d,'usuario','Hola',1,'a')
  chat(d,{id:'b',humano:true,telefono:'+525599000002'});msg(d,'usuario','Hola',.5,'b');msg(d,'bot','Hola',.4,'b')
  chat(d,{id:'d',telefono:'+525599000003'});msg(d,'usuario','¿Cuál es el costo?',.2,'d');msg(d,'bot','¿Cómo te llamas?',.1,'d')
  const s=setup({datos:d}),r=await(await s.call()).json(),text=await(await s.call('?formato=texto')).text()
  assert.equal(r.parcial,false);assert.equal(r.totales.ventana_24h,123)
  assert.deepEqual(r.requieren_atencion.map(c=>c.razones[0].regla),['a','b','d'])
  assert.ok(!reglas(r).includes('e'))
  if(isWindsor) {
    assert.equal(r.totales.diplomados_inicio_proximo.sin_inscribir,120)
    assert.deepEqual(r.totales.diplomados_inicio_proximo.por_diplomado,{'Diplomado Restaurantes':80,'Diplomado Terapia':40})
    assert.equal(text.split('Diplomados con inicio').length-1,1)
    assert.match(text,/2026-11-11 sin inscribir: 120/)
  }
  assert.ok(text.indexOf('+525599000001')<text.indexOf('+525599000002'))
  assert.ok(text.indexOf('+525599000002')<text.indexOf('+525599000003'))
})
test('orden a/b/d/c/f/g y actividad reciente dentro de regla; máximo 25, resto JSON',()=>{
  const d=empty()
  for(let i=0;i<27;i++) {
    const id='a'+i,c=chat(d,{id,telefono:'+525500'+String(i).padStart(6,'0')})
    c.ultimo_mensaje_at=iso(2-i*.01);msg(d,'usuario','Hola',2-i*.01,id)
  }
  chat(d,{id:'b',humano:true});msg(d,'usuario','Hola',1,'b');msg(d,'bot','Hola',.9,'b')
  chat(d,{id:'d'});msg(d,'usuario','Precio',1,'d');msg(d,'bot','Tu nombre',.9,'d')
  chat(d,{id:'c'});msg(d,'usuario','Quiero reservar',25,'c')
  chat(d,{id:'f'});msg(d,'usuario','Quiero reservar',22,'f');msg(d,'bot','Listo',1,'f')
  chat(d,{id:'g'});msg(d,'usuario','Mensaje automático',.1,'g')
  const r=calc(d),text=resumenTexto(r)
  assert.deepEqual(r.requieren_atencion.slice(27).map(c=>c.razones[0].regla),['b','d','c','f','g'])
  assert.equal(r.requieren_atencion[0].whatsapp,'+525500000026')
  assert.equal(text.split('→').length-1,25);assert.match(text,/\+7 casos más/)
})

test('actividades >2000 completas; diplomado con urgencia conserva caso y deduplica total',async()=>{
  const d=empty(),c=chat(d,{curso:'Diplomado Restaurantes'})
  msg(d,'usuario','Hola',1)
  for(let i=0;i<2200;i++) d.actividades.push({lead_id:'l'+i,event_type:'stage_changed',destino:config.logros[0],created_at:iso(20),lead:{whatsapp:'+525500000000'}})
  const r=await(await setup({datos:d}).call()).json()
  assert.equal(r.ayer[isWindsor?'inscritos':'reservas'],2200);assert.equal(r.parcial,false)
  assert.equal(r.requieren_atencion[0].razones[0].regla,'a')
  if(isWindsor) {
    const copia={...c,id:'duplicado'};d.conversaciones.push(copia)
    assert.equal(calc(d).totales.diplomados_inicio_proximo.sin_inscribir,1)
  }
})
