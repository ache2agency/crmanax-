import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as parsers from '../lib/whatsapp/bot-parsers.ts'

// Ejecutar el POST real con Supabase y WhatsApp en memoria: ninguna llamada externa.
const require = createRequire(import.meta.url)
const source = ts.transpileModule(readFileSync(new URL('../app/api/whatsapp/webhook/route.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function escenario(fase = 'checkin', whatsapp = '+523112694172') {
  const db = {
    leads: [{ id: 'lead', nombre: 'Ana', stage: 'cotizado', notas: 'Nota del asesor' }],
    whatsapp_conversaciones: [{ id: 'conv', lead_id: 'lead', whatsapp, fase, estado: 'abierta', ultimo_mensaje_at: new Date().toISOString() }],
    whatsapp_mensajes: [], lead_activities: [],
  }
  const enviados = []
  const supabase = { from(table) {
    const filters = []
    let op = 'select', values, ascending = true, column, limit
    const query = {
      select() { return query },
      eq(k, v) { filters.push(row => row[k] === v); return query },
      order(k, opts) { column = k; ascending = opts.ascending; return query },
      limit(n) { limit = n; return query },
      update(v) { op = 'update'; values = v; return query },
      insert(v) { op = 'insert'; values = v; return query },
      async maybeSingle() { const result = await query; return { ...result, data: result.data[0] || null } },
      then(resolve, reject) {
        try {
          let rows = db[table].filter(row => filters.every(fn => fn(row)))
          if (op === 'update') rows.forEach(row => Object.assign(row, values))
          if (op === 'insert') { rows = values.map(v => ({ ...v, id: `${table}-${db[table].length}`, created_at: new Date().toISOString() })); db[table].push(...rows) }
          // La inserción conserva el orden aun cuando dos timestamps coincidan.
          if (column) rows = [...rows].sort((a,b) => String(a[column]).localeCompare(String(b[column])) || db[table].indexOf(a) - db[table].indexOf(b))
          if (!ascending) rows.reverse()
          if (limit) rows = rows.slice(0, limit)
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject)
        } catch (e) { return Promise.reject(e).then(resolve, reject) }
      },
    }
    return query
  } }
  const exports = {}
  runInNewContext(source + '\nexports.catalogoPrueba = MSG.precios() + flowReminder("confirmar_precios");', {
    exports, process, Response, console: { log() {}, error: console.error },
    require(name) {
      if (name.endsWith('/bot-parsers')) return parsers
      if (name === '@/utils/supabase/server') return { createServiceRoleClient: () => supabase }
      if (name.endsWith('/provider')) return { normalizePhoneNumber: n => n.startsWith('+') ? n : `+${n}`, sendMetaWhatsAppMessage: async msg => enviados.push(msg) }
      if (name === '@/lib/push') return { enviarPushATodos: async () => {} }
      if (name === 'next/server') return { after() {} }
      if (name.endsWith('/seguimiento')) return {}
      if (name === '@/lib/disponibilidad' || name.endsWith('/fase2-disponibilidad')) return new Proxy({}, { get() { return () => { throw Error('La disponibilidad no debe consultarse en estos casos') } } })
      return require(name)
    },
  })
  return {
    db, enviados, catalogo: exports.catalogoPrueba, respuestas: () => enviados.filter(msg => msg.to === whatsapp),
    async enviar(text) {
      const response = await exports.POST(new Request('http://localhost/api/whatsapp/webhook', {
        method: 'POST', body: JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: {
          messages: [{ from: whatsapp, type: 'text', text: { body: text } }],
        } }] }] }),
      }))
      assert.equal(response.status, 200)
    },
  }
}

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
