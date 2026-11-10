import { Buffer } from 'node:buffer'
import { createHash, timingSafeEqual } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

type Conversation = {
  id: string; whatsapp: string; fase: string | null; modo_humano: boolean;
  ultimo_mensaje_at: string | null;
  lead: { nombre: string | null; loft_id: string | null; stage: string | null } | null;
}
type Message = { rol: string; contenido: string; created_at: string }
type Dependencies = { resumen?: (req: Request, client: () => SupabaseClient, current: number) => Promise<Response>; client: () => SupabaseClient; token: () => string | undefined; now?: () => number }
const WINDOW = 10 * 60_000
const dateFormat = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})

export function cdmx(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return null
  // ISO con offset calculado con IANA (incluye el horario histórico de CDMX).
  const date = new Date(value)
  const local = dateFormat.format(date).replace(' ', 'T')
  const offset = Math.round((Date.parse(local + 'Z') - date.getTime()) / 60_000)
  const sign = offset < 0 ? '-' : '+'
  const minutes = Math.abs(offset)
  return `${local}${sign}${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

// Lista blanca de campos y filtrado defensivo del texto libre. Nunca leer raw_payload/media.
export function textoLectura(value: string | null) {
  if (value === null) return null
  const text = value.replace(/(?:https?:\/\/|www\.)[^\s<>]+/gi, '[enlace omitido]')
  const normalized = text.normalize('NFKD').replace(/\p{M}/gu, '')
  if (/\b(clabe|iban|swift|cvv|cvc|nip|pin|otp|codigo de acceso|contrasenas?|clave|credenciales?|password|passwd|secret|token|api[_ -]?key|authorization|bearer|service[_ -]?role)\b/i.test(normalized)
    || /\b(cuentas?|tarjetas?|transferencias?|bancari[oa]s?|beneficiarios?|titular|bancos?|deposit[oa]s?|comprobantes?)\b/i.test(normalized)
    || /(?:\d[ -]*){13,}/.test(normalized)
    || /(?:sk-[\w-]{12,}|gh[pousr]_[\w]+|eyJ[\w-]+\.[\w-]+\.[\w-]+|EAA[\w]{25,})/.test(normalized)) {
    return '[contenido sensible omitido]'
  }
  return text.slice(0, 4000)
}

function integer(params: URLSearchParams, name: string, fallback: number, max: number) {
  const values = params.getAll(name)
  if (!values.length) return fallback
  if (values.length !== 1 || !/^[1-9]\d{0,5}$/.test(values[0])) throw new Error('parametro')
  const n = Number(values[0])
  if (n > max) throw new Error('parametro')
  return n
}

export function crearLectura({ client, token, resumen, now = Date.now }: Dependencies) {
  // Un único token por CRM; memoria acotada. Compartido por las tres rutas en esta instancia.
  let windowStart = 0, requests = 0, tokenHash = ''
  function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
    return Response.json(body, { status, headers: {
      'Cache-Control': 'private, no-store, max-age=0', Vary: 'Authorization',
      'X-Content-Type-Options': 'nosniff', ...extra,
    } })
  }
  return async function lectura(req: Request, detalle: boolean | 'resumen') {
    if (req.method !== 'GET') return json({ error: 'Solo GET' }, 405, { Allow: 'GET' })
    const expected = token()
    if (!expected) return json({ error: 'Lectura no configurada' }, 503)
    const hash = (s: string) => createHash('sha256').update(s).digest()
    const supplied = /^Bearer ([^\s]+)$/i.exec(req.headers.get('authorization') || '')?.[1] || ''
    // Siempre comparar digests de igual longitud, incluso con header ausente o mal formado.
    if (!timingSafeEqual(hash(supplied), hash(expected)) || !supplied) {
      return json({ error: 'No autorizado' }, 401, { 'WWW-Authenticate': 'Bearer' })
    }
    const current = now(), digest = hash(expected).toString('hex')
    if (digest !== tokenHash || current - windowStart >= WINDOW) {
      windowStart = current; requests = 0; tokenHash = digest
    }
    if (requests >= 60) return json({ error: 'Demasiadas solicitudes' }, 429, {
      'Retry-After': String(Math.max(1, Math.ceil((windowStart + WINDOW - current) / 1000))),
    })
    requests++
    if (detalle === 'resumen') {
      try {
        if (!resumen) throw new Error('configuracion')
        return await resumen(req, client, current)
      } catch {
        console.warn('[lectura] resumen fallido')
        return json({ error: 'No se pudo consultar el resumen' }, 500)
      }
    }
    let horas = 24, limite = detalle ? 500 : 200, whatsapp = ''
    try {
      const params = new URL(req.url).searchParams
      limite = integer(params, 'limite', limite, 500)
      if (detalle) {
        if (params.getAll('whatsapp').length !== 1) throw new Error('parametro')
        // URLSearchParams interpreta '+' literal como espacio; permitir ambos y consultar variantes.
        whatsapp = (params.get('whatsapp') || '').trim().replace(/^\+/, '')
        if (!/^[1-9]\d{7,14}$/.test(whatsapp)) throw new Error('parametro')
      } else horas = integer(params, 'horas', 24, 168)
    } catch {
      return json({ error: 'Parámetros inválidos: horas 1–168, limite 1–500, whatsapp internacional' }, 400)
    }
    try {
      const db = client()
      let query = db.from('whatsapp_conversaciones')
        .select('id,whatsapp,fase,modo_humano,ultimo_mensaje_at,lead:leads(nombre,loft_id,stage)')
        .order('ultimo_mensaje_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false })
      if (detalle) query = query.in('whatsapp', [whatsapp, '+' + whatsapp])
      else query = query.gte('ultimo_mensaje_at', new Date(current - horas * 3600_000).toISOString())
      const result = await query.limit(detalle ? 2 : limite + 1)
      if (result.error) throw new Error('consulta')
      const found = result.data as unknown as Conversation[]
      if (detalle && !found.length) return json({ error: 'Conversación no encontrada' }, 404)
      // No mezclar historiales si existen dos formatos del mismo número en la BD.
      if (detalle && found.length > 1) return json({ error: 'Número ambiguo; requiere revisión en CRM' }, 409)
      const conversations = found.slice(0, detalle ? 1 : limite)
      const output: unknown[] = new Array(conversations.length)
      let cursor = 0
      const messageLimit = detalle ? limite : 20
      async function worker() {
        while (cursor < conversations.length) {
          const index = cursor++, c = conversations[index]
          let messagesQuery = db.from('whatsapp_mensajes').select('rol,contenido,created_at')
            .eq('conversacion_id', c.id).order('created_at', { ascending: false }).order('id', { ascending: false })
          if (!detalle) messagesQuery = messagesQuery.gte('created_at', new Date(current - horas * 3600_000).toISOString())
          const messages = await messagesQuery.limit(messageLimit + 1)
          if (messages.error) throw new Error('consulta')
          const rows = messages.data as Message[]
          // Presupuesto por chat para mantener la lista máxima debajo del límite HTTP de Vercel.
          const safeMessages = []
          let bytes = 0
          for (const m of rows.slice(0, messageLimit)) {
            const safe = { rol: m.rol, contenido: textoLectura(m.contenido), created_at: cdmx(m.created_at) }
            bytes += Buffer.byteLength(JSON.stringify(safe), 'utf8')
            if (bytes > (detalle ? 2_000_000 : 5_000)) break
            safeMessages.push(safe)
          }
          output[index] = {
            whatsapp: c.whatsapp, fase: c.fase, modo_humano: c.modo_humano,
            ultimo_mensaje_at: cdmx(c.ultimo_mensaje_at),
            lead: c.lead ? { nombre: textoLectura(c.lead.nombre)?.slice(0, 200) ?? null, loft_id: c.lead.loft_id, stage: c.lead.stage } : null,
            mensajes: safeMessages.reverse(), mensajes_truncados: rows.length > safeMessages.length,
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(5, conversations.length) }, () => worker()))
      return json({ zona_horaria: 'America/Mexico_City',
        ...(detalle ? { conversacion: output[0] } : { horas, limite, conversaciones: output, conversaciones_truncadas: found.length > limite }),
      })
    } catch {
      // No registrar consultas, contenido, WhatsApp, headers ni errores del proveedor.
      console.warn('[lectura] consulta fallida')
      return json({ error: 'No se pudo consultar el historial' }, 500)
    }
  }
}
