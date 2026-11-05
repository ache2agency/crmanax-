import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extraerNombre, extraerFechas, esRentaMensual } from '../lib/whatsapp/bot-parsers.ts'
import { escenario } from './webhook-fixture.mjs'

const telefono = '+525500000004'
const fechas = 'Llego el 8 de noviembre y salgo el 9 de noviembre'
function caso(fase = 'nombre', opciones = {}) {
  const consultas = []
  const s = escenario(fase, telefono, { hoy: '2026-11-02', consultar: async p => {
    consultas.push(p)
    return { disponibles: [{ id: 'mediano', nombre: 'PB-03', tipo: 'mediano' }], ocupados: [], ...opciones.disponibilidad }
  } })
  s.db.leads[0].nombre = null
  return { ...s, consultas, lead: s.db.leads[0], conv: s.db.whatsapp_conversaciones[0] }
}

test('4-nov: Si claro carlos soles. se captura como Carlos Soles en el POST real', async () => {
  const s = caso()
  await s.enviar('Si claro carlos soles.')
  assert.equal(s.lead.nombre, 'Carlos Soles')
  assert.equal(s.conv.fase, 'confirmar_precios')
  assert.match(s.respuestas()[0].body, /Mucho gusto, \*Carlos Soles\*/)
  assert.doesNotMatch(s.respuestas()[0].body, /no me parece un nombre/)
})

test('4-nov: presentaciones y muletillas combinadas conservan solo el nombre', () => {
  for (const texto of ['Si claro carlos soles.', 'Sí, claro, soy carlos soles.', 'claro, me llamo carlos soles', 'mi nombre es carlos soles', 'Hola, sí claro, mi nombre es carlos soles.']) {
    assert.equal(extraerNombre(texto), 'Carlos Soles', texto)
  }
  for (const texto of ['Claro', 'Si claro', 'Me urgue los costos$$??', 'Me urge los costos', 'Me urge', 'Soy una persona interesada']) assert.equal(extraerNombre(texto), null, texto)
  assert.equal(extraerNombre('María de la Luz'), 'María de la Luz')
})

test('4-nov: Me urgue los costos$$?? no se guarda como nombre ni como saludo', async () => {
  const s = caso()
  await s.enviar('Me urgue los costos$$??')
  assert.equal(s.lead.nombre, null)
  assert.equal(s.conv.fase, 'nombre')
  assert.match(s.respuestas()[0].body, /nombre/)
  assert.doesNotMatch(s.respuestas()[0].body, /Mucho gusto|\*Me urgue los\*/)
})

for (const texto of ['Menor a un mes', 'solo noches', 'menos de un mes']) {
  test(`4-nov: ${texto} no inventa un mes y se procesa como noche`, async () => {
    assert.equal(extraerFechas(texto, '2026-11-02').duracion, null)
    assert.equal(esRentaMensual(texto), false)
    for (const fase of ['confirmar_precios', 'tipo_renta', 'checkin', 'checkout']) {
      const s = caso(fase)
      s.lead.tipo_renta = 'mes'
      await s.enviar(texto)
      assert.equal(s.lead.tipo_renta, 'noche', fase)
      assert.doesNotMatch(s.respuestas()[0]?.body || '', /1 mes|renta \*por mes\*|Salida estimada para renta mensual/i, fase)
      assert.match(s.respuestas()[0]?.body || '', /fecha.*llegada|llegada.*fecha/i, fase)
      assert.equal(s.consultas.length, 0)
      assert.equal(s.lead.fecha_checkout, undefined)
    }
  })
}

test('4-nov: menor a un mes conserva fechas y duraciones concretas por noche', () => {
  assert.deepEqual(extraerFechas('Menor a un mes, 3 noches desde el 8 de noviembre', '2026-11-02'), { fechas: ['2026-11-08'], duracion: { dias: 3, meses: 0, texto: '3 noches' } })
  assert.equal(extraerFechas('un mes', '2026-11-02').duracion.meses, 1)
})

test('4-nov: fechas completas en esperando_asesor cotizan disponibilidad y avisan al asesor', async () => {
  for (const previo of ['Un asesor te contacta.', '¡Perfecto! Ya tengo tus datos. Un asesor verificará la disponibilidad.']) {
    const s = caso('esperando_asesor')
    Object.assign(s.lead, { nombre: 'Carlos Soles', num_personas: 2 })
    s.db.whatsapp_mensajes.push({ conversacion_id: 'conv', rol: 'bot', contenido: previo, created_at: '2026-11-02T11:00:00Z' })
    await s.enviar(fechas)
    assert.deepEqual(s.consultas, [{ checkin: '2026-11-08', checkout: '2026-11-09', personas: 2 }])
    assert.equal(s.conv.fase, 'esperando_asesor')
    assert.equal(s.conv.seguimiento_enviado, true)
    assert.equal(s.lead.tipo_renta, 'noche')
    assert.match(s.respuestas()[0].body, /Total estimado.*\$800 MXN/s)
    assert.match(s.respuestas()[0].body, /asesor te confirma/)
    assert.ok(s.enviados.some(m => m.to !== telefono && /08\/11\/2026|09\/11\/2026/.test(m.body)), 'Aviso al asesor con fechas actualizadas')
  }
})

test('4-nov: en espera, sin huéspedes pide el dato y cotiza al recibirlo', async () => {
  const s = caso('esperando_asesor')
  await s.enviar(fechas)
  assert.equal(s.conv.fase, 'personas')
  assert.equal(s.consultas.length, 0)
  assert.match(s.respuestas()[0].body, /personas/)
  await s.enviar('2 personas')
  assert.equal(s.consultas.length, 1)
  assert.match(s.respuestas().at(-1).body, /Total estimado/)
  assert.equal(s.conv.fase, 'esperando_asesor')
})

test('4-nov: en espera, datos viejos o sin disponibilidad conservan la confirmación con asesor', async () => {
  for (const disponibilidad of [{ datosViejos: true }, { disponibles: [], ocupados: [] }]) {
    const s = caso('esperando_asesor', { disponibilidad })
    s.lead.num_personas = 2
    await s.enviar(fechas)
    assert.ok(s.consultas.length > 0)
    assert.equal(s.conv.fase, 'esperando_asesor')
    assert.equal(s.lead.stage, 'cotizado')
    assert.doesNotMatch(s.respuestas()[0].body, /Sí tenemos disponibilidad/)
    assert.match(s.respuestas()[0].body, /asesor.*confirma/i)
    assert.ok(s.enviados.some(m => m.to !== telefono && /disponibilidad estimada/.test(m.body)))
  }
})

test('4-nov: en espera, rango inválido, fecha pasada o fecha suelta no recotizan', async () => {
  for (const texto of ['Llegada 31/02/2027, salida 03/03/2027', 'Llegada 01/11/2026, salida 02/11/2026', 'Llegada 08/11/2026, salida 07/11/2026', 'Llegada 08/11/2026']) {
    const s = caso('esperando_asesor')
    Object.assign(s.lead, { num_personas: 2, fecha_checkin: '2026-12-01', fecha_checkout: '2026-12-03' })
    await s.enviar(texto)
    assert.equal(s.consultas.length, 0, texto)
    assert.equal(s.lead.fecha_checkin, '2026-12-01', texto)
    assert.equal(s.lead.fecha_checkout, '2026-12-03', texto)
    assert.equal(s.conv.fase, 'esperando_asesor')
  }
})

test('4-nov: aclarar menor a un mes descarta una duración mensual pendiente errónea', async () => {
  const s = caso('checkin')
  s.db.whatsapp_mensajes.push({ conversacion_id: 'conv', rol: 'bot', contenido: 'Perfecto, una estancia de *1 mes*', created_at: '2026-11-02T11:00:00Z' })
  await s.enviar('Menor a un mes, llego el 8 de noviembre')
  assert.equal(s.lead.tipo_renta, 'noche')
  assert.equal(s.lead.fecha_checkin, '2026-11-08')
  assert.equal(s.lead.fecha_checkout, undefined)
  assert.equal(s.conv.fase, 'checkout')
  assert.equal(s.consultas.length, 0)
})

test('4-nov: fechas en espera respetan modo humano, reserva y cotización aceptada', async () => {
  for (const stage of ['deposito_pendiente', 'reservado', 'hospedado', 'completado']) {
    const s = caso('esperando_asesor')
    Object.assign(s.lead, { stage, num_personas: 2, fecha_checkin: '2026-12-01', fecha_checkout: '2026-12-03' })
    const antes = structuredClone(s.lead)
    await s.enviar(fechas)
    assert.deepEqual(s.lead, antes)
    assert.equal(s.consultas.length, 0)
    assert.equal(s.respuestas().length, 0)
  }
  for (const opciones of [{ humano: true }, { aceptada: true }]) {
    const s = caso('esperando_asesor')
    s.lead.num_personas = 2
    if (opciones.humano) s.conv.modo_humano = true
    if (opciones.aceptada) s.db.whatsapp_mensajes.push({ conversacion_id: 'conv', rol: 'bot', contenido: 'Cotización aceptada; ya tengo tus datos.', created_at: '2026-11-02T11:00:00Z' })
    await s.enviar(fechas)
    assert.equal(s.consultas.length, 0)
    assert.equal(s.respuestas().length, 0)
  }
})

test('4-nov: recorrido del caso nombre → menor a un mes → espera → fechas', async () => {
  const s = caso()
  await s.enviar('Me urgue los costos$$??')
  await s.enviar('Si claro carlos soles.')
  await s.enviar('Menor a un mes')
  assert.equal(s.lead.nombre, 'Carlos Soles')
  assert.equal(s.lead.tipo_renta, 'noche')
  // Reproduce el punto en que el caso real ya había sido derivado al asesor.
  s.conv.fase = 'esperando_asesor'
  await s.enviar('Llego el 8 de noviembre y salgo el 9 de noviembre, somos 2 personas')
  assert.equal(s.consultas.length, 1)
  assert.match(s.respuestas().at(-1).body, /\$800 MXN \(1 noche/)
  assert.equal(s.conv.fase, 'esperando_asesor')
})
