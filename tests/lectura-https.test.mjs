import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import * as crypto from 'node:crypto'
import { Buffer } from 'node:buffer'
import ts from 'typescript'
import { createClient } from '@supabase/supabase-js'

const source = readFileSync(new URL('../lib/lectura/servicio.ts', import.meta.url), 'utf8')
function load(path, mocks) {
  const exports = {}
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, URL, Response, Date, console: { warn() {} }, require(name) {
    if (!(name in mocks)) throw Error(`Import sin mock: ${name}`)
    return mocks[name]
  } })
  return exports
}
const { crearLectura, textoLectura } = load('../lib/lectura/servicio.ts', { 'node:crypto': crypto, 'node:buffer': { Buffer } })
const now = Date.parse('2026-11-09T18:00:00Z')
const forbidden = { raw_payload: { token: 'secreto-no-exponer' }, media_url: 'https://private.invalid/media?token=secreto', email: 'privado@invalid', deposito_monto: 999, notas: 'nota privada' }
function setup({ configured = 'token-ficticio', errorTable, throws = false, many = false, large = false, duplicate = false, empty = false } = {}) {
  let token = configured, time = now, clients = 0
  const calls = []
  const conversations = empty ? [] : [
    { id: 'c1', whatsapp: '+525500000052', fase: 'dudas', modo_humano: false, ultimo_mensaje_at: '2026-11-09T17:00:00Z', lead: { nombre: 'Demo', curso: 'Inglés', loft_id: 'loft-demo', stage: 'cotizado', ...forbidden }, ...forbidden },
    { id: 'c2', whatsapp: '525500000053', fase: 'saludo', modo_humano: true, ultimo_mensaje_at: '2026-11-09T16:00:00Z', lead: null },
    { id: 'old', whatsapp: '+525500000054', fase: 'cerrado', modo_humano: true, ultimo_mensaje_at: '2026-11-01T16:00:00Z', lead: null },
  ]
  if (duplicate) conversations.push({ ...conversations[0], id: 'duplicate', whatsapp: '525500000052' })
  const messages = [
    { id: '1', conversacion_id: 'c1', rol: 'usuario', contenido: 'Hola, horarios y precio $1500?', created_at: '2026-11-09T17:00:00.123Z', ...forbidden },
    { id: '2', conversacion_id: 'c1', rol: 'bot', contenido: 'CLABE 012345678901234567', created_at: '2026-11-09T17:01:00Z', ...forbidden },
    { id: '3', conversacion_id: 'c1', rol: 'agente', contenido: 'Foto https://private.invalid/signed?token=secret', created_at: '2026-11-09T17:02:00Z', ...forbidden },
    { id: '0', conversacion_id: 'c1', rol: 'usuario', contenido: 'histórico', created_at: '2026-11-01T17:00:00Z' },
    { id: 'other', conversacion_id: 'c2', rol: 'usuario', contenido: 'otro chat', created_at: '2026-11-09T16:00:00Z' },
  ]
  if (many) for (let i = 0; i < 25; i++) messages.push({ id: `extra-${i}`, conversacion_id: 'c1', rol: 'bot', contenido: `mensaje ${i}`, created_at: `2026-11-09T17:${String(10 + i).padStart(2, '0')}:00Z` })
  if (large) for (const m of messages) m.contenido = '漢'.repeat(4000)
  const db = createClient('https://lectura.invalid', 'fake', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, init) => {
    const req = new Request(input, init), u = new URL(req.url)
    assert.equal(u.hostname, 'lectura.invalid', 'Prohibida red real')
    assert.equal(req.method, 'GET', 'Solo SELECT; no RPC/escrituras')
    const table = u.pathname.split('/').at(-1)
    assert.ok(['whatsapp_conversaciones', 'whatsapp_mensajes'].includes(table))
    calls.push({ table, params: u.searchParams })
    if (throws) throw Error('token-secreto-del-proveedor')
    if (table === errorTable) return Response.json({ message: 'token-secreto-del-proveedor' }, { status: 500 })
    const select = u.searchParams.get('select')
    assert.equal(select, table === 'whatsapp_conversaciones' ? 'id,whatsapp,fase,modo_humano,ultimo_mensaje_at,lead:leads(nombre,loft_id,stage)' : 'rol,contenido,created_at')
    let rows = [...(table === 'whatsapp_conversaciones' ? conversations : messages)]
    for (const [key, filter] of u.searchParams) {
      if (filter.startsWith('eq.')) rows = rows.filter(r => r[key] === filter.slice(3))
      if (filter.startsWith('gte.')) rows = rows.filter(r => r[key] >= filter.slice(4))
      if (filter.startsWith('in.')) { const vals = filter.slice(4, -1).split(','); rows = rows.filter(r => vals.includes(r[key])) }
    }
    const field = table === 'whatsapp_conversaciones' ? 'ultimo_mensaje_at' : 'created_at'
    rows.sort((a, b) => b[field].localeCompare(a[field]) || b.id.localeCompare(a.id))
    return Response.json(rows.slice(0, Number(u.searchParams.get('limit'))))
  } } })
  const lectura = crearLectura({ client() { clients++; return db }, token: () => token, now: () => time })
  function call(query = '', detail = false, auth = 'Bearer token-ficticio', method = 'GET') {
    return lectura(new Request('https://local.invalid/api/lectura/' + (detail ? 'conversacion' : 'conversaciones') + query, { method, headers: auth === null ? {} : { Authorization: auth } }), detail)
  }
  return { call, lectura, calls, clients: () => clients, setToken: v => { token = v }, advance: n => { time += n } }
}

test('auth: header ausente, malo, largo, prefijo inválido y Unicode → 401 sin BD', async () => {
  const s = setup()
  for (const auth of [null, '', 'token-ficticio', 'Basic token-ficticio', 'Bearer incorrecto', 'Bearer ' + 'a'.repeat(4096), 'Bearer contraseña']) {
    const r = await s.call('', false, auth)
    assert.equal(r.status, 401)
    assert.equal(r.headers.get('www-authenticate'), 'Bearer')
    assert.match(r.headers.get('cache-control'), /no-store/)
  }
  assert.equal(s.clients(), 0)
  assert.match(source, /timingSafeEqual\(hash\(supplied\), hash\(expected\)\)/)
})
test('sin variable → 503, incluso sin header; no inicializa Supabase', async () => {
  const s = setup({ configured: '' })
  assert.equal((await s.call()).status, 503)
  assert.equal((await s.call('', false, null)).status, 503)
  assert.equal(s.clients(), 0)
})
test('lista: SELECT acotado, ventana real, lead nulo y mensajes CDMX/cronológicos', async () => {
  const s = setup(), r = await s.call(), body = await r.json()
  assert.equal(r.status, 200)
  assert.equal(body.horas, 24)
  assert.equal(body.limite, 200)
  assert.equal(body.conversaciones.length, 2)
  const c = body.conversaciones[0]
  assert.equal(c.whatsapp, '+525500000052')
  assert.equal(c.ultimo_mensaje_at, '2026-11-09T11:00:00-06:00')
  assert.equal(c.mensajes[0].created_at, '2026-11-09T11:00:00-06:00')
  assert.equal(c.mensajes[0].contenido, 'Hola, horarios y precio $1500?')
  assert.equal(c.mensajes[1].contenido, '[contenido sensible omitido]')
  assert.equal(c.mensajes[2].contenido, 'Foto [enlace omitido]')
  assert.equal(body.conversaciones[1].lead, null)
  assert.equal(body.conversaciones[1].modo_humano, true)
  assert.deepEqual(Object.keys(c.lead).sort(), ["loft_id", "nombre", "stage"])
  assert.ok(!JSON.stringify(body).match(/raw_payload|media_url|secreto|private.invalid|0123456789|deposito_monto|notas|privado@/))
  assert.equal(r.headers.get('access-control-allow-origin'), null)
  assert.match(r.headers.get('cache-control'), /no-store/)
  assert.equal(r.headers.get('vary'), 'Authorization')
  assert.equal(s.calls[0].params.get('ultimo_mensaje_at'), 'gte.2026-11-08T18:00:00.000Z')
  assert.equal(s.calls[0].params.get('limit'), '201')
})
test('detalle: + codificado, + literal y dígitos; últimos N de cualquier fecha; solo ese chat', async () => {
  for (const number of ['%2B525500000052', '+525500000052', '525500000052']) {
    const s = setup(), r = await s.call('?whatsapp=' + number, true), b = await r.json()
    assert.equal(r.status, 200)
    assert.equal(b.conversacion.mensajes.length, 4)
    assert.equal(b.conversacion.mensajes[0].contenido, 'histórico')
    assert.ok(!JSON.stringify(b).includes('otro chat'))
    assert.equal(s.calls[1].params.get('conversacion_id'), 'eq.c1')
    assert.equal(s.calls[1].params.get('created_at'), null)
  }
})
test('404 ausente; 409 número ambiguo, sin mezclar mensajes', async () => {
  assert.equal((await setup().call('?whatsapp=525500000099', true)).status, 404)
  const s = setup({ duplicate: true })
  assert.equal((await s.call('?whatsapp=525500000052', true)).status, 409)
  assert.equal(s.calls.length, 1)
})
test('parámetros inválidos y duplicados → 400 sin BD', async () => {
  const s = setup()
  for (const q of ['?horas=169', '?horas=0', '?horas=-1', '?horas=1.5', '?horas=NaN', '?horas=', '?horas=24&horas=48', '?limite=501', '?limite=0', '?limite=Infinity', '?limite=1&limite=2']) {
    assert.equal((await s.call(q)).status, 400, q)
  }
  for (const q of ['', '?whatsapp=', '?whatsapp=1', '?whatsapp=5255%27,or(id.gt.0)', '?whatsapp=525500000052&whatsapp=525500000053', '?whatsapp=525500000052&limite=501']) {
    assert.equal((await s.call(q, true)).status, 400, q)
  }
  assert.equal(s.clients(), 0)
})
test('máximos horas=168/limite=500 aceptados, límites aplicados por PostgREST', async () => {
  const s = setup()
  assert.equal((await s.call('?horas=168&limite=500')).status, 200)
  assert.equal(s.calls[0].params.get('limit'), '501')
  assert.equal(s.calls[0].params.get('ultimo_mensaje_at'), 'gte.2026-11-02T18:00:00.000Z')
  assert.equal((await s.call('?whatsapp=525500000052&limite=500', true)).status, 200)
})
test('truncado explícito: lista, últimos 20 mensajes y detalle con limite=2', async () => {
  const s = setup({ many: true })
  const list = await (await s.call('?limite=1')).json()
  assert.equal(list.conversaciones.length, 1)
  assert.equal(list.conversaciones_truncadas, true)
  assert.equal(list.conversaciones[0].mensajes.length, 20)
  assert.equal(list.conversaciones[0].mensajes_truncados, true)
  const detail = await (await s.call('?whatsapp=525500000052&limite=2', true)).json()
  assert.equal(detail.conversacion.mensajes.length, 2)
  assert.equal(detail.conversacion.mensajes_truncados, true)
  assert.equal(detail.conversacion.mensajes.at(-1).contenido, 'mensaje 24')
})
test('lista vacía no consulta mensajes', async () => {
  const s = setup({ empty: true })
  assert.deepEqual((await (await s.call()).json()).conversaciones, [])
  assert.equal(s.calls.length, 1)
})
test('60/10 min compartidos entre ambas rutas; inválidos no consumen; reinicio/rotación', async () => {
  const s = setup({ empty: true })
  for (let i = 0; i < 61; i++) assert.equal((await s.call('', false, 'Bearer malo')).status, 401)
  for (let i = 0; i < 60; i++) assert.equal((await s.call()).status, 200)
  const r = await s.call('?whatsapp=525500000052', true)
  assert.equal(r.status, 429)
  assert.equal(r.headers.get('retry-after'), '600')
  assert.equal(s.clients(), 60)
  s.advance(600_000)
  assert.equal((await s.call()).status, 200)
  s.setToken('nuevo-ficticio')
  assert.equal((await s.call()).status, 401)
  assert.equal((await s.call('', false, 'Bearer nuevo-ficticio')).status, 200)
})
for (const errorTable of ['whatsapp_conversaciones', 'whatsapp_mensajes']) test(`error ${errorTable} → 500 genérico`, async () => {
  const r = await setup({ errorTable }).call()
  assert.equal(r.status, 500)
  assert.ok(!(await r.text()).includes('token-secreto'))
})
test('excepción del proveedor no filtra detalles', async () => {
  const r = await setup({ throws: true }).call()
  assert.equal(r.status, 500)
  assert.ok(!(await r.text()).includes('token-secreto'))
})
test('métodos de escritura/HEAD/OPTIONS rechazados sin auth ni BD', async () => {
  const s = setup()
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
    const r = await s.call('', false, null, method)
    assert.equal(r.status, 405)
    assert.equal(r.headers.get('allow'), 'GET')
  }
  assert.equal(s.clients(), 0)
})
test('rutas reales usan el singleton; GET únicamente y HEAD sin lectura', async () => {
  let initialized = 0
  const server = load('../lib/lectura/server.ts', {
    '@/utils/supabase/server': {}, './servicio': { crearLectura() { initialized++; return (req, detail) => Response.json({ detail }) } },
  })
  for (const [name, detail] of [['conversaciones', false], ['conversacion', true]]) {
    const route = load(`../app/api/lectura/${name}/route.ts`, { '@/lib/lectura/server': server })
    assert.deepEqual(await (await route.GET(new Request('https://local.invalid'))).json(), { detail })
    assert.equal(route.HEAD().status, 405)
    assert.equal(route.OPTIONS().status, 405)
    assert.equal(route.POST, undefined)
    assert.equal(route.runtime, 'nodejs')
    assert.equal(route.dynamic, 'force-dynamic')
  }
  assert.equal(initialized, 1)
})
test('filtra texto sensible, enlaces firmados y credenciales sin quitar precios', () => {
  for (const text of ['Mi contraseña es inventada', 'token=demo', 'Tarjeta 4111 1111 1111 1111', 'Cuenta: 1234567', 'Transferencia a Demo', 'bánco de prueba', 'sk-ficticio123456789012345', 'ghp_ficticio', 'eyJfake.eyJfake.firma', '123456789012345678']) {
    assert.equal(textoLectura(text), '[contenido sensible omitido]', text)
  }
  assert.equal(textoLectura('Precio $649 por noche'), 'Precio $649 por noche')
  assert.equal(textoLectura('ver https://media.invalid/file?firma=abc'), 'ver [enlace omitido]')
  assert.equal(textoLectura('x'.repeat(9000)).length, 4000)
})

test('presupuesto de bytes limita mensajes Unicode y marca truncado', async () => {
  const s = setup({ large: true })
  const r = await s.call()
  const b = await r.json()
  assert.equal(b.conversaciones[0].mensajes.length, 0)
  assert.equal(b.conversaciones[0].mensajes_truncados, true)
  assert.ok(Buffer.byteLength(JSON.stringify(b)) < 5000)
  const detail = await (await s.call('?whatsapp=525500000052', true)).json()
  assert.equal(detail.conversacion.mensajes.length, 4)
})
