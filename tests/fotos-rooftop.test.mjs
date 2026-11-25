import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { FOTOS_ROOFTOP, GALERIA_ROOFTOP, TEXTOS } from '../lib/anaxagoras/textos.js'
import { escenario } from './webhook-fixture.mjs'

const INTRO = 'Así es el Roof Top 👇'
const contenido = s => s.respuestas().map(m => m.body ?? m.link)

test('la ficha enlaza la galería antes del teléfono de reservas', () => {
  assert.ok(TEXTOS.rooftop.includes(GALERIA_ROOFTOP + '\n\nPara reservar'))
})

test('el proveedor Meta usa el formato image, reintenta con +521 y conserva el error de la API', async () => {
  const source = ts.transpileModule(readFileSync(new URL('../lib/whatsapp/provider.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const requests = []
  const results = [
    Response.json({ error: { code: 133010 } }, { status: 400 }),
    Response.json({ messages: [{ id: 'wamid.imagen' }] }),
    Response.json({ error: { code: 100, message: 'Imagen inválida' } }, { status: 400 }),
  ]
  const exports = {}
  runInNewContext(source, {
    exports, process: { env: { META_WHATSAPP_TOKEN: 'simulado', META_PHONE_NUMBER_ID: 'simulado' } },
    fetch: async (_url, request) => {
      requests.push(JSON.parse(request.body))
      return results.shift()
    },
  })
  const to = '+525500000000'
  const link = FOTOS_ROOFTOP[0]
  const caption = 'Terraza'
  assert.equal((await exports.sendMetaWhatsAppImage({ to, link, caption })).id, 'wamid.imagen')
  assert.deepEqual(requests[0], {
    messaging_product: 'whatsapp', recipient_type: 'individual', to: '525500000000',
    type: 'image', image: { link, caption },
  })
  assert.deepEqual(requests[1], { ...requests[0], to: '5215500000000' })
  await assert.rejects(exports.sendMetaWhatsAppImage({ to, link }), /#100 Imagen inválida/)
  assert.deepEqual(requests[2].image, { link })
})

test('pide fotos del roof, la terraza, el evento o el espacio para fiestas', async () => {
  for (const pregunta of [
    '¿Tienes fotos del roof?',
    'Mándame fotos de la terraza para el evento',
    '¿Fotos de la terraza?',
    '¿Fotos del evento?',
    '¿Fotos del espacio para fiestas?',
    '¿Fotos del evento del 15/12/2026 para 20 personas?',
  ]) {
    const s = escenario()
    const lead = { ...s.db.leads[0] }
    await s.enviar(pregunta, { id: 'wamid.fotos' })
    assert.deepEqual(contenido(s), [INTRO, ...FOTOS_ROOFTOP], pregunta)
    assert.deepEqual(s.db.leads[0], lead)
    assert.equal(s.db.whatsapp_conversaciones[0].fase, 'checkin')
    assert.deepEqual(s.db.whatsapp_mensajes.filter(m => m.rol === 'bot').map(m => m.contenido), contenido(s))
    assert.equal(s.db.whatsapp_mensajes.filter(m => m.raw_payload.type === 'image').length, 3)
  }
})

test('usa la ficha previa para «¿fotos?» y envía un solo lote ante duplicados concurrentes o tardíos', async () => {
  const s = escenario()
  await s.enviar('¿Cuánto cuesta el Roof Top?')
  const mensaje = { id: 'wamid.fotos-contexto' }
  await Promise.all([s.enviar('¿Fotos?', mensaje), s.enviar('¿Fotos?', mensaje)])
  await s.enviar('¿Fotos?', mensaje)
  assert.deepEqual(contenido(s), [TEXTOS.rooftop, INTRO, ...FOTOS_ROOFTOP])
})

test('una solicitud directa de fotos funciona también al abrir el chat', async () => {
  const s = escenario()
  s.db.leads[0].whatsapp = s.db.whatsapp_conversaciones[0].whatsapp
  s.db.whatsapp_conversaciones.length = 0
  await s.enviar('¿Tienes fotos del roof?', { id: 'wamid.primer-mensaje' })
  assert.deepEqual(contenido(s), [INTRO, ...FOTOS_ROOFTOP])
  assert.equal(s.db.whatsapp_conversaciones[0].fase, 'nombre')
})

test('las fotos del loft mediano conservan los enlaces incluso después de la ficha del Roof Top', async () => {
  const s = escenario()
  await s.enviar('¿Cuánto cuesta el Roof Top?')
  await s.enviar('Fotos del loft mediano', { id: 'wamid.loft' })
  assert.equal(s.respuestas().length, 2)
  assert.match(s.respuestas()[1].body, /Fotos por tipo de loft:/)
  assert.match(s.respuestas()[1].body, /loftMediano\.php/)
})

test('si fallan dos imágenes, envía la que queda y el enlace de respaldo una sola vez', async () => {
  const errores = []
  const s = escenario('checkin', undefined, {
    fallaImagen: link => link !== FOTOS_ROOFTOP[1],
    logError: (...args) => errores.push(args),
  })
  const mensaje = { id: 'wamid.fotos-falla' }
  await s.enviar('¿Tienes fotos del roof?', mensaje)
  await s.enviar('¿Tienes fotos del roof?', mensaje)
  assert.deepEqual(contenido(s), [INTRO, FOTOS_ROOFTOP[1], GALERIA_ROOFTOP])
  assert.equal(errores.length, 2)
})

test('Twilio envía la introducción y la galería como texto', async () => {
  const s = escenario('checkin', undefined, { provider: 'twilio' })
  await s.enviar('¿Tienes fotos del roof?', { id: 'wamid.twilio' })
  assert.deepEqual(contenido(s), [INTRO, GALERIA_ROOFTOP])
  assert.ok(s.respuestas().every(m => m.provider === 'twilio'))
})

test('respeta control humano, el flag en espera y las 12 horas del agente', async () => {
  const pregunta = '¿Tienes fotos del roof?'
  const apagado = escenario('esperando_asesor', undefined, { faqEspera: 'off' })
  const humano = escenario('checkin')
  humano.db.whatsapp_conversaciones[0].modo_humano = true
  const espera = escenario('esperando_asesor')
  espera.db.whatsapp_mensajes.push({
    conversacion_id: 'conv', rol: 'agente', contenido: 'Hola',
    created_at: new Date(Date.now() - 11 * 3600000).toISOString(),
  })
  for (const s of [apagado, humano, espera]) {
    await s.enviar(pregunta, { id: 'wamid.silencio' })
    assert.deepEqual(contenido(s), [])
  }
  espera.db.whatsapp_mensajes[0].created_at = new Date(Date.now() - 13 * 3600000).toISOString()
  await espera.enviar(pregunta, { id: 'wamid.reanuda' })
  assert.deepEqual(contenido(espera), [INTRO, ...FOTOS_ROOFTOP])
  assert.equal(espera.db.whatsapp_conversaciones[0].fase, 'esperando_asesor')
})
