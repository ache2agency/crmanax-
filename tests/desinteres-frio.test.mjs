import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  esDesinteres,
  esRespuestaNegativa,
  debePasarAFrio,
  stageAlRegresarDeFrio,
} from '../lib/whatsapp/bot-parsers.ts'

test('desinterés: casos reales que el bot no detectaba (9-oct-2026)', () => {
  for (const t of [
    'se excede de mi presupuesto',
    'se sale de mi presupuesto, pero muchas graciass',
    'Sale de mi presupuesto',
    'Gracias está fuera de mi presupuesto',
    'Hola buen día no muchas gracias',
    'ya no escriban no contestan lo que pregunto',
    'No me sirve entonces',
    'No me interesa',
    'ya encontré otro lugar',
    'Está muy caro',
  ]) assert.equal(esDesinteres(t), true, t)
})

test('desinterés: NO confunde preguntas ni falta de fecha', () => {
  for (const t of [
    'No tengo fecha aún',
    'No tengo fecha de salida',
    'No me has dado precio',
    'No me han dicho los precios',
    '¿Está muy caro el mensual?',
    'Gracias',
    'No aceptan mascotas?',
    'Aún no me contactan',
    'Me interesa el loft mediano',
  ]) assert.equal(esDesinteres(t), false, t)
})

test('respuesta negativa: "No" suelto sí, "No tengo fecha" no', () => {
  assert.equal(esRespuestaNegativa('No'), true)
  assert.equal(esRespuestaNegativa('no.'), true)
  assert.equal(esRespuestaNegativa('Por ahora no'), true)
  assert.equal(esRespuestaNegativa('Sale de mi presupuesto'), true)
  assert.equal(esRespuestaNegativa('No tengo fecha aún'), false)
  assert.equal(esRespuestaNegativa('No me has dado precio'), false)
  assert.equal(esRespuestaNegativa('No sé exactamente, pero sería la semana próxima'), false)
})

const base = {
  stage: 'cotizado',
  fase: 'checkin',
  modoHumano: false,
  ultimoRol: 'bot',
  ultimoMensajeAt: '2026-10-06T12:00:00Z',
  ahora: new Date('2026-10-09T12:00:00Z'),
}

test('frío: 48 h sin contestar después de nuestro mensaje', () => {
  assert.equal(debePasarAFrio(base), true)
  assert.equal(debePasarAFrio({ ...base, ultimoRol: 'agente' }), true)
  assert.equal(debePasarAFrio({ ...base, ultimoMensajeAt: '2026-10-08T12:00:00Z' }), false) // 24 h
})

test('frío: no se esconde a quien espera al asesor ni a quien escribió al último', () => {
  assert.equal(debePasarAFrio({ ...base, ultimoRol: 'usuario' }), false)
  assert.equal(debePasarAFrio({ ...base, fase: 'esperando_asesor' }), false)
  assert.equal(debePasarAFrio({ ...base, fase: 'confirmado' }), false)
  assert.equal(debePasarAFrio({ ...base, modoHumano: true }), false)
  assert.equal(debePasarAFrio({ ...base, stage: 'deposito_pendiente' }), false)
  assert.equal(debePasarAFrio({ ...base, stage: 'frio' }), false)
})

test('frío: al volver a escribir regresa a su columna', () => {
  assert.equal(stageAlRegresarDeFrio(2), 'cotizado')
  assert.equal(stageAlRegresarDeFrio(null), 'nuevo_contacto')
})
