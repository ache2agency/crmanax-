import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { escenario } from './webhook-fixture.mjs'
import { resolverDisponibilidadFase2 } from '../lib/whatsapp/fase2-disponibilidad.ts'

const now = '2026-11-09T18:00:00Z'
const FixedDate = class extends Date { constructor(...args) { super(...(args.length ? args : [now])) } }
function load(path, mocks) {
  const exports = {}
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Date: FixedDate, Set, URL, require(name) {
    if (!(name in mocks)) throw Error(`Import sin mock: ${name}`)
    return mocks[name]
  } })
  return exports
}
const conflictos = load('../lib/reservas/conflictos.ts', { './ical': {} })
const lofts = ['excel', 'ical', 'crm', 'motor', 'libre'].map((id, orden) => ({ id, nombre: `PB-${orden + 1}`, tipo: 'chico', orden }))
const reservas = ['excel', 'airbnb_ical', 'crm', 'motor'].map((origen, i) => ({
  loft_id: lofts[i].id, origen, canal: 'airbnb', fecha_checkin: '2026-12-01', fecha_checkout: '2026-12-04',
}))
function consulta({ exito = now, excelError = false, throws = false, feeds = [] } = {}) {
  const fuentes = [ ...(exito === null ? [] : [{ fuente_key: 'excel', ultimo_exito_at: exito }]), ...feeds ]
  const db = { from(table) {
    assert.ok(['lofts', 'reservas', 'reservas_fuentes'].includes(table), 'Sin monitor conjunto, escrituras ni proveedores')
    let data = { lofts, reservas, reservas_fuentes: fuentes }[table]
    const q = {
      select() { return q }, order() { return q },
      eq(k, v) { if (k !== 'activo') data = data.filter(r => r[k] === v); return q },
      lt(k, v) { data = data.filter(r => r[k] < v); return q },
      gt(k, v) { data = data.filter(r => r[k] > v); return q },
      async maybeSingle() { if (throws) throw Error('fallo simulado'); return { data: data[0] || null, error: excelError ? { message: 'fallo simulado' } : null } },
      then(resolve) { return Promise.resolve({ data, error: null }).then(resolve) },
    }
    return q
  } }
  return load('../lib/disponibilidad.ts', {
    '@/utils/supabase/server': { createServiceRoleClient: () => db },
    '@/lib/reservas/conflictos': conflictos,
  }).loftsDisponibles
}
const rango = { checkin: '2026-12-01', checkout: '2026-12-04', personas: 1 }

test('T44: Excel (incluso canal Airbnb), crm y motor ocupan; iCal se ofrece; salida exclusiva y capacidad conservadas', async () => {
  const consultar = consulta()
  const r = await consultar(rango)
  assert.deepEqual(Array.from(r.disponibles, l => l.id), ['ical', 'libre'])
  assert.deepEqual(Array.from(r.ocupados, l => l.id), ['excel', 'crm', 'motor'])
  assert.equal(r.datosViejos, false)
  assert.equal((await consultar({ ...rango, checkin: '2026-12-04', checkout: '2026-12-05' })).disponibles.length, 5)
  assert.equal((await consultar({ ...rango, personas: 2 })).disponibles.length, 0)
})

for (const caso of [
  { nombre: 'feed caído y viejo con Excel fresco', feeds: [{ fuente_key: 'airbnb_ical:ical', origen: 'airbnb_ical', ultimo_exito_at: '2026-11-01T18:00:00Z', ultimo_intento_ok: false }], vieja: false },
  { nombre: 'sin feeds y Excel fresco', vieja: false },
  { nombre: 'Excel de exactamente 2 horas', exito: '2026-11-09T16:00:00Z', vieja: false },
  { nombre: 'Excel viejo aunque iCal esté fresco', exito: '2026-11-09T15:59:59Z', feeds: [{ fuente_key: 'airbnb_ical:ical', ultimo_exito_at: now }], vieja: true },
  { nombre: 'Excel ausente', exito: null, vieja: true },
  { nombre: 'fecha Excel inválida', exito: 'inválida', vieja: true },
  { nombre: 'error al leer Excel', excelError: true, vieja: true },
  { nombre: 'excepción al leer Excel', throws: true, vieja: true },
]) test(`T44 webhook real: ${caso.nombre}`, async () => {
  const consultar = consulta(caso)
  assert.equal((await consultar(rango)).datosViejos, caso.vieja)
  const s = escenario('checkin', '+525500000044', { hoy: '2026-11-09', consultar })
  Object.assign(s.db.leads[0], { num_personas: 1 })
  await s.enviar('Del 1 al 4 de diciembre, 1 persona')
  assert.equal(s.respuestas().length, 1)
  const respuesta = s.respuestas()[0].body
  if (caso.vieja) {
    assert.match(respuesta, /Un asesor te confirma disponibilidad/)
    assert.doesNotMatch(respuesta, /Sí tenemos disponibilidad/)
  } else {
    assert.match(respuesta, /Sí tenemos disponibilidad estimada/)
    assert.doesNotMatch(respuesta, /Un asesor te confirma disponibilidad/)
  }
  const cotizacion = await resolverDisponibilidadFase2({ ...rango, nombre: 'Demo', whatsapp: 'ficticio', consultar })
  assert.equal(cotizacion.loft.id, 'ical', 'Ofrece el loft libre en Excel aunque iCal lo bloquee')
})

test('T44 API autenticada comparte disponibilidad del bot; conserva rechazo sin sesión', async () => {
  for (const user of [null, { id: 'ficticio' }]) {
    const route = load('../app/api/disponibilidad/route.ts', {
      'next/server': { NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200 }) } },
      '@/utils/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
      '@/lib/disponibilidad': { loftsDisponibles: consulta() },
    })
    const r = await route.GET(new Request('http://localhost/api/disponibilidad?checkin=2026-12-01&checkout=2026-12-04&personas=1'))
    assert.equal(r.status, user ? 200 : 401)
    if (user) {
      assert.deepEqual(Array.from(r.body.disponibles, l => l.id), ['ical', 'libre'])
      assert.equal(r.body.datosViejos, false)
    }
  }
})
