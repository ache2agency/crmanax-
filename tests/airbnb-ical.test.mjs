import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as ical from '../lib/reservas/ical.ts'
import { ocupacionesEnDia } from '../lib/reservas/calendario.ts'
import { resolverDisponibilidadFase2 } from '../lib/whatsapp/fase2-disponibilidad.ts'
const now = new Date('2026-10-31T18:00:00Z')
const block = (a, b) => ({ fecha_checkin: a, fecha_checkout: b })
const event = (a, b, summary = 'Reserved') => `BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:${a}\r\nDTEND;VALUE=DATE:${b}\r\nSUMMARY:${summary}\r\nDESCRIPTION:Reservation URL https://example.invalid/private\\nPhone 1234\r\nUID:private-id\r\nEND:VEVENT`
const calendar = (...events) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events.join('\r\n')}\r\nEND:VCALENDAR`
const fakeUrl = 'https://www.airbnb.com/calendar/ical/000.ics?s=FAKE_SECRET'
const response = text => new Response(text, { headers: { 'content-type': 'text/calendar' } })

test('iCal reserva y bloqueo DATE: fechas exclusivas, sin datos privados ni UID', () => {
  const rows = ical.parseIcal(calendar(event('20261101', '20261104'), event('20261105', '20261107', 'Airbnb (Not available)')), now)
  assert.deepEqual(rows, [block('2026-11-01', '2026-11-04'), block('2026-11-05', '2026-11-07')])
  assert.doesNotMatch(JSON.stringify(rows), /private|1234|Reserved|SUMMARY/)
  assert.equal(ocupacionesEnDia(rows.map(r => ({ ...r, origen: 'airbnb_ical' })), '2026-11-04').length, 0)
})

test('iCal horizonte de 12 meses: omite futuros y pasados, recorta los que cruzan', () => {
  assert.deepEqual(ical.parseIcal(calendar(event('20271031', '20271103'), event('20261001', '20261003'), event('20270727', '20271031'), event('20271030', '20271103')), now), [block('2027-07-27', '2027-10-31'), block('2027-10-30', '2027-10-31')])
  assert.deepEqual(ical.parseIcal(calendar(event('20261029', '20261102')), now), [block('2026-10-31', '2026-11-02')])
})

test('iCal valida calendario completo/fechas y no vacía ante formato no soportado', () => {
  for (const text of ['<html>error</html>', calendar(event('20260230', '20261104')), calendar(event('20261104', '20261104')), calendar(event('20261101T120000Z', '20261104')), calendar(event('20261101', '20261104').replace('SUMMARY:', 'RRULE:FREQ=DAILY\r\nSUMMARY:')), calendar('BEGIN:VEVENT')]) assert.throws(() => ical.parseIcal(text, now))
  assert.deepEqual(ical.parseIcal(calendar(), now), [])
  assert.equal(ical.parseIcal(calendar(event('20261101', '20261104').replace('DESCRIPTION:', 'DESCRIPTION:folded\r\n description\r\nX-IGNORE:')), now).length, 1)
})

test('descarga con timeout, User-Agent y reintento; errores no exponen secretos', async () => {
  let calls = 0
  const rows = await ical.descargarIcal(fakeUrl, now, async (url, options) => {
    assert.equal(url, fakeUrl); assert.ok(options.signal); assert.match(options.headers['User-Agent'], /Mozilla/); assert.equal(options.redirect, 'error')
    if (++calls === 1) throw new Error(fakeUrl)
    return response(calendar(event('20261101', '20261104')))
  })
  assert.equal(calls, 2); assert.equal(rows.length, 1)
  calls = 0
  await assert.rejects(ical.descargarIcal(fakeUrl, now, async () => { calls++; throw new Error(fakeUrl) }), e => !e.message.includes('FAKE_SECRET'))
  assert.equal(calls, 2)
})

test('fallo de un feed conserva sus bloqueos; otro loft se actualiza y vacío válido libera', async () => {
  const old = [block('2026-11-01', '2026-11-04')]
  const store = new Map([['uno', old], ['dos', old], ['tres', old]])
  const lofts = ['uno', 'dos', 'tres'].map((id, i) => ({ id, nombre: `PB-0${i+1}` }))
  const result = await ical.sincronizarFeeds({ 'PB-01': 'caido', 'PB-02': 'bueno', 'PB-03': 'vacio' }, lofts, [], {
    async replace(id, rows) { store.set(id, rows) },
  }, now, async url => { if (url === 'caido') throw new Error(fakeUrl); return response(url === 'vacio' ? calendar() : calendar(event('20261105', '20261106'))) })
  assert.equal(store.get('uno'), old)
  assert.deepEqual(store.get('dos'), [block('2026-11-05', '2026-11-06')])
  assert.deepEqual(store.get('tres'), [])
  assert.equal(result.errores.length, 1); assert.doesNotMatch(JSON.stringify(result), /FAKE_SECRET/)
})

test('error de persistencia no genera avisos de Airbnb libre sin actualizar', async () => {
  const result = await ical.sincronizarFeeds({ 'PB-01': fakeUrl }, [{ id: 'uno', nombre: 'PB-01' }], [{ loft_id: 'uno', ...block('2026-12-05', '2026-12-08') }], { async replace() { throw new Error('db') } }, now, async () => response(calendar()))
  assert.equal(result.errores.length, 1); assert.deepEqual(result.avisos, [])
})

test('avisos: Excel ocupado y Airbnb libre, resta coberturas y une duplicados', () => {
  assert.deepEqual(ical.diasExcelLibresEnAirbnb([block('2026-12-05', '2026-12-08')], [], now), [block('2026-12-05', '2026-12-08')])
  assert.deepEqual(ical.diasExcelLibresEnAirbnb([block('2026-11-01', '2026-11-10'), block('2026-11-01', '2026-11-03')], [block('2026-11-03', '2026-11-05'), block('2026-11-05', '2026-11-08')], now), [block('2026-11-01', '2026-11-03'), block('2026-11-08', '2026-11-10')])
})

test('configuración rechaza URLs/lofts inválidos sin imprimir URL y acepta JSON ficticio', () => {
  assert.deepEqual(ical.leerFeeds(undefined), {})
  assert.deepEqual(ical.leerFeeds(JSON.stringify({ 'PB-01': fakeUrl })), { 'PB-01': fakeUrl })
  for (const value of ['[]', 'null', '{', JSON.stringify({ otro: fakeUrl }), JSON.stringify({ 'PB-01': 'http://localhost/private' })]) assert.throws(() => ical.leerFeeds(value), e => !e.message.includes('private'))
})

test('panel prioriza Excel sobre iCal sin falso traslape; muestra iCal solo en días extra', () => {
  const excel = { origen: 'excel', ...block('2026-11-01', '2026-11-04') }
  const airbnb = { origen: 'airbnb_ical', ...block('2026-11-01', '2026-11-06') }
  assert.deepEqual(ocupacionesEnDia([airbnb, excel], '2026-11-02'), [excel])
  assert.deepEqual(ocupacionesEnDia([airbnb, excel], '2026-11-04'), [airbnb])
  assert.equal(ocupacionesEnDia([excel, { ...excel }], '2026-11-02').length, 2)
})

function modulo(path, mocks) {
  const exports = {}
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Date, Set, URL, console, process: { env: { CRON_SECRET: 'cron-falso' } }, require(name) { if (!(name in mocks)) throw Error(`Import sin mock: ${name}`); return mocks[name] } })
  return exports
}

test('consulta real de disponibilidad une Excel+iCal y fase2 evita cotizar loft bloqueado', async () => {
  const lofts = [{ id: 'uno', nombre: 'PB-01', tipo: 'chico', orden: 1 }, { id: 'dos', nombre: 'PB-02', tipo: 'chico', orden: 2 }, { id: 'tres', nombre: 'PB-03', tipo: 'mediano', orden: 3 }]
  const rows = [{ loft_id: 'uno', origen: 'excel', ...block('2026-11-02', '2026-11-05') }, { loft_id: 'dos', origen: 'airbnb_ical', ...block('2026-11-02', '2026-11-04') }, { loft_id: 'tres', origen: 'airbnb_ical', ...block('2027-10-31', '2027-11-03') }]
  const db = { from(table) {
    let data = table === 'lofts' ? lofts : rows
    const q = { select() { return q }, eq() { return q }, order() { return q }, lt(key, value) { data = data.filter(r => r[key] < value); return q }, gt(key, value) { data = data.filter(r => r[key] > value); return q }, then(resolve) { return Promise.resolve({ data, error: null }).then(resolve) } }
    return q
  } }
  const { loftsDisponibles } = modulo('../lib/disponibilidad.ts', { '@/utils/supabase/server': { createServiceRoleClient: () => db }, '@/lib/reservas/ical': { ventanaIcal: () => ical.ventanaIcal(now) } })
  const result = await loftsDisponibles({ checkin: '2026-11-02', checkout: '2026-11-04', personas: 1 })
  assert.deepEqual(Array.from(result.disponibles, l => l.id), ['tres'])
  assert.equal((await loftsDisponibles({ checkin: '2026-11-04', checkout: '2026-11-05', personas: 1 })).disponibles.some(l => l.id === 'dos'), true)
  const quote = await resolverDisponibilidadFase2({ nombre: 'Demo', whatsapp: 'ficticio', checkin: '2026-11-02', checkout: '2026-11-04', personas: 1, consultar: loftsDisponibles })
  assert.equal(quote.loft.id, 'tres')
  assert.equal((await loftsDisponibles({ checkin: '2027-10-31', checkout: '2027-11-03' })).disponibles.length, 3)
})


test('endpoint sync exige sesión o secreto; cron solo con secreto y fuentes independientes', async () => {
  let excelCalls = 0, icalCalls = 0
  let authenticated = false
  const route = modulo('../app/api/reservas/sync/route.ts', {
    'next/server': { NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200 }) } },
    '@/utils/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'demo' } : null } }) } }) },
    '@/lib/reservas/sync': { syncReservasDesdeDropbox: async () => { excelCalls++; throw new Error('falló Dropbox') } },
    '@/lib/reservas/sync-ical': { syncReservasAirbnb: async () => { icalCalls++; return { errores: [], avisos: [], rows: 1 } } },
  })
  const request = (secret = '') => new Request('https://example.invalid/api/reservas/sync', { headers: { authorization: `Bearer ${secret}` } })
  assert.equal((await route.POST(request())).status, 401)
  assert.equal(excelCalls, 0)
  authenticated = true
  assert.equal((await route.GET(request())).status, 401)
  const response = await route.POST(request())
  assert.equal(response.status, 207); assert.equal(response.body.airbnb.rows, 1)
  assert.equal(excelCalls, 1); assert.equal(icalCalls, 1)
  authenticated = false
  assert.equal((await route.GET(request('cron-falso'))).status, 207)
  assert.equal(icalCalls, 2)
})

test('API del panel devuelve ambas fuentes sin detalle iCal y limita al horizonte', async () => {
  let authenticated = false
  const data = {
    lofts: [{ id: 'uno', nombre: 'PB-01' }],
    reservas: [
      { origen: 'excel', loft_id: 'uno', nombre_huesped: 'Demo', ...block('2027-10-29', '2027-11-05') },
      { origen: 'airbnb_ical', loft_id: 'uno', nombre_huesped: 'oculto', telefono: '1234', notas: 'oculto', ...block('2027-10-29', '2027-11-05') },
      { origen: 'airbnb_ical', loft_id: 'uno', ...block('2027-10-31', '2027-11-05') },
    ],
    reservas_sync: [{ origen: 'excel', id: 'e' }, { origen: 'airbnb_ical', id: 'i', avisos: [] }],
  }
  const db = { from(table) {
    let rows = data[table]
    const q = { select() { return q }, eq(key, value) { if (table !== 'lofts') rows = rows.filter(r => r[key] === value); return q }, lt() { return q }, gt() { return q }, order() { return q }, limit(n) { rows = rows.slice(0, n); return q }, then(resolve) { return Promise.resolve({ data: rows, error: null }).then(resolve) } }; return q
  } }
  const route = modulo('../app/api/reservas/route.ts', {
    '@/lib/reservas/ical': { ventanaIcal: () => ical.ventanaIcal(now) },
    'next/server': { NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200 }) } },
    '@/utils/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'demo' } : null } }) } }), createServiceRoleClient: () => db },
  })
  const request = new Request('https://example.invalid/api/reservas?mes=2027-10')
  assert.equal((await route.GET(request)).status, 401)
  authenticated = true
  const { body, status } = await route.GET(request)
  assert.equal(status, 200); assert.equal(body.reservas.length, 2)
  assert.equal(body.reservas[0].fecha_checkout, '2027-11-05')
  assert.equal(body.reservas[1].fecha_checkout, '2027-10-31')
  assert.equal(body.reservas[1].telefono, null); assert.equal(body.reservas[1].notas, null)
  assert.equal(body.lastSync.id, 'e'); assert.equal(body.lastIcalSync.id, 'i')
})
