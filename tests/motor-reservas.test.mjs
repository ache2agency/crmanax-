import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as precios from '../lib/whatsapp/fase2-disponibilidad.ts'
import * as ical from '../lib/reservas/ical.ts'

function load(path, mocks, extra = {}, env = { MOTOR_RESERVAS_PREVIEW: '1', VERCEL_ENV: 'preview', NODE_ENV: 'production' }) {
  const exports = {}
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Date, Set, URL, AbortSignal, process: { env }, require(name) { assert.ok(name in mocks, `Import inesperado: ${name}`); return mocks[name] }, ...extra })
  return exports
}
const pure = load('../lib/motor-reservas.ts', { './whatsapp/fase2-disponibilidad': precios })
const frescura = load('../lib/reservas/conflictos.ts', { './ical': ical })
const busca = { entrada: '2026-11-10', salida: '2026-11-13', personas: 2 }

test('motor: fechas reales, checkout exclusivo, personas y horizonte', () => {
  const validar = b => pure.validarBusqueda(b, '2026-11-04', '2027-11-04')
  assert.equal(validar(busca), null)
  for (const b of [{ entrada: '2026-02-30' }, { entrada: '2026-11-03' }, { salida: busca.entrada }, { salida: '2027-11-05' }, { personas: 0 }, { personas: 1.5 }, { personas: 7 }]) assert.equal(typeof validar({ ...busca, ...b }), 'string')
})

test('motor: tarifas del bot, capacidad y mensual sin prorratear', () => {
  assert.equal(pure.opcionLoft({ id: 'chico', nombre: 'PB-02', tipo: 'chico' }, busca), null)
  assert.equal(pure.opcionLoft({ id: 'x', nombre: 'x', tipo: 'desconocido' }, busca), null)
  const mediano = pure.opcionLoft({ id: 'm', nombre: 'PB-01', tipo: 'mediano' }, busca)
  assert.equal(mediano.estimado, 2400)
  assert.equal(mediano.mes, 16000)
  assert.equal(pure.opcionLoft({ id: 'g', nombre: 'PB-04', tipo: 'grande' }, { ...busca, salida: '2026-12-10' }).estimado, 18000)
  assert.equal(pure.opcionLoft({ id: 'g', nombre: 'PB-04', tipo: 'grande' }, { ...busca, personas: 3 }), null)
})

test('motor: apagado en producción aunque el flag esté activo', () => {
  assert.equal(pure.motorPreviewHabilitado(), true)
  const prod = load('../lib/motor-reservas.ts', { './whatsapp/fase2-disponibilidad': precios }, {}, { MOTOR_RESERVAS_PREVIEW: '1', VERCEL_ENV: 'production', NODE_ENV: 'production' })
  assert.equal(prod.motorPreviewHabilitado(), false)
})

function route(fetch) {
  return load('../app/api/motor-reservas/route.ts', { 'next/server': { NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200, headers: init.headers }) } }, '@/lib/motor-reservas': pure, '@/lib/reservas/ical': { ...ical, ventanaIcal: () => ({ hoy: '2026-11-04', limite: '2027-11-04' }) }, '@/lib/reservas/conflictos': frescura }, { fetch }, { MOTOR_RESERVAS_PREVIEW: '1', VERCEL_ENV: 'preview', NODE_ENV: 'production', NEXT_PUBLIC_SUPABASE_URL: 'https://falso.test', SUPABASE_SERVICE_ROLE_KEY: 'FALSO' })
}
const request = new Request('https://demo.test/api/motor-reservas?entrada=2026-11-10&salida=2026-11-13&personas=2')

test('motor: API solo GET, ambas fuentes, paginación y sin datos de huéspedes', async () => {
  const calls = []
  const api = route(async (url, options) => {
    calls.push({ url, options })
    assert.equal(options.method, 'GET')
    const table = url.pathname.split('/').at(-1)
    let data
    if (table === 'lofts') data = [{ id: 'ocupado-excel', nombre: 'PB-01', tipo: 'mediano' }, { id: 'ocupado-ical', nombre: 'PB-04', tipo: 'grande' }, { id: 'libre', nombre: '1ER-11', tipo: 'grande' }]
    else if (table === 'reservas_fuentes') data = []
    else {
      assert.equal(table, 'reservas')
      assert.equal(url.searchParams.get('fecha_checkin'), 'lt.2026-11-13')
      assert.equal(url.searchParams.get('fecha_checkout'), 'gt.2026-11-10')
      assert.doesNotMatch(url.searchParams.get('select'), /nombre|telefono|correo|notas/)
      data = url.searchParams.get('offset') === '0' ? Array.from({ length: 1000 }, () => ({ loft_id: 'ocupado-excel', origen: 'excel', fecha_checkin: '2026-11-10', fecha_checkout: '2026-11-13' })) : [{ loft_id: 'ocupado-ical', origen: 'airbnb_ical', fecha_checkin: '2026-11-10', fecha_checkout: '2026-11-13' }]
    }
    return { ok: true, json: async () => data }
  })
  const result = await api.GET(request)
  assert.equal(result.status, 200)
  assert.equal(result.body.opciones.length, 1)
  assert.equal(result.body.opciones[0].id, 'libre')
  assert.equal(result.body.datosViejos, true)
  assert.equal(calls.length, 4)
  assert.equal(result.headers['Cache-Control'], 'no-store')
})

test('motor: fallos de Supabase no devuelven lofts ficticios ni secretos', async () => {
  const api = route(async () => ({ ok: false }))
  const result = await api.GET(request)
  assert.equal(result.status, 503)
  assert.equal(result.body.opciones, undefined)
  assert.doesNotMatch(JSON.stringify(result), /FALSO|falso.test/)
})

test('motor: parámetros inválidos no consultan Supabase', async () => {
  const api = route(async () => { assert.fail('No debe consultar') })
  assert.equal((await api.GET(new Request('https://demo.test/api/motor-reservas?entrada=2026-02-30&salida=2026-11-13&personas=2'))).status, 400)
})
