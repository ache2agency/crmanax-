import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import * as ical from '../lib/reservas/ical.ts'
import { resolverDisponibilidadFase2 } from '../lib/whatsapp/fase2-disponibilidad.ts'
const now = new Date('2026-10-31T18:00:00Z')
function load(path, mocks, env = {}) {
  const exports = {}
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { fileName: path, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, Date, Set, console, process: { env: { CRON_SECRET: 'falso', ...env } }, require(name) { if (!(name in mocks)) throw Error(`Falta mock ${name}`); return mocks[name] } })
  return exports
}
const pure = load('../lib/reservas/conflictos.ts', { './ical': ical })
const { detectarConflictos, fuenteVieja, resumenFrescura } = pure
const row = (loft_id, origen, start, end, canal = 'airbnb') => ({ loft_id, origen, fecha_checkin: start, fecha_checkout: end, canal })

test('PB-01: Excel Airbnb o directo, Airbnb libre: riesgo rojo agrupado con salida exclusiva', () => {
  for (const canal of ['airbnb', 'directo']) {
    const result = detectarConflictos([row('pb1','excel','2026-12-05','2026-12-08', canal)], ['pb1'], now)
    assert.equal(result.length, 1); assert.equal(result[0].tipo, 'doble_reserva_riesgo')
    assert.equal(result[0].fecha_inicio, '2026-12-05'); assert.equal(result[0].fecha_fin, '2026-12-08')
  }
})

test('PB-03 mensual y reserva encimada: traslape solo en días comunes; checkout=checkin no traslapa', () => {
  const rows = [row('pb3','excel','2026-12-01','2026-12-31'), row('pb3','excel','2026-12-08','2026-12-12'), row('pb3','airbnb_ical','2026-12-01','2026-12-31')]
  const result = detectarConflictos(rows, ['pb3'], now)
  assert.equal(result.length, 1); assert.equal(result[0].tipo, 'traslape_excel')
  assert.equal(result[0].fecha_inicio, '2026-12-08'); assert.equal(result[0].fecha_fin, '2026-12-12')
  const adjacent = [row('pb3','excel','2026-12-01','2026-12-08'), row('pb3','excel','2026-12-08','2026-12-12'), row('pb3','airbnb_ical','2026-12-01','2026-12-12')]
  assert.equal(detectarConflictos(adjacent, ['pb3'], now).length, 0)
})

test('solo Airbnb: preparación de PB-02, 1ER-14, 2DO-22; feed caído no genera ningún conflicto', () => {
  const rows = [row('pb2','airbnb_ical','2026-12-01','2026-12-04'), row('1er14','airbnb_ical','2026-11-14','2026-11-17'), row('2do22','airbnb_ical','2026-11-02','2026-11-03'), row('caido','excel','2026-11-01','2026-12-01')]
  const result = detectarConflictos(rows, ['pb2','1er14','2do22'], now)
  assert.equal(result.length, 3); assert.ok(result.every(c => c.tipo === 'solo_airbnb'))
  assert.equal(detectarConflictos(rows, [], now).length, 0)
})

test('horizonte: recorta conflictos y agrupa días aunque haya bordes de reservas adyacentes', () => {
  const result = detectarConflictos([row('pb1','excel','2026-10-01','2026-11-01'), row('pb1','excel','2026-11-01','2027-12-01')], ['pb1'], now)
  assert.equal(result.length, 1); assert.equal(result[0].fecha_inicio, '2026-10-31'); assert.equal(result[0].fecha_fin, '2027-10-31')
})

test('frescura: último éxito, límite estricto de 2h, fallo reciente no borra éxito anterior', () => {
  assert.equal(fuenteVieja('2026-10-31T16:00:00Z', now), false)
  assert.equal(fuenteVieja('2026-10-31T15:59:59Z', now), true)
  assert.equal(fuenteVieja(null, now), true)
  const estados = [{ fuente_key: 'excel', origen: 'excel', loft_id: null, ultimo_exito_at: '2026-10-31T17:00:00Z' }, { fuente_key: 'airbnb_ical:uno', origen: 'airbnb_ical', loft_id: 'uno', ultimo_exito_at: '2026-10-31T17:00:00Z', ultimo_intento_ok: false }]
  assert.equal(resumenFrescura(estados, ['uno'], now).vieja, false)
  assert.equal(resumenFrescura(estados, ['uno','dos'], now).vieja, true)
})

test('cola automática 28-jul→31-oct-2027 ignorada; estancia corta y reserva temprana conservadas', () => {
  assert.equal(ical.esColaVentana('2027-07-28','2027-10-31',now), true)
  assert.equal(ical.esColaVentana('2027-07-28','2027-10-31',new Date('2026-11-01T18:00:00Z')), true)
  assert.equal(ical.esColaVentana('2027-07-28','2027-08-01',now), false)
  assert.equal(ical.esColaVentana('2027-05-01','2027-10-31',now), false)
  assert.deepEqual(ical.leerFeeds(JSON.stringify({ 'PB-01': 'https://www.airbnb.mx/calendar/ical/000.ics?t=FALSO' })), { 'PB-01': 'https://www.airbnb.mx/calendar/ical/000.ics?t=FALSO' })
})

test('cotización con fuente vieja conserva elección/precio pero no afirma disponibilidad', async () => {
  const options = { nombre: 'Demo', whatsapp: 'ficticio', checkin: '2026-11-02', checkout: '2026-11-05', personas: 1 }
  const consultar = datosViejos => async () => ({ datosViejos, disponibles: [{ id: 'pb1', nombre: 'PB-01', tipo: 'chico' }], ocupados: [] })
  const fresh = await resolverDisponibilidadFase2({ ...options, consultar: consultar(false) })
  const stale = await resolverDisponibilidadFase2({ ...options, consultar: consultar(true) })
  assert.equal(stale.loft.id, fresh.loft.id); assert.equal(stale.total, fresh.total)
  assert.doesNotMatch(stale.response, /Sí tenemos|aparece disponible/)
  assert.match(stale.response, /Un asesor te confirma disponibilidad/)
})

test('monitor independiente exige secreto y no crea sync/WhatsApp', async () => {
  let called = 0
  const route = load('../app/api/reservas/monitor/route.ts', {
    'next/server': { NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200 }) } },
    '@/lib/reservas/monitor': { actualizarMonitorReservas: async () => { called++; return {} } },
  })
  const req = secret => ({ headers: new Headers({ authorization: `Bearer ${secret}` }) })
  assert.equal((await route.GET(req('incorrecto'))).status, 401); assert.equal(called, 0)
  assert.equal((await route.GET(req('falso'))).status, 200); assert.equal(called, 1)
})

test('monitor al final del sync persiste estado por feed, excluye fallidos y envía solo push reclamadas', async () => {
  for (const { excelOk, configured } of [{ excelOk:true,configured:false }, { excelOk:false,configured:false }, { excelOk:true,configured:true }]) {
    const requests = [], pushes = []
    const db = { from(table) {
      const data = table === 'lofts' ? [{ id:'pb1',nombre:'PB-01' },{ id:'pb2',nombre:'PB-02' }] : table === 'reservas' ? [row('pb1','excel','2026-12-05','2026-12-08'), row('pb2','excel','2026-12-05','2026-12-08')] : []
      const q = { select() { return q }, eq() { return q }, in() { return q }, lt() { return q }, gt() { return q }, order() { return q }, is() { return q }, range() { return q }, then(resolve) { return Promise.resolve({ data,error:null }).then(resolve) } }; return q
    }, async rpc(name,args) { requests.push({ name,args }); return { data: name === 'reclamar_avisos_reservas' ? [{ title:'Alerta',body:'Sin datos personales',url:'/' }] : null, error:null } } }
    const module = load('../lib/reservas/monitor.ts', {
      '@/utils/supabase/server': { createServiceRoleClient: () => db },
      '@/lib/push': { enviarPushATodos: async p => pushes.push(p) },
      './conflictos': { ...pure, detectarConflictos: (rows,lofts) => detectarConflictos(rows,lofts,now) },
      './ical': { ...ical, ventanaIcal: () => ical.ventanaIcal(now) },
    }, configured ? { NEXT_PUBLIC_VAPID_PUBLIC_KEY:'falso',VAPID_PRIVATE_KEY:'falso' } : {})
    await module.actualizarMonitorReservas({ excelOk,loftsOk:['pb1'] })
    const args = requests.find(r => r.name === 'actualizar_monitor_reservas').args
    assert.equal(args.p_estados.length,3)
    assert.equal(args.p_estados.find(s => s.loft_id === 'pb2').ok,false)
    assert.equal(args.p_conflictos.length,excelOk ? 1 : 0)
    assert.equal(args.p_lofts_evaluados.includes('pb2'),false)
    // Sin VAPID no consume avisos pendientes.
    assert.equal(requests.some(r => r.name === 'reclamar_avisos_reservas'),configured)
    assert.equal(pushes.length,configured ? 1 : 0)
  }
})


test('panel: 11/12 feeds, feed fallido, frescura roja, conflictos rojos y amarillos plegados', () => {
  const { default: Estado } = load('../components/crm/EstadoDisponibilidad.jsx', {
    'react/jsx-runtime': jsxRuntime, '@/lib/reservas/conflictos': pure,
  })
  const lofts = Array.from({ length:12 }, (_,i) => ({ id:String(i),nombre:`Loft ${i}` }))
  const estados = [{ origen:'excel',ultimo_exito_at:'2026-10-31T15:00:00Z' }, ...lofts.map((l,i) => ({ origen:'airbnb_ical',loft_id:l.id,ultimo_exito_at:'2026-10-31T17:50:00Z',ultimo_intento_ok:i !== 3 }))]
  const conflictos = ['doble_reserva_riesgo','traslape_excel','solo_airbnb'].map((tipo,i) => ({ id:String(i),loft_id:String(i),tipo,detalle:pure.ACCION_CONFLICTO[tipo],fecha_inicio:'2026-12-05',fecha_fin:'2026-12-08' }))
  const html = renderToStaticMarkup(jsxRuntime.jsx(Estado, { monitor:{ lofts,estados,conflictos },now }))
  assert.match(html,/11\/12 feeds OK/); assert.match(html,/Falló\/sin configurar: Loft 3/)
  assert.match(html,/role="alert"/); assert.match(html,/hace 180 min/)
  assert.match(html,/2 conflictos/); assert.match(html,/Bloquear en Airbnb/); assert.match(html,/dos reservas encimadas/)
  assert.match(html,/<details/); assert.match(html,/1 bloqueos solo en Airbnb/)
})
