import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as parsers from '../lib/whatsapp/bot-parsers.ts'
import * as disponibilidad from '../lib/whatsapp/fase2-disponibilidad.ts'

// Ejecutar el POST real con Supabase y WhatsApp en memoria: ninguna llamada externa.
const require = createRequire(import.meta.url)
const source = ts.transpileModule(readFileSync(new URL('../app/api/whatsapp/webhook/route.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

export function escenario(fase = 'checkin', whatsapp = '+523112694172', opciones = {}) {
  const db = {
    leads: [{ id: 'lead', nombre: 'Ana', stage: 'cotizado', notas: 'Nota del asesor' }],
    whatsapp_conversaciones: [{ id: 'conv', lead_id: 'lead', whatsapp, fase, estado: 'abierta', ultimo_mensaje_at: new Date().toISOString() }],
    whatsapp_mensajes: [], lead_activities: [],
  }
  const enviados = []
  const supabase = { from(table) {
    const filters = []
    let op = 'select', values, limit
    const orders = []
    const query = {
      select() { return query },
      eq(k, v) { filters.push(row => row[k] === v); return query },
      in(k, vals) { filters.push(row => vals.includes(row[k])); return query },
      not(k, op, vals) { const lista = vals.slice(1, -1).split(','); filters.push(row => !lista.includes(row[k])); return query },
      lte(k, v) { filters.push(row => row[k] <= v); return query },
      order(k, opts) { orders.push([k, opts.ascending]); return query },
      gte(k, v) { filters.push(row => row[k] >= v); return query },
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
          if (orders.length) rows = [...rows].sort((a,b) => {
            for (const [k, asc] of orders) { const cmp = String(a[k]).localeCompare(String(b[k])); if (cmp) return asc ? cmp : -cmp }
            return db[table].indexOf(b) - db[table].indexOf(a)
          })
          if (limit) rows = rows.slice(0, limit)
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject)
        } catch (e) { return Promise.reject(e).then(resolve, reject) }
      },
    }
    return query
  } }
  const exports = {}
  runInNewContext(source + '\nexports.catalogoPrueba = MSG.precios() + flowReminder("confirmar_precios");', {
    exports, process: { env: { ...process.env, BOT_FAQ_EN_ESPERA: opciones.faqEspera } }, Response, setTimeout: opciones.setTimeout || ((fn) => { fn() }), Date: opciones.hoy ? class extends Date { constructor(...args) { super(...(args.length ? args : [opciones.hoy + 'T12:00:00Z'])) } } : Date, console: { log() {}, error: console.error },
    require(name) {
      if (name.endsWith('/bot-parsers')) return opciones.hoy ? { ...parsers, hoyISO: () => opciones.hoy } : parsers
      if (name === '@/utils/supabase/server') return { createServiceRoleClient: () => supabase }
      if (name.endsWith('/provider')) return { normalizePhoneNumber: n => n.startsWith('+') ? n : `+${n}`, sendMetaWhatsAppMessage: async msg => enviados.push(msg) }
      if (name === '@/lib/push') return { enviarPushATodos: async () => {} }
      if (name === 'next/server') return { after() {} }
      if (name.endsWith('/seguimiento')) return {}
      if (opciones.consultar && name === '@/lib/disponibilidad') return { loftsDisponibles: opciones.consultar }
      if (opciones.consultar && name.endsWith('/fase2-disponibilidad')) return disponibilidad
      if (name === '@/lib/disponibilidad' || name.endsWith('/fase2-disponibilidad')) return new Proxy({}, { get() { return () => { throw Error('La disponibilidad no debe consultarse en estos casos') } } })
      return require(name)
    },
  })
  return {
    db, supabase, enviados, catalogo: exports.catalogoPrueba, respuestas: () => enviados.filter(msg => msg.to === whatsapp),
    async enviar(text) {
      const response = await exports.POST(new Request('http://localhost/api/whatsapp/webhook', {
        method: 'POST', body: JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: {
          messages: [{ from: whatsapp, type: 'text', text: { body: text } }],
        } }] }] }),
      }))
      assert.equal(response.status, 200)
      assert.equal((await response.json()).ok, true)
    },
  }
}

