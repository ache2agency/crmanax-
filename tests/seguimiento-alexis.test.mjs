import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as parsers from '../lib/whatsapp/bot-parsers.ts'
import { escenario } from './webhook-fixture.mjs'
const source = ts.transpileModule(readFileSync(new URL('../lib/whatsapp/seguimiento.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

test('motor de seguimiento usa contexto, excluye humano/cierres y reclama una sola vez', async () => {
  for (const bloqueo of ['', 'humano', 'agente', 'esperando_asesor', 'confirmado', 'no_interesado', 'posponer', 'rechazo', 'reservado']) {
    const s = escenario('personas', '+525500000003')
    const conv = s.db.whatsapp_conversaciones[0], lead = s.db.leads[0]
    Object.assign(conv, { seguimiento_enviado: false, humano_intervino: false, modo_humano: bloqueo === 'humano', ultimo_mensaje_at: '2026-10-29T23:00:00Z' })
    Object.assign(lead, { fecha_checkin: '2026-10-31', fecha_checkout: '2026-11-30' })
    if (['esperando_asesor', 'confirmado', 'no_interesado'].includes(bloqueo)) conv.fase = bloqueo
    if (bloqueo === 'reservado') lead.stage = 'reservado'
    s.db.whatsapp_mensajes.push({ conversacion_id: conv.id, rol: bloqueo === 'agente' ? 'agente' : 'usuario', created_at: '2026-10-29T23:00:00Z', contenido: bloqueo === 'posponer' ? 'Yo me comunico' : bloqueo === 'rechazo' ? 'Ya no lo necesito' : 'llegada sábado, 1 mes' })
    const exports = {}
    runInNewContext(source, { exports, console, Date, require(name) {
      if (name.endsWith('/bot-parsers')) return parsers
      if (name.endsWith('/provider')) return { sendMetaWhatsAppMessage: async m => s.enviados.push(m) }
      return {}
    } })
    const n = await exports.enviarSeguimientos(s.supabase, { ahora: new Date('2026-10-30T16:00:00Z') })
    assert.equal(n, bloqueo ? 0 : 1, bloqueo)
    if (!bloqueo) {
      assert.match(s.enviados[0].body, /cuántas personas.*31\/10\/2026.*30\/11\/2026/)
      assert.equal(s.db.whatsapp_mensajes.at(-1).contenido, s.enviados[0].body)
      assert.equal(await exports.enviarSeguimientos(s.supabase, { ahora: new Date('2026-10-30T16:00:00Z') }), 0)
    }
  }
})
