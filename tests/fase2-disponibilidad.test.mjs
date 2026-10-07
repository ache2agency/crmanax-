import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  calcularNochesFase2,
  precioTotalEstimado,
  resolverDisponibilidadFase2,
  tipoRentaDesdeFechas,
  tiposAdecuadosParaPersonas,
} from '../lib/whatsapp/fase2-disponibilidad.ts'

const loft = (tipo, nombre = tipo) => ({ id: tipo, tipo, nombre: `Loft ${nombre}`, orden: 1 })

test('fase 2: detecta renta por noche vs mensual desde las fechas', () => {
  assert.equal(calcularNochesFase2('2026-10-10', '2026-10-13'), 3)
  assert.equal(calcularNochesFase2('2026-10-13', '2026-10-10'), 0)
  assert.equal(calcularNochesFase2('fecha-rara', '2026-10-10'), 0)
  assert.equal(tipoRentaDesdeFechas('2026-10-10', '2026-10-13'), 'noche')
  assert.equal(tipoRentaDesdeFechas('2026-10-10', '2026-11-10'), 'mes')
})

test('fase 2: respeta capacidades por personas', () => {
  assert.deepEqual(tiposAdecuadosParaPersonas(1), ['chico', 'mediano', 'grande'])
  assert.deepEqual(tiposAdecuadosParaPersonas(2), ['mediano', 'grande'])
  assert.deepEqual(tiposAdecuadosParaPersonas(3), [])
})

test('fase 2: precios exactos por noche y mensual', () => {
  assert.equal(precioTotalEstimado({ tipoRenta: 'noche', tipoLoft: 'chico', personas: 1, noches: 3 }).texto, '$2,100 MXN (3 noches × $700)')
  assert.equal(precioTotalEstimado({ tipoRenta: 'noche', tipoLoft: 'mediano', personas: 2, noches: 3 }).texto, '$2,400 MXN (3 noches × $800)')
  assert.equal(precioTotalEstimado({ tipoRenta: 'mes', tipoLoft: 'chico', personas: 1, noches: 31 }).texto, '$12,000 MXN/mes')
  assert.equal(precioTotalEstimado({ tipoRenta: 'mes', tipoLoft: 'mediano', personas: 1, noches: 31 }).texto, '$14,000 MXN/mes')
  assert.equal(precioTotalEstimado({ tipoRenta: 'mes', tipoLoft: 'mediano', personas: 2, noches: 31 }).texto, '$16,000 MXN/mes')
  assert.equal(precioTotalEstimado({ tipoRenta: 'mes', tipoLoft: 'grande', personas: 1, noches: 31 }).texto, '$16,000 MXN/mes')
  assert.equal(precioTotalEstimado({ tipoRenta: 'mes', tipoLoft: 'grande', personas: 2, noches: 31 }).texto, '$18,000 MXN/mes')
})

test('fase 2: con disponibilidad elige loft adecuado, total y escala a asesor', async () => {
  const r = await resolverDisponibilidadFase2({
    nombre: 'Ana',
    whatsapp: '+525500000000',
    checkin: '2026-10-10',
    checkout: '2026-10-13',
    personas: 2,
    consultar: async () => ({ disponibles: [loft('chico'), loft('mediano')], ocupados: [] }),
  })
  assert.equal(r.ok, true)
  assert.match(r.response, /Loft Mediano/)
  assert.match(r.response, /\$2,400 MXN/)
  assert.match(r.response, /asesor te (confirma|contacta)/)
  assert.match(r.alerta, /Lead con disponibilidad estimada/)
  assert.match(r.alerta, /Total estimado/)
})

test('fase 2: renta mensual calcula salida a 28+ noches y precio mensual', async () => {
  const r = await resolverDisponibilidadFase2({
    nombre: 'Luis',
    whatsapp: '+525500000001',
    checkin: '2026-10-10',
    checkout: '2026-11-10',
    personas: 1,
    consultar: async () => ({ disponibles: [loft('chico')], ocupados: [] }),
  })
  assert.equal(r.ok, true)
  assert.match(r.response, /Loft Chico/)
  assert.match(r.response, /\$12,000 MXN\/mes/)
})

test('fase 2: sin disponibilidad ofrece fecha libre cercana', async () => {
  const llamadas = []
  const r = await resolverDisponibilidadFase2({
    nombre: 'Maya',
    whatsapp: '+525500000002',
    checkin: '2026-10-10',
    checkout: '2026-10-13',
    personas: 1,
    consultar: async ({ checkin, checkout }) => {
      llamadas.push([checkin, checkout])
      if (checkin === '2026-10-12') return { disponibles: [loft('grande')], ocupados: [] }
      return { disponibles: [], ocupados: [loft('chico'), loft('mediano'), loft('grande')] }
    },
  })
  assert.equal(r.ok, false)
  assert.match(r.response, /no veo disponibilidad estimada/)
  assert.match(r.response, /12\/10\/2026/)
  assert.match(r.response, /Loft Grande/)
  assert.equal(llamadas.length >= 3, true)
})
