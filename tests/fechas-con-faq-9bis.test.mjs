import {test} from 'node:test'
import assert from 'node:assert/strict'
import {escenario} from './webhook-fixture.mjs'
import {detectarFaqAprobada,esPreguntaHorarioEntrada} from '../lib/anaxagoras/faq.js'
import {TEXTOS,condicionesEstancia} from '../lib/anaxagoras/textos.js'
import {resolverDisponibilidadFase2,DEPOSITO_NOCHE_TEXTO,DEPOSITO_MENSUAL_TEXTO} from '../lib/whatsapp/fase2-disponibilidad.ts'

const frases=[
  {texto:'Llego mañana, ¿tienen algo disponible para 3 noches?',entrada:'2026-11-03',salida:'2026-11-06',total:'$2,400 MXN',faq:'entrada_salida'},
  {texto:'Vengo a visitar a mi familia del 10 al 15 de diciembre, somos 2',entrada:'2026-12-10',salida:'2026-12-15',total:'$4,000 MXN',faq:null},
  {texto:'Necesito factura, del 3 al 6 de enero 2 personas',entrada:'2027-01-03',salida:'2027-01-06',total:'$2,400 MXN',faq:'impuestos'},
]
for(const f of frases) test(`9-bis: ${f.texto}`,async()=>{
  for(const fase of ['nombre','confirmar_precios','checkin','checkout','personas']) {
    const llamadas=[]
    const s=escenario(fase,'+525500000009',{hoy:'2026-11-02',consultar:async p=>{llamadas.push(p);return {disponibles:[{id:'m',nombre:'PB-03',tipo:'mediano'}],ocupados:[]}}})
    // La primera frase no especifica huéspedes: reutilizar el dato ya capturado.
    Object.assign(s.db.leads[0],{num_personas:2,fecha_checkin:'2026-11-01'})
    await s.enviar(f.texto)
    assert.equal(s.db.leads[0].fecha_checkin,f.entrada,fase)
    assert.equal(s.db.leads[0].fecha_checkout,f.salida,fase)
    assert.equal(s.db.leads[0].num_personas,2)
    assert.equal(llamadas.length,1)
    assert.deepEqual(llamadas[0],{checkin:f.entrada,checkout:f.salida,personas:2})
    const respuesta=s.respuestas()[0].body
    assert.match(respuesta,/Sí tenemos disponibilidad estimada/)
    assert.match(respuesta,/Total estimado/)
    assert.ok(respuesta.includes(f.total),`${fase}: total exacto`)
    assert.equal(respuesta.split(DEPOSITO_NOCHE_TEXTO).length-1,1)
    if(f.faq) assert.ok(respuesta.includes(TEXTOS[f.faq]))
    else assert.ok(!respuesta.includes(TEXTOS.visitas))
    assert.equal(s.respuestas().length,1,'Cotización y FAQ en un solo mensaje')
  }
})
test('9-bis: horario con hora explícita conserva fechas y no consulta disponibilidad',async()=>{
 for(const texto of ['¿a qué hora puedo entrar mañana a las 8 am?','¿Puedo llegar mañana desde las 8:00 am?']) {
  assert.equal(esPreguntaHorarioEntrada(texto),true)
  const s=escenario('checkin','+525500000009',{hoy:'2026-11-02'})
  Object.assign(s.db.leads[0],{fecha_checkin:'2026-12-10',fecha_checkout:'2026-12-15',num_personas:2})
  const antes=structuredClone(s.db.leads[0])
  await s.enviar(texto)
  assert.deepEqual(s.db.leads[0],antes)
  assert.ok(s.respuestas()[0].body.includes(TEXTOS.entrada_salida))
  assert.equal(s.db.whatsapp_conversaciones[0].fase,'checkin')
 }
 assert.equal(esPreguntaHorarioEntrada(frases[0].texto),false)
})
test('9-bis: visitar familia, ciudad o trabajo no es pedir visitas al loft',()=>{
 for(const texto of ['Vengo a visitar a mi familia','Voy a visitar la ciudad','Voy a visitar por trabajo','Vengo a visitar a mi familia por 3 noches']) assert.equal(detectarFaqAprobada(texto),null,texto)
 for(const texto of ['¿puedo ir a verlo?','¿Puedo conocer las instalaciones?','¿Se permiten visitas?','Quiero visitar el loft','¿Puedo recibir visitas?']) assert.equal(detectarFaqAprobada(texto),'visitas',texto)
})
test('9-bis: mascotas sin fechas sigue como FAQ y conserva el lead',async()=>{
 const s=escenario('personas');const antes=structuredClone(s.db.leads[0])
 await s.enviar('¿aceptan mascotas?')
 assert.ok(s.respuestas()[0].body.includes(TEXTOS.mascotas));assert.deepEqual(s.db.leads[0],antes)
 assert.equal(s.db.whatsapp_conversaciones[0].fase,'personas')
})
test('9-bis: nombre y personas explícitos se capturan aunque haya factura y fechas',async()=>{
 const s=escenario('nombre','+525500000009',{hoy:'2026-11-02',consultar:async()=>({disponibles:[{nombre:'PB-03',tipo:'mediano'}],ocupados:[]})})
 await s.enviar('Me llamo Mariana López, necesito factura, del 3 al 6 de enero 2 personas')
 assert.equal(s.db.leads[0].nombre,'Mariana López');assert.equal(s.db.leads[0].num_personas,2)
 assert.equal(s.db.leads[0].fecha_checkin,'2027-01-03');assert.equal(s.db.leads[0].fecha_checkout,'2027-01-06')
 assert.match(s.respuestas()[0].body,/Total estimado/);assert.ok(s.respuestas()[0].body.includes(TEXTOS.impuestos))
})
test('9-bis: sin personas guardadas pide el dato, conserva fechas y luego cotiza',async()=>{
 const s=escenario('checkin','+525500000009',{hoy:'2026-11-02',consultar:async()=>({disponibles:[{nombre:'PB-01',tipo:'chico'}],ocupados:[]})})
 await s.enviar(frases[0].texto)
 assert.equal(s.db.leads[0].fecha_checkin,'2026-11-03');assert.equal(s.db.leads[0].fecha_checkout,'2026-11-06')
 assert.equal(s.db.whatsapp_conversaciones[0].fase,'personas')
 await s.enviar('1 persona');assert.match(s.respuestas().at(-1).body,/Total estimado/)
})
test('9-bis: integración #57/#58, fresca y vieja conservan depósito único y condiciones noche/mes',async()=>{
 for(const datosViejos of [false,true]) for(const mensual of [false,true]) {
  const r=await resolverDisponibilidadFase2({nombre:'Demo',whatsapp:'ficticio',checkin:'2026-11-03',checkout:mensual?'2026-12-03':'2026-11-06',personas:2,consultar:async()=>({datosViejos,disponibles:[{nombre:'PB-03',tipo:'mediano'}],ocupados:[]})})
  assert.equal(r.ok,true)
  if(datosViejos) {assert.match(r.response,/Tengo una opción estimada pendiente de confirmar/);assert.match(r.response,/Un asesor te confirma disponibilidad antes de apartar/);assert.doesNotMatch(r.response,/Sí tenemos|aparece disponible/)}
  else assert.match(r.response,/Sí tenemos disponibilidad estimada/)
  const deposito=mensual?DEPOSITO_MENSUAL_TEXTO:DEPOSITO_NOCHE_TEXTO
  assert.equal(r.response.split(deposito).length-1,1)
  assert.ok(r.response.includes(condicionesEstancia(mensual?'mes':'noche')))
  if(!mensual) assert.ok(r.response.includes(TEXTOS.proceso_noche))
 }
})

test('9-bis: factura con fecha inválida pide corrección sin consultar disponibilidad',async()=>{
 const s=escenario('checkin','+525500000009',{hoy:'2026-11-02'})
 await s.enviar('Necesito factura, del 03/01/20277 al 06/01/2027, 2 personas')
 assert.match(s.respuestas()[0].body,/confirma.*fecha|año.*válido/i)
 assert.ok(s.respuestas()[0].body.includes(TEXTOS.impuestos))
 assert.equal(s.db.leads[0].fecha_checkin,undefined)
})
