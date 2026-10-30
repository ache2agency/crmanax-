import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as parsers from '../lib/whatsapp/bot-parsers.ts'

import { escenario } from './webhook-fixture.mjs'

test('1: +527331158172 — despedidas y precio cierran una sola vez', async () => {
  for (const text of ['Muchas gracias', 'le estaría avisando', 'sale de mi presupuesto', 'de momento es suficiente']) {
    const s = escenario('confirmar_precios', '+527331158172')
    s.db.whatsapp_mensajes.push({ conversacion_id: 'conv', rol: 'bot', contenido: '¿Te interesa alguna de estas opciones?', created_at: '2026-10-01' })
    await s.enviar(text)
    assert.equal(s.db.leads[0].stage, 'no_interesado', text)
    assert.equal(s.db.whatsapp_conversaciones[0].estado, 'cerrada')
    assert.equal(s.respuestas().length, 1)
    await s.enviar('Muchas gracias')
    assert.equal(s.respuestas().length, 1, 'No repetir cierre ni reabrir al despedirse otra vez')
    assert.equal(s.db.whatsapp_conversaciones[0].estado, 'cerrada')
    if (text.includes('presupuesto')) assert.equal(s.db.lead_activities[0].meta.motivo, 'precio')
  }
})

test('2: +523112694172 y +525534917311 — mensual, fecha desconocida y preferencia', async () => {
  const s = escenario()
  await s.enviar('Mensualmente')
  assert.equal(s.db.leads[0].tipo_renta, 'mes')
  assert.match(s.respuestas()[0].body, /fecha aproximada/)
  await s.enviar('renta mensual, no sé la fecha')
  assert.equal(s.db.whatsapp_conversaciones[0].fase, 'esperando_asesor')
  assert.match(s.respuestas()[1].body, /asesor/)
  const loft = escenario('checkin', '+525534917311')
  await loft.enviar('Me interesa un loft chico')
  assert.match(loft.db.leads[0].notas, /Nota del asesor\nPreferencia de loft: chico/)
  assert.match(loft.respuestas()[0].body, /fecha aproximada/)
  // No repetir literalmente la pregunta al contestar con otra preferencia.
  await loft.enviar('Me interesa un loft chico')
  assert.equal(loft.respuestas().length, 1)
})

test('3: mascotas y estacionamiento cierran sin alertar ni reabrir', async () => {
  for (const [text, motivo, telefono] of [
    ['No me sirve, busco pet friendly', 'mascotas', '+525535574572'],
    ['No me interesa / necesito estacionamiento', 'estacionamiento', '+525627917037'],
  ]) {
    for (const estado of ['abierta', 'cerrada']) {
      const s = escenario('nombre', telefono)
      s.db.whatsapp_conversaciones[0].estado = estado
      s.db.whatsapp_conversaciones[0].humano_intervino = true
      await s.enviar(text)
      assert.equal(s.db.leads[0].stage, 'no_interesado')
      assert.equal(s.db.whatsapp_conversaciones[0].estado, 'cerrada')
      assert.equal(s.db.whatsapp_conversaciones[0].fase, 'no_interesado')
      assert.equal(s.db.lead_activities[0].meta.motivo, motivo)
      assert.equal(s.enviados.length, 1, 'Solo cierre al prospecto, sin alerta a asesor')
      assert.doesNotMatch(s.respuestas()[0].body, /Hola de nuevo|asesor|nombre/)
    }
  }
})

test('4: Todas y respuestas comunes nunca se guardan como nombre', async () => {
  for (const text of ['Todas', 'todos', 'sí', 'no', 'gracias', 'ok', 'info', 'precio']) {
    assert.equal(parsers.extraerNombre(text), null, text)
    const s = escenario('nombre')
    s.db.leads[0].nombre = null
    await s.enviar(text)
    assert.equal(s.db.leads[0].nombre, null, text)
  }
  assert.equal(parsers.extraerNombre('Soy Ana López'), 'Ana López')
})

test('preguntas y agradecimientos con solicitud no descartan al prospecto', () => {
  for (const text of ['Gracias, ¿cuánto cuesta?', '¿Aceptan mascotas?', 'Necesito estacionamiento', 'Me interesa un loft chico']) {
    assert.equal(parsers.esCierreConversacion(text), false, text)
  }
})


test('Gracias tras la cotización NO cierra ni cambia la fase', async () => {
  const s = escenario('confirmar_interes')
  s.db.whatsapp_mensajes.push({ conversacion_id: 'conv', rol: 'bot', contenido: 'Tu cotización estimada es $2,100. ¿Te interesa este rango?', created_at: '2026-10-01' })
  for (const texto of ['Gracias', 'Muchas gracias']) await s.enviar(texto)
  assert.equal(s.db.leads[0].stage, 'cotizado')
  assert.equal(s.db.whatsapp_conversaciones[0].fase, 'confirmar_interes')
  assert.equal(s.db.whatsapp_conversaciones[0].estado, 'abierta')
  assert.equal(s.db.lead_activities.length, 0)
  assert.equal(s.respuestas().length, 0)
})

test('Gracias tras reservar NO cierra; reservas, pagos y cotización aceptada se protegen aun ante rechazo', async () => {
  for (const estado of ['abierta', 'cerrada']) {
    for (const [fase, stage] of [
      ['confirmado', 'reservado'], ['esperando_asesor', 'deposito_pendiente'],
      ['esperando_asesor', 'hospedado'], ['cotizacion_aceptada', 'cotizado'],
      ['confirmado', 'cotizado'], ['esperando_asesor', 'cotizado'],
      ['confirmar_precios', 'reservado'], ['pago', 'cotizado'],
    ]) {
      for (const texto of ['Gracias', 'Muchas gracias', 'No me interesa', 'Sale de mi presupuesto', 'No']) {
        const s = escenario(fase)
        s.db.leads[0].stage = stage
        s.db.whatsapp_conversaciones[0].estado = estado
        s.db.whatsapp_conversaciones[0].humano_intervino = true
        const contenido = fase === 'esperando_asesor' && stage === 'cotizado' ? '¡Perfecto! Ya tengo tus datos. Un asesor verificará la disponibilidad.' : '¿Te interesa alguna de estas opciones?'
        s.db.whatsapp_mensajes.push({ conversacion_id: 'conv', rol: 'bot', contenido, created_at: '2026-10-01' })
        await s.enviar(texto)
        assert.equal(s.db.leads[0].stage, stage, `${fase}/${stage}: ${texto}`)
        assert.equal(s.db.whatsapp_conversaciones[0].fase, fase)
        assert.equal(s.db.whatsapp_conversaciones[0].estado, estado)
        assert.equal(s.db.lead_activities.length, 0)
        assert.equal(s.enviados.length, 0)
      }
    }
  }
})

test('Muchas gracias, de momento es suficiente SÍ cierra sin pregunta de interés previa', async () => {
  const s = escenario('confirmar_precios')
  await s.enviar('Muchas gracias, de momento es suficiente')
  assert.equal(s.db.leads[0].stage, 'no_interesado')
  assert.equal(s.db.whatsapp_conversaciones[0].estado, 'cerrada')
  assert.equal(s.respuestas().length, 1)
})


test('catálogo real + Gracias en confirmar_precios cierra', async () => {
  for (const texto of ['Gracias', 'Muchas gracias']) {
    const s = escenario('confirmar_precios')
    assert.match(s.catalogo, /¿Te interesa alguna opción\?/)
    s.db.whatsapp_mensajes.push({ conversacion_id: 'conv', rol: 'bot', contenido: s.catalogo, created_at: '2026-10-01' })
    await s.enviar(texto)
    assert.equal(s.db.leads[0].stage, 'no_interesado')
    assert.equal(s.db.whatsapp_conversaciones[0].fase, 'no_interesado')
    assert.equal(s.db.whatsapp_conversaciones[0].estado, 'cerrada')
    assert.equal(s.respuestas().length, 1)
  }
})

test('Gracias en checkin no cierra aunque el último mensaje sea el catálogo', async () => {
  for (const texto of ['Gracias', 'Muchas gracias']) {
    const s = escenario('checkin')
    s.db.whatsapp_mensajes.push({ conversacion_id: 'conv', rol: 'bot', contenido: s.catalogo, created_at: '2026-10-01' })
    await s.enviar(texto)
    assert.equal(s.db.leads[0].stage, 'cotizado')
    assert.equal(s.db.whatsapp_conversaciones[0].fase, 'checkin')
    assert.equal(s.db.whatsapp_conversaciones[0].estado, 'abierta')
    assert.equal(s.db.lead_activities.length, 0)
    assert.equal(s.respuestas().length, 0)
  }
})
