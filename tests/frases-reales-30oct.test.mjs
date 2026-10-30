import { test } from 'node:test'
import assert from 'node:assert/strict'
import { escenario } from './webhook-fixture.mjs'

// Frases reales de las conversaciones del 26-30 oct-2026 (revisión con Harold).
function caso(fase) {
  const s = escenario(fase, '+525500000001', { hoy: '2026-10-29', consultar: async () => ({ disponibles: [{ tipo: 'mediano', nombre: 'PB-02' }], ocupados: [] }) })
  return { ...s, lead: s.db.leads[0], conv: s.db.whatsapp_conversaciones[0] }
}
async function responder(fase, texto) {
  const s = caso(fase)
  await s.enviar(texto)
  return { s, r: s.respuestas().map(m => m.body || '').join('\n') }
}

test('posponer: no insiste, no descarta y no lee "mañana" como fecha', async () => {
  for (const texto of ['Muchas gracias. Yo los contacto.', 'Lo reviso con calma y me comunico de nuevo', 'GRACIAS POR SU ATENCIÓN',
    'Le agradezco, reviso mi presupuesto y más adelante me comunico con ustedes', 'Pero mañana les respondo',
    'Si me interesa, pero no este momento. Gracias']) {
    const { s, r } = await responder('confirmar_precios', texto)
    assert.match(r, /Tómate tu tiempo/, texto)
    assert.doesNotMatch(r, /Responde \*sí\*|Llegada:/, texto)
    assert.equal(s.conv.fase, 'confirmar_precios', texto)
    assert.notEqual(s.lead.stage, 'no_interesado', texto)
  }
})

test('desinterés explícito sigue cerrando', async () => {
  const { s } = await responder('confirmar_precios', 'Ya no me interesa, gracias')
  assert.equal(s.lead.stage, 'no_interesado')
})

test('renta por año: aclara que no hay renta tradicional', async () => {
  const { r } = await responder('confirmar_precios', 'Y bueno busco algo más permanente, rentas por año y a largo plazo')
  assert.match(r, /no tenemos contratos de renta tradicional/)
})

test('nombre con teléfono pegado y quien no quiere hablar con IA', async () => {
  const a = await responder('nombre', 'Arturo Garcia  5551000099')
  assert.equal(a.s.lead.nombre, 'Arturo Garcia')
  const b = await responder('nombre', 'Olvídalo no hablo con IA gracias')
  assert.equal(b.s.conv.fase, 'esperando_asesor')
  assert.doesNotMatch(b.r, /no me parece un nombre/)
})

test('mes sin día: pregunta el día', async () => {
  const { r } = await responder('checkin', 'Pues queria ahorita en noviembre')
  assert.match(r, /Qué día de noviembre/)
})
