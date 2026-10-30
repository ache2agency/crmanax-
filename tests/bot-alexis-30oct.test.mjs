import { test } from 'node:test'
import assert from 'node:assert/strict'
import { escenario } from './webhook-fixture.mjs'
import { mensajeSeguimiento, extraerNombre, extraerPersonas } from '../lib/whatsapp/bot-parsers.ts'
import { resolverDisponibilidadFase2 } from '../lib/whatsapp/fase2-disponibilidad.ts'

const fechas = { fecha_checkin: '2026-10-31', fecha_checkout: '2026-11-13' }
const opciones = { hoy: '2026-10-30', consultar: async () => ({ disponibles: [{ tipo: 'chico', nombre: 'PB-01' }], ocupados: [] }) }
function caso(fase, opts = {}) { return escenario(fase, '+525500000002', { ...opciones, ...opts }) }

test('seguimiento por fase respeta fechas, personas, cotización y cierres', () => {
  assert.match(mensajeSeguimiento('checkin'), /Desde qué fecha/)
  assert.match(mensajeSeguimiento('checkout', { fecha_checkin: fechas.fecha_checkin }), /Ya tengo tu llegada.*Hasta qué fecha/)
  assert.match(mensajeSeguimiento('personas', fechas), /cuántas personas.*31\/10\/2026.*13\/11\/2026/)
  assert.match(mensajeSeguimiento('confirmar_interes', { ...fechas, num_personas: 1, stage: 'cotizado', loft_asignado: 'PB-01' }), /apartar el loft PB-01/)
  for (const fase of ['esperando_asesor', 'no_interesado', 'confirmado']) assert.equal(mensajeSeguimiento(fase), null)
  for (const text of ['yo me comunico', 'Muchas gracias. Yo los contacto.', 'ya no lo necesito']) assert.equal(mensajeSeguimiento('personas', fechas, text), null)
  assert.equal(mensajeSeguimiento('personas', { stage: 'reservado' }), null)
})

test('cotizaciones por noche y mes incluyen proceso y depósito correcto', async () => {
  for (const [checkout, patron] of [['2026-11-13', /asesor te indica el monto[\s\S]*INE[\s\S]*no se toma a cuenta/], ['2026-11-30', /\$5,000\.00[\s\S]*transferencia[\s\S]*5 a 3 días/]]) {
    const r = await resolverDisponibilidadFase2({ nombre: 'Ana', whatsapp: 'simulado', checkin: '2026-10-31', checkout, personas: 1, consultar: opciones.consultar })
    assert.match(r.response, patron)
  }
})

test('texto libre de confirmar_precios siempre responde; medio mes se cobra por noche', async () => {
  for (const text of ['En respecto al lote chico', 'Piedo pagar medio mes', '15 días primero', 'Del 31 de octubre al 13 de noviembre', 'Con el supuesto de que se rente después de esos días x otros 15', 'busco algo más permanente, rentas por año y a largo plazo']) {
    const s = caso('confirmar_precios')
    await s.enviar(text)
    assert.ok(s.respuestas()[0]?.body, text)
    if (text.includes('medio mes') || text.includes('15 días')) assert.match(s.respuestas()[0].body, /15 noches/)
    if (text.startsWith('Del')) { assert.equal(s.db.leads[0].fecha_checkout, '2026-11-13'); assert.equal(s.db.whatsapp_conversaciones[0].fase, 'personas') }
    if (text.includes('por año')) assert.match(s.respuestas()[0].body, /no tenemos contratos de renta tradicional/)
  }
})

test('FAQ en espera encendida por defecto; apagable y solo factual sin recotizar ni cambiar fase', async () => {
  for (const text of ['Renta mensual desde 24/10/2026', 'Me podrías decir la ubicación y una cita para ir a verlo', 'Cuales son los requisitos?', 'Cuanto cuestan', 'Algo que no ví es el baño, porqué no se muestra en las fotos?']) {
    const off = caso('esperando_asesor', { faqEspera: 'off' }); await off.enviar(text); assert.equal(off.respuestas().length, 0)
    const on = caso('esperando_asesor'); await on.enviar(text)
    assert.equal(on.db.whatsapp_conversaciones[0].fase, 'esperando_asesor')
    assert.equal(on.db.leads[0].fecha_checkin, undefined)
    if (!text.startsWith('Renta mensual')) assert.match(on.respuestas()[0].body, /Tu asesor te confirma disponibilidad en breve/)
    else assert.equal(on.respuestas().length, 0)
  }
})

test('FAQ respeta modo humano, asesor en 12h y preguntas fuera de lista', async () => {
  for (const bloqueo of ['humano', 'agente', 'no_factual']) {
    const s = caso('esperando_asesor', { faqEspera: '1' })
    if (bloqueo === 'humano') s.db.whatsapp_conversaciones[0].modo_humano = true
    if (bloqueo === 'agente') s.db.whatsapp_mensajes.push({ id: 'agente', conversacion_id: 'conv', rol: 'agente', created_at: '2026-10-30T11:00:00Z' })
    await s.enviar(bloqueo === 'no_factual' ? '¿Puedo negociar el contrato?' : 'Cuáles son los requisitos?')
    assert.equal(s.respuestas().length, 0)
  }
  const s = caso('esperando_asesor', { faqEspera: 'on' })
  s.db.whatsapp_mensajes.push({ id: 'agente', conversacion_id: 'conv', rol: 'agente', created_at: '2026-10-29T23:00:00Z' })
  await s.enviar('Cuáles son los requisitos?'); assert.equal(s.respuestas().length, 1)
})

test('nombre largo, personas y enlace roto', async () => {
  const nombre = 'Mariana Elena Perez Montes de Oca'
  assert.equal(extraerNombre(nombre), nombre)
  const s = caso('nombre'); await s.enviar(nombre); assert.equal(s.db.leads[0].nombre, nombre)
  for (const text of ['Correcto. 1 persona', 'Una persona']) {
    assert.equal(extraerPersonas(text, true), 1)
    const p = caso('personas'); Object.assign(p.db.leads[0], fechas); await p.enviar(text)
    assert.match(p.respuestas()[0].body, /Total estimado/)
  }
  const p = caso('confirmar_precios'); await p.enviar('No me deja abrir el link')
  assert.match(p.respuestas()[0].body, /asesor.*fotos directamente/)
  assert.doesNotMatch(p.respuestas()[0].body, /https:/)
  const f = caso('confirmar_precios'); await f.enviar('Quiero ver las fotos'); assert.match(f.respuestas()[0].body, /loftChico.php/)
})

test('dos fragmentos del nombre en la ventana de cinco segundos producen una bienvenida', async () => {
  const pendientes = []
  const s = caso('nombre', { setTimeout(fn, ms) { assert.equal(ms, 5000); pendientes.push(fn) } })
  const primero = s.enviar('Gabriela Perez del')
  while (pendientes.length < 1) await new Promise(setImmediate)
  const segundo = s.enviar('Rio')
  while (pendientes.length < 2) await new Promise(setImmediate)
  pendientes[0](); await primero
  pendientes[1](); await segundo
  assert.equal(s.db.leads[0].nombre, 'Gabriela Perez del Rio')
  assert.equal(s.respuestas().length, 1)
  assert.equal(s.db.whatsapp_mensajes.filter(m => m.rol === 'usuario').length, 2)
})

test('flujo completo de medio mes + fechas + personas termina cotizando por noche', async () => {
  const s = caso('confirmar_precios')
  await s.enviar('Piedo pagar medio mes')
  await s.enviar('Del 31 de octubre al 13 de noviembre')
  await s.enviar('Correcto. 1 persona')
  assert.equal(s.db.leads[0].tipo_renta, 'noche')
  assert.match(s.respuestas().at(-1).body, /Total estimado[\s\S]*INE[\s\S]*no se toma a cuenta/)
})

test('flag FAQ acepta 0/off/false para apagar y conserva on/1/true', async () => {
  for (const valor of ['0', 'off', 'false', ' OFF ', '1', 'on', 'true', undefined]) {
    const s = caso('esperando_asesor', { faqEspera: valor })
    await s.enviar('Cuál es la ubicación?')
    assert.equal(s.respuestas().length, ['0', 'off', 'false', ' OFF '].includes(valor) ? 0 : 1)
  }
})
