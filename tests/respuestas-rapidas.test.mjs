import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TEXTOS, RESPUESTAS_RAPIDAS } from '../lib/anaxagoras/textos.js'
import { detectarFaqAprobada } from '../lib/anaxagoras/faq.js'
import { resolverDisponibilidadFase2, DEPOSITO_NOCHE_TEXTO, DEPOSITO_MENSUAL_TEXTO } from '../lib/whatsapp/fase2-disponibilidad.ts'
import { escenario } from './webhook-fixture.mjs'

const preguntas = [
  ['¿aceptan mascotas?', 'mascotas'],
  ['¿cuánto por persona extra?', 'persona_adicional'],
  ['¿a qué hora puedo entrar?', 'entrada_salida'],
  ['¿puedo ir a verlo?', 'visitas'],
  ['¿incluye IVA?', 'impuestos'],
  ['¿qué piden de comprobante de ingresos?', 'comprobante_ingresos'],
  ['¿Mi visita se puede quedar a dormir?', 'persona_adicional'],
  ['¿Tiene cocina y áreas comunes?', 'areas_comunes'],
  ['¿Tienen jacuzzi?', 'areas_comunes'],
  ['¿El contrato es mensual?', 'contrato_mensual'],
  ['¿Tienen otra ubicación?', 'ubicacion_unica'],
  ['¿Tienen lofts en Guadalajara?', 'ubicacion_unica'],
  ['¿Qué datos necesitas para cotizar?', 'pedir_fechas'],
  ['¿Qué parte de los estados de cuenta de los últimos 3 meses necesitan?', 'comprobante_ingresos'],
  ['¿Puedo entrar mañana a las 8 am?', 'entrada_salida'],
]

function caso(fase, opts = {}) {
  const s = escenario(fase, '+525500000009', { hoy: '2026-11-01', consultar: async () => { throw Error('Una FAQ no debe consultar disponibilidad') }, ...opts })
  Object.assign(s.db.leads[0], { tipo_renta:'noche', fecha_checkin:'2026-11-04',fecha_checkout:'2026-11-09',num_personas:1 })
  return s
}

test('las once respuestas nuevas están en el grupo indicado con el mismo texto del bot', () => {
  const general = RESPUESTAS_RAPIDAS.find(g => g.grupo === 'Información general').items
  const proceso = RESPUESTAS_RAPIDAS.find(g => g.grupo === 'Proceso de reserva').items
  for (const [items, mapping] of [[general, { 'Persona adicional':'persona_adicional','Mascotas':'mascotas','Impuestos / factura':'impuestos','Áreas comunes y cocina':'areas_comunes','Ubicación única':'ubicacion_unica' }], [proceso, { 'Horario de visitas':'visitas','Pedir fechas':'pedir_fechas','Proceso para apartar (por noche)':'proceso_noche','Horario de entrada y salida':'entrada_salida','Contrato mensual':'contrato_mensual','Comprobante de ingresos':'comprobante_ingresos' }]]) {
    for (const [label,key] of Object.entries(mapping)) assert.equal(items.find(i => i.label === label)?.texto, TEXTOS[key],label)
  }
  assert.equal(proceso.some(i => i.label === 'Confirmar disponibilidad / visita'),false)
  assert.equal(proceso.find(i => i.label === 'Depósito en garantía (por noche)').texto,DEPOSITO_NOCHE_TEXTO)
  const mensual = proceso.find(i => i.label === 'Requisitos arrendamiento mensual').texto
  assert.ok(mensual.includes(TEXTOS.comprobante_ingresos)); assert.match(mensual,/anaxagoras41suite@gmail\.com/)
  assert.match(mensual,/\$5,000/); assert.ok(mensual.endsWith('https://anaxagoras41suite.arqarri.com/#blog'))
})

test('el selector del CRM importa el catálogo compartido sin una copia local', () => {
  const panel = readFileSync(new URL('../components/crm/ConversationsPanel.jsx',import.meta.url),'utf8')
  assert.match(panel,/import \{ RESPUESTAS_RAPIDAS \} from "@\/lib\/anaxagoras\/textos"/)
  assert.match(panel,/RESPUESTAS_RAPIDAS\.map/)
  assert.doesNotMatch(panel,/const RESPUESTAS_RAPIDAS =/)
})

for (const [pregunta,key] of preguntas) {
  test(`FAQ: ${pregunta} conserva fase y datos en cada paso`, async () => {
    assert.equal(detectarFaqAprobada(pregunta),key)
    for (const fase of ['nombre','confirmar_precios','checkin','checkout','personas','confirmar_interes','tipo_loft','esperando_asesor']) {
      const s = caso(fase)
      const antes = structuredClone(s.db.leads[0])
      await s.enviar(pregunta)
      assert.equal(s.respuestas().length,1,`${fase}: ${pregunta}`)
      assert.ok(s.respuestas()[0].body.includes(TEXTOS[key]),`${fase}: ${pregunta}`)
      assert.equal(s.db.whatsapp_conversaciones[0].fase,fase)
      assert.deepEqual(s.db.leads[0],antes)
      assert.equal(s.enviados.length,1,'Sin alertas de asesor por resolver una pregunta factual')
    }
  })
}

test('todas las FAQ nuevas en espera respetan flag, modo humano y asesor en últimas 12 horas', async () => {
  for (const [pregunta] of preguntas) {
    for (const bloqueo of ['flag','humano','asesor']) {
      const s = caso('esperando_asesor',bloqueo === 'flag' ? { faqEspera:'off' } : {})
      if (bloqueo === 'humano') s.db.whatsapp_conversaciones[0].modo_humano=true
      if (bloqueo === 'asesor') s.db.whatsapp_mensajes.push({ id:'agente',conversacion_id:'conv',rol:'agente',created_at:new Date(Date.now()-3600000).toISOString(),contenido:'Te atiendo' })
      await s.enviar(pregunta)
      assert.equal(s.respuestas().length,0,`${bloqueo}: ${pregunta}`)
      assert.equal(s.db.whatsapp_conversaciones[0].fase,'esperando_asesor')
    }
  }
})

test('depósito por reservación exacto en FAQ y cotización, uno solo aunque cambie la duración; mes sin cambios', async () => {
  assert.equal(DEPOSITO_NOCHE_TEXTO,'Más depósito en garantía de $649.00 pesos por reservación vía transferencia bancaria (se regresa por transferencia a la cuenta de origen al concluir tu estancia, una vez revisado que todo se encuentre en buen estado, como lo recibió el huésped)')
  for (const noches of [2,5,15]) {
    const checkout = new Date(Date.UTC(2026,10,4+noches)).toISOString().slice(0,10)
    const r = await resolverDisponibilidadFase2({ nombre:'Demo',whatsapp:'ficticio',checkin:'2026-11-04',checkout,personas:1,consultar:async () => ({ disponibles:[{ id:'loft',nombre:'PB-01',tipo:'chico' }],ocupados:[] }) })
    assert.equal(r.ok,true)
    assert.equal(r.response.split(DEPOSITO_NOCHE_TEXTO).length-1,1)
    for (const key of ['proceso_noche','entrada_salida','impuestos']) assert.ok(r.response.includes(TEXTOS[key]))
    assert.doesNotMatch(r.response,/5 a 3 días/)
  }
  const s=caso('esperando_asesor'); await s.enviar('¿Cuánto es el depósito en garantía?')
  assert.ok(s.respuestas()[0].body.includes(DEPOSITO_NOCHE_TEXTO))
  assert.equal(DEPOSITO_MENSUAL_TEXTO,'Más depósito en garantía de $5,000.00 pesos vía transferencia bancaria (se regresa de 5 a 3 días antes de finalizar el mes).')
  assert.equal(RESPUESTAS_RAPIDAS.flatMap(g=>g.items).find(i=>i.label==='Depósito en garantía (por mes)').texto,'Más depósito en garantía de $5,000.00 pesos vía transferencia bancaria (se regresa de 5 a 3 días antes de finalizar el mes, una vez que haya concluido la reserva y todo se encuentre en buen estado, como lo recibió el huésped)')
})

test('personas sobre capacidad: informar adicional sin inventar disponibilidad ni precio para un loft excedido', async () => {
  const s=caso('personas',{ consultar:async () => { throw Error('No ofrecer automáticamente una capacidad fuera del catálogo') } })
  await s.enviar('3 personas')
  assert.ok(s.respuestas()[0].body.includes(TEXTOS.persona_adicional))
  assert.match(s.respuestas()[0].body,/asesor.*confirmar la capacidad/)
  assert.doesNotMatch(s.respuestas()[0].body,/Sí tenemos|Total estimado/)
  assert.equal(s.db.whatsapp_conversaciones[0].fase,'esperando_asesor')
})

test('dudas sobre datos de 3 meses no se toman como duración de la reserva ni disparan cotización', async () => {
  const s=caso('personas')
  await s.enviar('¿Qué parte de los estados de cuenta de los últimos 3 meses necesitan?')
  assert.ok(s.respuestas()[0].body.includes(TEXTOS.comprobante_ingresos))
  assert.equal(s.db.leads[0].tipo_renta,'noche')
  assert.equal(s.db.leads[0].num_personas,1)
  assert.equal(s.db.whatsapp_conversaciones[0].fase,'personas')
})


test('las conversaciones antiguas en tipo_loft también reciben depósito por reservación y horarios', async () => {
  const s=caso('tipo_loft')
  await s.enviar('1')
  assert.equal(s.db.whatsapp_conversaciones[0].fase,'confirmado')
  for (const key of ['deposito_noche','entrada_salida','impuestos']) assert.ok(s.respuestas()[0].body.includes(TEXTOS[key]))
})
