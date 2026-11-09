import { test } from 'node:test'
import assert from 'node:assert/strict'
import { escenario } from './webhook-fixture.mjs'

const admin = '+525500000036'
const inicio = Date.parse('2026-11-08T12:00:00Z')
const minuto = 60_000
function modoPrueba() {
  let ahora = inicio
  const s = escenario('confirmado', admin, { admin, ahora: () => ahora })
  s.db.leads[0].stage = 'deposito_pendiente'
  return { ...s, avanzar: minutos => { ahora += minutos * minuto } }
}

test('36: test activa 30 minutos de inactividad y cada mensaje vigente renueva la sesión', async () => {
  const s = modoPrueba()
  await s.enviar('test')
  assert.equal(s.db.admin_test_mode[0].activated_at, new Date(inicio).toISOString())
  assert.match(s.respuestas()[0].body, /30 min sin mensajes/)
  s.avanzar(29)
  await s.enviar('Necesito apoyo para la llegada')
  assert.equal(s.db.admin_test_mode[0].activated_at, new Date(inicio + 29 * minuto).toISOString())
  s.avanzar(29)
  await s.enviar('¿Me pueden atender?')
  assert.equal(s.db.admin_test_mode[0].activated_at, new Date(inicio + 58 * minuto).toISOString())
  assert.equal(s.db.whatsapp_mensajes.filter(m => m.rol === 'usuario').length, 2)
  assert.equal(s.pushes.length, 2)
})

for (const minutos of [30, 31]) {
  test(`36: tras ${minutos} minutos inactivo no revive ni procesa al admin como cliente`, async () => {
    const s = modoPrueba()
    await s.enviar('test')
    s.avanzar(minutos)
    await s.enviar('Necesito apoyo para la llegada')
    assert.equal(s.db.admin_test_mode[0].activated_at, new Date(inicio).toISOString())
    assert.equal(s.db.whatsapp_mensajes.length, 0)
    assert.equal(s.pushes.length, 0)
    assert.equal(s.respuestas().length, 1)
  })
}

test('36: salir desactiva y otro mensaje no recrea la sesión; test permite volver a activarla', async () => {
  const s = modoPrueba()
  await s.enviar('test')
  s.avanzar(5)
  await s.enviar('salir')
  await s.enviar('¿Me pueden atender?')
  assert.equal(s.db.admin_test_mode.length, 0)
  assert.equal(s.db.whatsapp_mensajes.length, 0)
  assert.equal(s.respuestas().length, 2)
  await s.enviar('test')
  assert.equal(s.db.admin_test_mode[0].activated_at, new Date(inicio + 5 * minuto).toISOString())
})

test('36: un cliente normal no activa ni renueva modo prueba', async () => {
  const s = escenario('confirmado')
  s.db.leads[0].stage = 'deposito_pendiente'
  await s.enviar('test')
  assert.equal(s.db.admin_test_mode.length, 0)
  assert.equal(s.db.whatsapp_mensajes.filter(m => m.rol === 'usuario').length, 1)
})

test('36: confirmado recibe un solo acuse; cada mensaje posterior se registra y avisa por push', async () => {
  const telefono = '+525500000037'
  const s = escenario('confirmado', telefono)
  s.db.leads[0].stage = 'deposito_pendiente'
  const mensajes = ['¿Me pueden atender?', 'Necesito apoyo para la llegada', '¿A quién le envío mi identificación?']
  for (const mensaje of mensajes) await s.enviar(mensaje)
  assert.equal(s.respuestas().length, 1)
  assert.match(s.respuestas()[0].body, /Un asesor/)
  assert.deepEqual(s.db.whatsapp_mensajes.filter(m => m.rol === 'usuario').map(m => m.contenido), mensajes)
  assert.equal(s.db.whatsapp_mensajes.filter(m => m.rol === 'bot').length, 1)
  assert.deepEqual(s.pushes.map(p => p.body), mensajes)
  assert.ok(s.pushes.every(p => p.title.includes('Cliente confirmado') && p.title.includes(telefono)))
  assert.equal(s.enviados.length, 1, 'No envía WhatsApp adicional a admins')
  assert.equal(s.db.whatsapp_conversaciones[0].fase, 'confirmado')
  assert.equal(s.db.leads[0].stage, 'deposito_pendiente')
})

test('36: una falla de push conserva el registro y la supresión del acuse repetido', async () => {
  const s = escenario('confirmado', '+525500000038', { pushError: true })
  s.db.leads[0].stage = 'deposito_pendiente'
  await s.enviar('¿Me pueden atender?')
  await s.enviar('Necesito apoyo para la llegada')
  assert.equal(s.respuestas().length, 1)
  assert.equal(s.db.whatsapp_mensajes.filter(m => m.rol === 'usuario').length, 2)
  assert.equal(s.db.whatsapp_conversaciones[0].fase, 'confirmado')
})

test('36: confirmado en modo humano solo registra y avisa, sin responder ni mover etapa', async () => {
  const s = escenario('confirmado')
  s.db.whatsapp_conversaciones[0].modo_humano = true
  const stage = s.db.leads[0].stage
  await s.enviar('Necesito apoyo para la llegada')
  assert.equal(s.respuestas().length, 0)
  assert.equal(s.pushes.length, 1)
  assert.equal(s.db.whatsapp_mensajes.filter(m => m.rol === 'usuario').length, 1)
  assert.equal(s.db.leads[0].stage, stage)
})
