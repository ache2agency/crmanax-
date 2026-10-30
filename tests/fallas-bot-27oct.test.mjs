import { test } from 'node:test'
import assert from 'node:assert/strict'
import { escenario } from './webhook-fixture.mjs'
import { decidirFechas, extraerPersonas, extraerNombre } from '../lib/whatsapp/bot-parsers.ts'
import { resolverDisponibilidadFase2 } from '../lib/whatsapp/fase2-disponibilidad.ts'

function caso(fase, telefono) {
  const consultas = []
  const s = escenario(fase, telefono, { hoy: '2026-10-20', consultar: async args => {
    consultas.push(args)
    return { disponibles: [{ tipo: 'chico', nombre: 'PB-01' }, { tipo: 'mediano', nombre: 'PB-02' }], ocupados: [] }
  } })
  return { ...s, consultas, lead: s.db.leads[0], conv: s.db.whatsapp_conversaciones[0] }
}

test('1: +525536482880 — personas en texto, sin contar la mascota', async () => {
  for (const [text, n] of [['1 persona', 1], ['Una persona', 1], ['una', 1], ['dos personas', 2], ['somos 2', 2], ['1 y 1 mascota', 1], ['Ok 2', 2]]) {
    assert.equal(extraerPersonas(text, true), n)
    const s = caso('personas', '+525536482880')
    Object.assign(s.lead, { fecha_checkin: '2026-10-23', fecha_checkout: '2026-10-26' })
    await s.enviar(text)
    assert.equal(s.lead.num_personas, n, text)
    assert.equal(s.consultas[0].personas, n)
    assert.doesNotMatch(s.respuestas()[0].body, /escribe el número/)
  }
  for (const text of ['23/10/2026', '2 noches', '1 mascota', '0', '31', '2abc']) assert.equal(extraerPersonas(text, true), null, text)
})

test('1: fechas y personas juntas no vuelven a pedir personas', async () => {
  for (const [text, n] of [
    ['Llegada 23/10/2026 Fecha de salida 23/11/2026 2 personas', 2],
    ['llegada 24/10/2026 salida 31/10/2026, 1 persona', 1],
  ]) {
    const s = caso('checkin')
    await s.enviar(text)
    assert.equal(s.lead.num_personas, n)
    assert.equal(s.consultas.length, 1)
    assert.doesNotMatch(s.respuestas()[0].body, /Cuántas personas/)
    assert.equal(s.conv.fase, 'esperando_asesor')
  }
  const s = caso('checkin')
  await s.enviar('llegada 24/10/2026, una persona')
  assert.equal(s.conv.fase, 'checkout')
  await s.enviar('31/10/2026')
  assert.equal(s.consultas.length, 1)
  assert.equal(s.consultas[0].personas, 1)
})

test('2: fechas en palabras, abreviaturas y próximo año', async () => {
  for (const [text, checkin, checkout] of [
    ['Llegada 26 de oct salida 31 de oct', '2026-10-26', '2026-10-31'],
    ['del 3 al 7 de noviembre', '2026-11-03', '2026-11-07'],
    ['a partir del 16 noviembre', '2026-11-16', undefined],
  ]) {
    const s = caso('checkin')
    await s.enviar(text)
    assert.equal(s.lead.fecha_checkin, checkin)
    assert.equal(s.lead.fecha_checkout, checkout)
  }
  assert.equal(decidirFechas('checkin', 'a partir del 16 noviembre', '2026-12-01').checkin, '2027-11-16')
})

test('2: año inválido pide confirmación sin guardar la salida como llegada', async () => {
  for (const fase of ['nombre', 'checkin', 'checkout']) {
    const s = caso(fase)
    await s.enviar('llegada 27/10/20206 salida 03/11/2026')
    assert.match(s.respuestas()[0].body, /confirmas.*27\/10\/20206/)
    assert.equal(s.lead.fecha_checkin, undefined)
    assert.equal(s.lead.fecha_checkout, undefined)
    assert.equal(s.consultas.length, 0)
  }
})

test('3: preguntas reales contestadas antes de disponibilidad genérica o tarifas', async () => {
  for (const [telefono, texto, patron, tipo] of [
    ['+525568714777', 'Y cuáles son los requisitos', /anaxagoras41suite@gmail.com[\s\S]*visto bueno[\s\S]*#blog/],
    ['+525569365879', 'Cuál es el proceso para reservar estancias cortas', /fechas definidas[\s\S]*INE[\s\S]*no se toma a cuenta/],
    ['+525546018614', 'Tienes fotos de los 3 tipos de lofts', /loftChico.php[\s\S]*loftMediano.php[\s\S]*loftGrande.php/],
    ['+529611132362', 'Los costos ya incluyen impuestos?', /no incluyen impuestos[\s\S]*más IVA/],
    [undefined, 'Cuánto es el depósito?', /asesor te confirma el monto[\s\S]*loft y las fechas/],
    [undefined, 'Cuáles son los requisitos', /INE[\s\S]*no se toma a cuenta/, 'noche'],
  ]) {
    for (const fase of ['nombre', 'confirmar_precios', 'checkin', 'personas']) {
      const s = caso(fase, telefono)
      if (tipo) s.lead.tipo_renta = tipo
      await s.enviar(texto)
      assert.match(s.respuestas()[0].body, patron, `${fase}: ${texto}`)
      assert.equal(s.conv.fase, fase)
      assert.equal(s.consultas.length, 0)
    }
  }
})

test('4: +525659243709 — Disculpe y cortesías nunca son nombres', async () => {
  for (const text of ['Disculpe', 'perdón', 'gracias', 'por mes', 'costo', 'el precio']) {
    assert.equal(extraerNombre(text), null, text)
    const s = caso('nombre', '+525659243709')
    s.lead.nombre = null
    await s.enviar(text)
    assert.equal(s.lead.nombre, null, text)
    assert.doesNotMatch(s.respuestas()[0]?.body || '', /Mucho gusto/)
  }
  assert.equal(extraerNombre('María de la Luz'), 'María de la Luz')
  for (const fase of ['saludo', 'nombre']) {
    const s = caso(fase)
    await s.enviar('Fernando Macías costo')
    assert.equal(s.lead.nombre, 'Fernando Macías')
    assert.match(s.respuestas()[0].body, /Fernando Macías[\s\S]*\$12,000/)
    assert.equal(s.conv.fase, 'confirmar_precios')
  }
})

test('5: +525538863786 — sábado/viernes una noche no consulta ni ofrece disponibilidad', async () => {
  for (const checkin of ['2026-10-23', '2026-10-24']) {
    const checkout = checkin === '2026-10-23' ? '2026-10-24' : '2026-10-25'
    const s = caso('checkin', '+525538863786')
    await s.enviar(`llegada ${checkin.slice(8)}/10/2026 salida ${checkout.slice(8)}/10/2026, 1 persona`)
    assert.match(s.respuestas()[0].body, /2 noches[\s\S]*domingo o lunes/)
    assert.equal(s.consultas.length, 0)
    assert.equal(s.conv.fase, 'checkout')
    await s.enviar('26/10/2026')
    assert.equal(s.consultas.length, 1)
    assert.equal(s.conv.fase, 'esperando_asesor')
  }
  for (const [checkin, checkout] of [['2026-10-22', '2026-10-23'], ['2026-10-23', '2026-10-25'], ['2026-10-24', '2026-10-26']]) {
    let consultas = 0
    await resolverDisponibilidadFase2({ nombre: 'Ana', whatsapp: 'simulado', checkin, checkout, personas: 1,
      consultar: async () => { consultas++; return { disponibles: [{ tipo: 'chico' }], ocupados: [] } } })
    assert.equal(consultas, 1)
  }
})

test('6: +525549475964 — fechas antes del nombre se procesan', async () => {
  const s = caso('nombre', '+525549475964')
  s.lead.nombre = null
  await s.enviar('llegada 24/10/2026 salida 31/10/2026')
  assert.equal(s.lead.fecha_checkin, '2026-10-24')
  assert.equal(s.lead.fecha_checkout, '2026-10-31')
  assert.equal(s.lead.nombre, null)
  assert.equal(s.conv.fase, 'personas')
  assert.doesNotMatch(s.respuestas()[0].body, /parece un nombre/)
})

test('disponibilidad genérica conserva su respuesta y no se confunde con IVA', async () => {
  const s = caso('confirmar_precios')
  await s.enviar('¿Qué lofts hay con disponibilidad?')
  assert.match(s.respuestas()[0].body, /fechas y número de personas/)
  assert.doesNotMatch(s.respuestas()[0].body, /IVA/)
})

test('alternativas de una noche omiten viernes y sábado', async () => {
  const consultas = []
  await resolverDisponibilidadFase2({ nombre: 'Ana', whatsapp: 'simulado', checkin: '2026-10-22', checkout: '2026-10-23', personas: 1,
    consultar: async args => { consultas.push(args.checkin); return { disponibles: args.checkin === '2026-10-25' ? [{ tipo: 'chico' }] : [], ocupados: [] } } })
  assert.deepEqual(consultas, ['2026-10-22', '2026-10-25'])
})
