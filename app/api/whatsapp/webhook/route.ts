import { createServiceRoleClient } from '@/utils/supabase/server'
import {
  getMetaConfig,
  normalizePhoneNumber,
  sendMetaWhatsAppMessage,
} from '@/lib/whatsapp/provider'
import { enviarPushATodos } from '@/lib/push'

const ADMIN_WHATSAPP_NUMBERS = (process.env.ALERT_WHATSAPP_NUMBER || '+525534815126,+527471028306')
  .split(',')
  .map((n) => n.trim())
  .filter(Boolean)

const ADMIN_WHATSAPP_NUMBERS_NORMALIZED = new Set(ADMIN_WHATSAPP_NUMBERS.map(normalizePhoneNumber))
const ADMIN_TEST_MODE_MINUTES = 30

async function alertarAdmin(mensaje: string) {
  for (const numero of ADMIN_WHATSAPP_NUMBERS) {
    try {
      await sendMetaWhatsAppMessage({ to: numero, body: mensaje })
    } catch (e) {
      console.error(`[webhook] alerta admin (texto libre) falló (${numero}):`, e)
    }
  }
}

// Cualquier mensaje entrante de un número admin (texto, o el toque del botón
// del template de nudge) reabre su ventana de 24h del lado de Meta — se
// registra aquí sin importar el tipo de mensaje, porque parseIncoming() solo
// procesa mensajes de texto y de otro modo se perdería el toque del botón.
async function registrarAperturaVentanaAdmin(
  supabase: ReturnType<typeof createServiceRoleClient>,
  payload: unknown
) {
  const from = extraerFromCrudo(payload)
  if (!from || !ADMIN_WHATSAPP_NUMBERS_NORMALIZED.has(from)) return
  await supabase
    .from('admin_ventana_24h')
    .upsert([{ whatsapp: from, ultima_apertura: new Date().toISOString() }])
}

async function alertarNuevoLead(profileName: string, from: string, primerMensaje: string) {
  await alertarAdmin(
    `🆕 *Nuevo lead*\n\n` +
    `👤 *Nombre:* ${profileName || 'Sin nombre'}\n` +
    `📱 *WhatsApp:* ${from}\n\n` +
    `"${primerMensaje}"`
  )
}

// Botones "sí" de los 3 templates de reactivación (A: seguimiento_solicitud_anax,
// B: retomar_datos_anax, C: retomar_conversacion_anax) — cada uno con su propio texto.
const BOTONES_SIGUE_INTERESADO = new Set([
  'sí, envíame la info',
  'sí, quiero continuar',
  'sí, contáctenme',
])
const BOTON_YA_NO = 'ya no, gracias'

// Toque de botón de cualquiera de los templates de reactivación (A/B/C) —
// llega como message.type === "button", no "text", por eso se maneja aparte
// de parseIncoming() y antes de su filtro. No se filtra por `fase` porque cada
// template se dispara a leads en fases distintas (A: esperando_asesor,
// B: a medio flujo, C: fase variable) — solo importa la conversación más
// reciente de ese número.
async function manejarBotonReactivacion(
  supabase: ReturnType<typeof createServiceRoleClient>,
  payload: unknown
): Promise<boolean> {
  const message = extraerMensajeCrudo(payload)
  if (!message || message.type !== 'button') return false

  const from = extraerFromCrudo(payload)
  if (!from || ADMIN_WHATSAPP_NUMBERS_NORMALIZED.has(from)) return false

  const botonTexto = (((message.button as Record<string, unknown> | undefined)?.text as string) || '').trim()
  const botonLower = botonTexto.toLowerCase()

  const { data: conv } = await supabase
    .from('whatsapp_conversaciones')
    .select('id, lead_id')
    .eq('whatsapp', from)
    .order('ultimo_mensaje_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!conv) return false

  let nombre = from
  if (conv.lead_id) {
    const { data: lead } = await supabase.from('leads').select('nombre').eq('id', conv.lead_id).maybeSingle()
    if (lead?.nombre?.trim()) nombre = lead.nombre.trim()
  }

  await supabase.from('whatsapp_mensajes').insert([{
    conversacion_id: conv.id,
    rol: 'usuario',
    contenido: botonTexto || '(botón sin texto)',
    raw_payload: payload as Record<string, unknown>,
  }])
  await supabase.from('whatsapp_conversaciones').update({ ultimo_mensaje_at: new Date().toISOString() }).eq('id', conv.id)

  if (botonLower === BOTON_YA_NO) {
    if (conv.lead_id) await supabase.from('leads').update({ stage: 'no_interesado' }).eq('id', conv.lead_id)
    await alertarAdmin(`🔴 *${nombre}* respondió que ya no le interesa (reactivación) — ${from}`)
  } else if (BOTONES_SIGUE_INTERESADO.has(botonLower)) {
    await alertarAdmin(`🟢 *${nombre}* confirmó que SIGUE interesado (reactivación) — ${from}. Contactar para dar seguimiento real.`)
  } else {
    await alertarAdmin(`💬 *${nombre}* respondió el botón "${botonTexto}" (reactivación) — ${from}`)
  }

  try {
    await enviarPushATodos({
      title: `🔔 Reactivación — ${nombre}`,
      body: botonTexto || 'Respondió al mensaje de reactivación',
    })
  } catch (e) {
    console.error('[webhook] error enviando push (reactivación):', e)
  }

  return true
}

// ─── Types ────────────────────────────────────────────────────────────────────

type IncomingWhatsAppMessage = {
  body: string
  from: string
  waNumber: string
  profileName: string
  rawPayload: Record<string, unknown>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcularPrecio(tipo: string, loft: string, personas: number, checkin: string, checkout: string): string {
  if (tipo === 'noche') {
    if (!checkin || !checkout) return 'a consultar con el asesor'
    const d1 = new Date(checkin)
    const d2 = new Date(checkout)
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 'a consultar con el asesor'
    const noches = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
    if (noches <= 0) return 'a consultar con el asesor'
    const precioPorNoche = loft === 'chico' ? 700 : loft === 'grande' ? 900 : 800
    const total = noches * precioPorNoche
    return `$${total.toLocaleString('es-MX')} MXN (${noches} noche${noches !== 1 ? 's' : ''} × $${precioPorNoche})`
  } else {
    if (loft === 'chico') return '$12,000 MXN/mes'
    if (loft === 'grande') return personas <= 1 ? '$16,000 MXN/mes' : '$18,000 MXN/mes'
    return personas <= 1 ? '$14,000 MXN/mes' : '$16,000 MXN/mes'
  }
}

// Número de noches entre checkin y checkout (fechas 'YYYY-MM-DD'). Devuelve 0
// si las fechas no son válidas o el rango no es positivo.
function calcularNoches(checkin: string, checkout: string): number {
  if (!checkin || !checkout) return 0
  const d1 = new Date(checkin)
  const d2 = new Date(checkout)
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0
  const noches = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
  return noches > 0 ? noches : 0
}

// El flujo ya no pregunta tipo de renta (se quitó en julio por simplicidad) —
// se infiere de las fechas: 28+ noches se trata como renta mensual.
function inferirTipoRenta(checkin: string, checkout: string): 'noche' | 'mes' {
  return calcularNoches(checkin, checkout) >= 28 ? 'mes' : 'noche'
}

// Rango de precio ESTIMADO para el mensaje automático antes de pasar con el
// asesor. Usa las mismas tarifas que calcularPrecio()/MSG.precios() (vigentes
// desde 2026-07-02). Solo aplica para 1-2 personas: el catálogo actual no
// tiene ningún loft para más de 2 (Grande = hasta 2 personas), así que ese
// caso se maneja aparte sin dar precio (ver fase 'personas' en el POST).
function calcularRangoPrecio(
  tipoRenta: 'noche' | 'mes',
  personas: number,
  noches: number
): { min: number; max: number } | null {
  if (personas > 2) return null
  // Chico solo alcanza para 1 persona; Mediano y Grande alcanzan para 1-2.
  const loftsQueAlcanzan = personas <= 1 ? ['chico', 'mediano', 'grande'] : ['mediano', 'grande']
  const precios = loftsQueAlcanzan.map((loft) => {
    if (tipoRenta === 'mes') {
      if (loft === 'chico') return 12000
      if (loft === 'grande') return personas <= 1 ? 16000 : 18000
      return personas <= 1 ? 14000 : 16000 // mediano
    }
    // 'noche': tarifa plana × número de noches
    const porNoche = loft === 'chico' ? 700 : loft === 'grande' ? 900 : 800
    return porNoche * Math.max(noches, 1)
  })
  return { min: Math.min(...precios), max: Math.max(...precios) }
}

function formatRangoPrecio(rango: { min: number; max: number }): string {
  const fmt = (n: number) => `$${n.toLocaleString('es-MX')}`
  return rango.min === rango.max ? `${fmt(rango.min)} MXN` : `${fmt(rango.min)} – ${fmt(rango.max)} MXN`
}

// Respuestas sí/no a "¿te interesa este rango de precio?" (fase 'confirmar_interes').
function esRespuestaAfirmativa(textLower: string): boolean {
  const t = textLower.trim()
  return /^(s[ií]\b|claro|va\b|dale|adelante|de acuerdo|correcto|me interesa|s[ií] me interesa|quiero|por supuesto|ok(?:ay)?\b)/.test(t)
}

function esRespuestaNegativa(textLower: string): boolean {
  const t = textLower.trim()
  return /^no\b/.test(t) || /\bya no\b/.test(t)
}

function nombreLoft(loft: string): string {
  if (loft === 'chico') return 'Loft Chico (~16 m², 1 persona)'
  if (loft === 'mediano') return 'Loft Mediano (~24 m², 1-2 personas)'
  return 'Loft Grande (~32 m², hasta 2 personas)'
}

function opcionesTipoLoft(tipo: string, personas: number): string {
  if (tipo === 'noche') {
    if (personas <= 1) {
      return `¿Qué tipo de loft prefieres?\n\n1️⃣ *Loft Chico* (~16 m², 1 persona) — $700 MXN/noche\n2️⃣ *Loft Mediano* (~24 m², 1-2 personas) — $800 MXN/noche\n3️⃣ *Loft Grande* (~32 m², hasta 2 personas) — $900 MXN/noche\n\n📸 Fotos y detalles: https://anaxagoras41suite.arqarri.com/`
    }
    return `Para ${personas} personas el loft indicado es el *Loft Mediano* (~24 m²) a $800 MXN/noche.\n\n¿Confirmas esta opción?\n\n1️⃣ *Sí, Loft Mediano*\n2️⃣ *Ver otras opciones con un asesor*\n\n📸 Fotos: https://anaxagoras41suite.arqarri.com/`
  } else {
    if (personas <= 1) {
      return `¿Qué tipo de loft prefieres?\n\n1️⃣ *Loft Chico* (~16 m², 1 persona) — $12,000 MXN/mes\n2️⃣ *Loft Mediano* (~24 m², 1-2 personas) — $14,000 MXN/mes\n\n📸 Fotos y detalles: https://anaxagoras41suite.arqarri.com/`
    }
    return `¿Qué tipo de loft prefieres?\n\n1️⃣ *Loft Mediano* (~24 m², 1-2 personas) — $16,000 MXN/mes\n2️⃣ *Loft Grande* (~32 m², hasta 2 personas) — $18,000 MXN/mes\n\n📸 Fotos y detalles: https://anaxagoras41suite.arqarri.com/`
  }
}

function parseLoft(text: string, tipo: string, personas: number): string | null {
  const t = text.toLowerCase()
  if (t === '1' || t.includes('chico') || t.includes('pequeño')) {
    return personas <= 1 ? 'chico' : (tipo === 'noche' ? 'mediano' : 'mediano')
  }
  if (t === '2' || t.includes('mediano')) return 'mediano'
  if (t === '3' || t.includes('grande')) return 'grande'
  if (t.includes('asesor') || t.includes('otra') || t.includes('opcion')) return 'consultar'
  return null
}

const PALABRAS_NO_NOMBRE = [
  'hola', 'gracias', 'buenas', 'buenos', 'tardes', 'noches', 'dias', 'dia',
  'informacion', 'info', 'precio', 'precios', 'costo', 'costos', 'cuanto',
  'quiero', 'necesito', 'renta', 'loft', 'lofts', 'disponibilidad', 'ayuda',
  'porfavor', 'favor', 'saludos', 'oferta', 'ofertas', 'departamento',
]

function normalizar(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function esNombreValido(text: string): boolean {
  const t = text.trim()
  if (!t || t.length > 40) return false
  if (/[?¿]/.test(t)) return false
  if (/\d/.test(t)) return false
  if (!/[a-záéíóúñ]/i.test(t)) return false
  const palabras = t.split(/\s+/).filter(Boolean)
  if (palabras.length === 0 || palabras.length > 4) return false
  if (palabras.map(normalizar).some(p => PALABRAS_NO_NOMBRE.includes(p))) return false
  return true
}

// Anuncios "click-to-WhatsApp" de Meta prellenan un mensaje tipo:
// "Hola, vi su anuncio en Facebook. Te comparto la información solicitada: Juan Pérez, 31 julio, 2 personas"
// Si el lead ya escribió su nombre ahí, lo aprovechamos en vez de volver a pedirlo.
function extraerNombreDeAnuncio(text: string): string | null {
  const m = text.match(/solicitada:\s*(.+)/i)
  if (!m) return null
  const candidato = m[1].split(',')[0].trim()
  return esNombreValido(candidato) ? candidato : null
}

function esDespedida(textLower: string): boolean {
  return /gracias.*(despu[eé]s|luego|m[aá]s tarde|con calma)|me comunico|te escribo (despu[eé]s|luego|m[aá]s tarde)|hablamos (despu[eé]s|luego)|nos vemos/.test(textLower)
}

function formatFecha(fecha: string): string {
  if (!fecha) return '-'
  const [y, m, d] = fecha.split('-')
  if (!y || !m || !d) return '-'
  return `${d}/${m}/${y}`
}

function parseDate(text: string): string | null {
  // Accepts DD/MM/YYYY or DD-MM-YYYY or DD/MM/YY
  const m = text.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (!m) return null
  const day = m[1].padStart(2, '0')
  const month = m[2].padStart(2, '0')
  const year = m[3].length === 2 ? `20${m[3]}` : m[3]
  const d = new Date(`${year}-${month}-${day}`)
  if (isNaN(d.getTime())) return null
  return `${year}-${month}-${day}`
}

// Compara strings 'YYYY-MM-DD' — funciona porque ese formato ordena igual lexicográfica y cronológicamente
function esFechaAnteriorAHoy(fecha: string): boolean {
  const hoy = new Date().toISOString().slice(0, 10)
  return fecha < hoy
}

async function getAdminId(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>
): Promise<string | null> {
  try {
    // Primero intenta con DEFAULT_LEAD_ASIGNADO_A del env
    const envId = process.env.DEFAULT_LEAD_ASIGNADO_A
    if (envId) return envId
    // Fallback: primer admin en profiles
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('rol', 'admin')
      .limit(1)
      .maybeSingle()
    return (data?.id as string | undefined) ?? null
  } catch {
    return null
  }
}

// ─── Parse incoming WhatsApp message (Meta Cloud API) ─────────────────────────

function isMetaPayload(payload: unknown): boolean {
  return (
    !!payload &&
    typeof payload === 'object' &&
    'object' in (payload as object) &&
    (payload as Record<string, unknown>).object === 'whatsapp_business_account'
  )
}

function extraerMensajeCrudo(payload: unknown): Record<string, unknown> | null {
  if (!isMetaPayload(payload)) return null
  const p = payload as Record<string, unknown>
  const entry = Array.isArray(p.entry) ? p.entry[0] as Record<string, unknown> : null
  const change = Array.isArray(entry?.changes) ? (entry?.changes[0] as Record<string, unknown>) : null
  const value = change?.value as Record<string, unknown> | null
  if (!value) return null
  const messages = Array.isArray(value.messages) ? value.messages : []
  return (messages[0] as Record<string, unknown> | undefined) ?? null
}

// Número del remitente sin importar el tipo de mensaje (texto, botón de
// template, imagen, etc.) — a diferencia de parseIncoming(), que solo procesa
// mensajes de texto y de otro modo perdería el toque del botón del template.
function extraerFromCrudo(payload: unknown): string | null {
  const message = extraerMensajeCrudo(payload)
  if (!message?.from) return null
  return normalizePhoneNumber(message.from as string)
}

function parseIncoming(payload: unknown): IncomingWhatsAppMessage | null {
  try {
    if (!isMetaPayload(payload)) return null

    const p = payload as Record<string, unknown>
    const entry = Array.isArray(p.entry) ? p.entry[0] as Record<string, unknown> : null
    const change = Array.isArray(entry?.changes)
      ? (entry?.changes[0] as Record<string, unknown>)
      : null
    const value = change?.value as Record<string, unknown> | null
    if (!value) return null

    // Status updates (delivered, read) — ignorar
    if (Array.isArray(value.statuses) && value.statuses.length > 0 && !value.messages) {
      return null
    }

    const message = extraerMensajeCrudo(payload)
    if (!message?.from) return null

    const from = normalizePhoneNumber(message.from as string)
    const contacts = Array.isArray(value.contacts) ? value.contacts : []
    const profileName =
      ((contacts[0] as Record<string, unknown>)?.profile as Record<string, unknown>)?.name as string || ''

    // Solo mensajes de texto
    if (message.type !== 'text') return null
    const body = ((message.text as Record<string, unknown>)?.body as string) || ''
    if (!body) return null

    return { body, from, waNumber: from, profileName, rawPayload: p }
  } catch {
    return null
  }
}

// ─── Bot messages ─────────────────────────────────────────────────────────────

const MSG = {
  bienvenida: () =>
    `¡Hola! 👋 Con gusto te comparto toda la información sobre nuestros lofts en *Anaxágoras 41*. Para darte una atención más personalizada, ¿me puedes decir tu nombre?`,

  saludo: (nombre: string) =>
    `Mucho gusto, *${nombre}*! 😊\n\nEstamos ubicados en Piedad Narvarte, Benito Juárez, CDMX. Estos son nuestros lofts:\n\n🛏 *Loft Chico* (~16 m², 1 persona)\n• Por noche: $700 MXN\n• Mensual: $12,000 MXN\n\n🛏 *Loft Mediano* (~24 m², 1-2 personas)\n• Por noche: $800 MXN\n• Mensual 1 persona: $14,000 MXN\n• Mensual 2 personas: $16,000 MXN\n\n🛏 *Loft Grande* (~32 m², hasta 2 personas)\n• Por noche: $900 MXN\n• Mensual 1 persona: $16,000 MXN\n• Mensual 2 personas: $18,000 MXN\n\n_Todos incluyen agua, luz, gas, internet (150 Mbps), Smart TV, área de cocina, limpieza semanal y cerradura inteligente._\n\n📸 Puedes ver fotos de cada loft aquí: https://anaxagoras41suite.arqarri.com/\n\n¿Qué tipo de renta te interesa?\n\n1️⃣ *Por noche*\n2️⃣ *Por mes*`,

  pedirTipoRenta: () =>
    `¿Qué tipo de renta te interesa?\n\n1️⃣ *Por noche*\n2️⃣ *Por mes*`,

  pedirCheckin: () =>
    `¿Cuál es tu fecha de llegada?\n\nEscríbela así: *DD/MM/YYYY*\nEjemplo: 15/06/2026`,

  pedirCheckout: () =>
    `¿Y cuál es tu fecha de salida?\n\nEscríbela así: *DD/MM/YYYY*`,

  pedirPersonas: () =>
    `¿Cuántas personas se hospedarán?`,

  errorTipoRenta: () =>
    `Por favor elige una opción:\n\n1️⃣ *Por noche*\n2️⃣ *Por mes*`,

  errorFecha: () =>
    `No pude entender esa fecha 😅\n\nEscríbela así: *DD/MM/YYYY*\nEjemplo: 15/06/2026`,

  errorFechaPasada: () =>
    `Esa fecha ya pasó 😅\n\nEscribe una fecha de llegada a partir de hoy.\nEjemplo: 15/06/2026`,

  errorFechaCheckoutInvalida: () =>
    `La fecha de salida debe ser *posterior* a la de llegada 😅\n\nEscríbela así: *DD/MM/YYYY*`,

  errorPersonas: () =>
    `Por favor escribe el número de personas (ej: *2*)`,

  errorTipoLoft: () =>
    `Por favor elige una opción válida (escribe *1* o *2*).`,

  // Precio estimado (rango) tras dar personas — fase 'personas' → 'confirmar_interes'.
  rangoPrecio: (nombre: string, tipoRenta: 'noche' | 'mes', rango: { min: number; max: number }) =>
    `¡Perfecto, *${nombre}*! 🙌 Con esos datos, el costo estimado ronda:\n\n` +
    `💰 *${formatRangoPrecio(rango)}*${tipoRenta === 'mes' ? ' (mensual)' : ' (total de tu estancia)'}\n\n` +
    `_Este precio es estimado — un asesor te confirma el precio exacto y la disponibilidad real._\n\n` +
    `¿Te interesa este rango? Responde *sí* o *no* 😊`,

  errorConfirmarInteres: () =>
    `¿Me confirmas si te interesa ese rango de precio? Responde *sí* o *no* 🙏`,

  cierreNoInteresado: () =>
    `Entendido, gracias por tu tiempo 🙏 Si más adelante buscas algo en otro rango, aquí estamos.`,

  confirmado: (tipo: string, loft: string, checkin: string, checkout: string, personas: number, nombre: string) =>
    `Perfecto, *${nombre}*! 😊 Aquí está el resumen de tu solicitud:\n\n` +
    `🛏 *Loft:* ${nombreLoft(loft)}\n` +
    `📅 *Llegada:* ${formatFecha(checkin)}\n` +
    `📅 *Salida:* ${formatFecha(checkout)}\n` +
    `👥 *Personas:* ${personas}\n` +
    `🏷 *Renta:* ${tipo === 'noche' ? 'Por noche' : 'Por mes'}\n` +
    `💰 *Costo estimado:* ${calcularPrecio(tipo, loft, personas, checkin, checkout)}\n\n` +
    `¿Confirmas tu interés? Verificaremos disponibilidad y un asesor te contactará para finalizar tu reserva. ✅`,

  asesorActivo: () =>
    `✅ ¡Listo! Un asesor verificará disponibilidad y te confirmará en breve.\n\nMientras tanto, ten a la mano:\n📄 Identificación oficial (ambos lados)\n📧 Tu correo para registrarte en la app Yale Connect (acceso al edificio)\n💳 Depósito en garantía (el asesor te indica el monto exacto)\n\n¿Tienes alguna otra duda?`,

  precios: () =>
    `*Tarifas Anaxágoras 41:*\n\n🛏 *Loft Chico* (~16 m², 1 persona)\n• Por noche: $700 MXN\n• Mensual: $12,000 MXN\n\n🛏 *Loft Mediano* (~24 m², 1-2 personas)\n• Por noche: $800 MXN\n• Mensual 1 persona: $14,000 MXN\n• Mensual 2 personas: $16,000 MXN\n\n🛏 *Loft Grande* (~32 m², hasta 2 personas)\n• Por noche: $900 MXN\n• Mensual 1 persona: $16,000 MXN\n• Mensual 2 personas: $18,000 MXN\n\n_Todos incluyen agua, luz, gas, internet, limpieza semanal y cambio de blancos._`,

  ubicacion: () =>
    `📍 *Anaxágoras 41*\nColonia Piedad Narvarte, Benito Juárez, CDMX\n\nCerca de:\n• Parque Delta\n• Hospital Siglo XXI / Centro Médico\n• Roma Norte\n• WTC\n• Autódromo Hermanos Rodríguez\n\n🗺 https://maps.google.com/?q=19.402599,-99.156502\n\nTransporte:\n• EcoBici: 1 min\n• Metrobús Obrero Mundial: 5 min\n• Metro Centro Médico: 10 min`,

  servicios: () =>
    `*Servicios incluidos en todos los lofts:*\n\n✅ Agua, luz, gas e internet (150 Mbps)\n✅ Smart TV y Alexa\n✅ Área de cocina equipada\n✅ Zona de trabajo\n✅ Cerradura inteligente\n✅ Limpieza semanal\n✅ Cambio de blancos\n✅ Lavandería (1 uso/semana)\n✅ Roof garden de uso común\n\n❌ No contamos con estacionamiento propio\n❌ No contamos con elevador`,

  estacionamiento: () =>
    `No contamos con estacionamiento propio, pero hay opciones cerca:\n\n🅿️ Estacionamientos públicos en la zona\n🅿️ Parque Delta (a pasos del edificio)\n\n¿Hay algo más en que te pueda ayudar?`,

  rooftop: () =>
    `*Roof Top Anaxágoras* — Eventos\n\nEspacio semitechado ideal para eventos pequeños, brunchs y reuniones.\n\n👥 Capacidad: hasta 20 personas\n⏰ Horario: 9:00 a.m. – 12:00 a.m.\n💰 Tarifa: $6,000 MXN (7 horas)\n🔒 Depósito: $2,000 MXN (se devuelve al día siguiente)\n\nIncluye: mobiliario, barra con tarja, bocina, proyector y sanitario.\n\n_No se permite equipo de audio externo ni grupos musicales._\n\nPara reservar el Roof Top escríbenos al *+52 55 3481 5126*.`,

  seguridad: () =>
    `*Seguridad en Anaxágoras 41:*\n\n🔐 Cerraduras inteligentes con códigos personalizados\n📹 Videovigilancia en entrada, pasillos, terraza y lavandería\n🚪 Control de acceso individual\n\nPolítica: *un acceso = una persona.* Cada huésped registra su ingreso individualmente.`,

  noInfo: () =>
    `Esa información no la tengo aquí. Te recomiendo escribirnos directamente al *+52 55 3481 5126* o a *anaxagoras41suite@gmail.com*. 😊`,

  fotos: () =>
    `📸 Aquí puedes ver fotos de las instalaciones y los lofts: https://anaxagoras41suite.arqarri.com/`,
}

// ─── FAQ detector ─────────────────────────────────────────────────────────────

function detectFaq(textLower: string): string | null {
  if (/precio|costo|cuánto|cuanto|tarifa|cobran|valen|rate/.test(textLower)) return 'precios'
  if (/ubica|dónde|donde|direcci|mapa|cómo llegar|como llegar/.test(textLower)) return 'ubicacion'
  if (/servicio|incluye|incluy|wifi|internet|luz|agua|gas|limpieza|lavander/.test(textLower)) return 'servicios'
  if (/estacionamiento|parking|carro|auto|coche/.test(textLower)) return 'estacionamiento'
  if (/roof|terraza|evento|renta.*espacio|event/.test(textLower)) return 'rooftop'
  if (/segur|cámara|camara|acceso|cerradura/.test(textLower)) return 'seguridad'
  if (/foto|imagen|imágenes|imagenes|galer[ií]a|instalac/.test(textLower)) return 'fotos'
  return null
}

function faqResponse(key: string): string {
  switch (key) {
    case 'precios': return `El costo depende de la disponibilidad y las fechas. En cuanto un asesor confirme disponibilidad te comparte el precio exacto. 😊`
    case 'ubicacion': return MSG.ubicacion()
    case 'servicios': return MSG.servicios()
    case 'estacionamiento': return MSG.estacionamiento()
    case 'rooftop': return MSG.rooftop()
    case 'seguridad': return MSG.seguridad()
    case 'fotos': return MSG.fotos()
    default: return MSG.noInfo()
  }
}

function flowReminder(fase: string | null): string {
  if (!fase || fase === 'saludo' || fase === 'nombre' || fase === 'confirmado' || fase === 'esperando_asesor' || fase === 'no_interesado') return ''
  if (fase === 'tipo_renta') return `\n\n${MSG.pedirTipoRenta()}`
  if (fase === 'checkin') return `\n\n${MSG.pedirCheckin()}`
  if (fase === 'checkout') return `\n\n${MSG.pedirCheckout()}`
  if (fase === 'personas') return `\n\n${MSG.pedirPersonas()}`
  if (fase === 'tipo_loft') return `\n\n_Elige el tipo de loft respondiendo *1* o *2*._`
  if (fase === 'confirmar_interes') return `\n\n¿Te interesa el rango de precio? Responde *sí* o *no*.`
  return ''
}

// ─── Webhook verification (GET) ───────────────────────────────────────────────

export async function GET(request: Request) {
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')
  const { verifyToken } = getMetaConfig()

  if (mode === 'subscribe' && token && verifyToken && token === verifyToken) {
    return new Response(challenge || '', { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

// ─── Webhook handler (POST) ───────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null)
    const supabase = createServiceRoleClient()

    // Registrar apertura de ventana ANTES de filtrar por tipo de mensaje —
    // el toque del botón del template de nudge no es tipo "text" y de otro
    // modo se perdería.
    await registrarAperturaVentanaAdmin(supabase, payload)

    const botonManejado = await manejarBotonReactivacion(supabase, payload)
    if (botonManejado) return Response.json({ ok: true, boton_reactivacion: true })

    const incoming = parseIncoming(payload)
    if (!incoming) return Response.json({ ok: true, ignored: true })

    const { from, body, profileName, rawPayload } = incoming
    const text = body.trim()
    const textLower = text.toLowerCase()

    // Números de admin (Alexis, Harold) — solo abren su ventana de 24h para
    // recibir alertas, no son clientes: no se les crea lead ni se les contesta
    // con la info de Anaxágoras, salvo que hayan activado el modo prueba
    // ("test" / "salir") para probar el flujo real del bot en su propio número.
    if (ADMIN_WHATSAPP_NUMBERS_NORMALIZED.has(from)) {
      if (textLower === 'test') {
        await supabase.from('admin_test_mode').upsert([{ whatsapp: from, activated_at: new Date().toISOString() }])
        await sendMetaWhatsAppMessage({
          to: from,
          body: '🧪 Modo prueba activado. A partir de ahora te voy a tratar como cliente para que pruebes el flujo real. Escribe "salir" para volver a modo admin (o se apaga solo en 30 min).',
        })
        return Response.json({ ok: true, admin: true, test_mode: 'activado' })
      }

      if (textLower === 'salir') {
        await supabase.from('admin_test_mode').delete().eq('whatsapp', from)
        await sendMetaWhatsAppMessage({ to: from, body: '👋 Modo prueba desactivado. Volviste a modo admin.' })
        return Response.json({ ok: true, admin: true, test_mode: 'desactivado' })
      }

      const { data: testMode } = await supabase
        .from('admin_test_mode')
        .select('activated_at')
        .eq('whatsapp', from)
        .maybeSingle()

      const activatedAt = testMode?.activated_at ? new Date(testMode.activated_at as string).getTime() : null
      const testModeVigente = activatedAt !== null && Date.now() - activatedAt < ADMIN_TEST_MODE_MINUTES * 60 * 1000

      if (!testModeVigente) {
        return Response.json({ ok: true, admin: true })
      }
      // Modo prueba activo: sigue de largo y se procesa como un lead normal.
    }

    // ── Buscar conversación abierta ──────────────────────────────────────────
    const { data: conv } = await supabase
      .from('whatsapp_conversaciones')
      .select('id, fase, lead_id, modo_humano')
      .eq('whatsapp', from)
      .eq('estado', 'abierta')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Si está en modo humano, solo loguear (el bot no responde, así que el push es la única alerta)
    if (conv?.modo_humano) {
      await supabase.from('whatsapp_mensajes').insert([{
        conversacion_id: conv.id,
        rol: 'usuario',
        contenido: text,
        raw_payload: rawPayload,
      }])
      try {
        await enviarPushATodos({
          title: `💬 ${profileName || from}`,
          body: text.length > 120 ? `${text.slice(0, 117)}...` : text,
        })
      } catch (e) {
        console.error('[webhook] error enviando push (modo humano):', e)
      }
      return Response.json({ ok: true, human_mode: true })
    }

    const fase = conv?.fase || null
    let convId = conv?.id as string | undefined
    let leadId = conv?.lead_id as string | undefined

    // Si la conv existe pero no tiene lead_id, recuperar o crear el lead
    if (conv && !leadId) {
      const { data: existingLead } = await supabase
        .from('leads').select('id').eq('whatsapp', from).maybeSingle()
      if (existingLead?.id) {
        leadId = existingLead.id
      } else {
        const adminId = await getAdminId(supabase)
        const { data: newLead } = await supabase
          .from('leads')
          .insert([{
            nombre: profileName || 'Prospecto WhatsApp',
            whatsapp: from,
            stage: 'nuevo_contacto',
            notas: `Lead desde WhatsApp${profileName ? '. Nombre WA: ' + profileName : ''}.`,
            ...(adminId ? { asignado_a: adminId } : {}),
          }])
          .select('id')
          .maybeSingle()
        leadId = newLead?.id
        if (leadId) await alertarNuevoLead(profileName, from, text)
      }
      if (leadId) {
        await supabase.from('whatsapp_conversaciones')
          .update({ lead_id: leadId }).eq('id', convId!)
      }
    }

    // ── Si no hay conversación, crear lead + conversación ───────────────────
    if (!conv) {
      const adminId = await getAdminId(supabase)

      // Buscar lead existente por whatsapp
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id')
        .eq('whatsapp', from)
        .maybeSingle()

      if (existingLead?.id) {
        leadId = existingLead.id
      } else {
        // Insertar nuevo lead
        const { data: newLead, error: leadError } = await supabase
          .from('leads')
          .insert([{
            nombre: profileName || 'Prospecto WhatsApp',
            whatsapp: from,
            stage: 'nuevo_contacto',
            notas: `Lead desde WhatsApp${profileName ? '. Nombre WA: ' + profileName : ''}.`,
            ...(adminId ? { asignado_a: adminId } : {}),
          }])
          .select('id')
          .maybeSingle()
        if (leadError) console.error('[webhook] lead insert error:', leadError)
        leadId = newLead?.id
        if (leadId) await alertarNuevoLead(profileName, from, text)
      }

      // Registrar actividad
      if (leadId) {
        await supabase.from('lead_activities').insert([{
          lead_id: leadId,
          actor_id: null,
          event_type: 'primer_contacto',
          title: 'Primer contacto WhatsApp',
          detail: `Mensaje: "${text}"`,
          meta: { source: 'whatsapp' },
        }])
      }

      // Crear conversación
      const { data: newConv, error: convError } = await supabase
        .from('whatsapp_conversaciones')
        .insert([{
          whatsapp: from,
          lead_id: leadId,
          estado: 'abierta',
          fase: 'saludo',
        }])
        .select('id')
        .maybeSingle()

      if (convError) console.error('[webhook] conv insert error:', convError)
      convId = newConv?.id
    }

    // Loguear mensaje del usuario
    if (convId) {
      await supabase.from('whatsapp_mensajes').insert([{
        conversacion_id: convId,
        rol: 'usuario',
        contenido: text,
        raw_payload: rawPayload,
      }])
    }

    // Notificación push (app instalada en el teléfono) — un fallo aquí no debe romper la respuesta del bot.
    // Se espera (await) porque en serverless el proceso puede cortarse justo al responder,
    // dejando el envío a medias si se dispara sin esperar.
    try {
      await enviarPushATodos({
        title: `💬 ${profileName || from}`,
        body: text.length > 120 ? `${text.slice(0, 117)}...` : text,
      })
    } catch (e) {
      console.error('[webhook] error enviando push:', e)
    }

    // ── State machine ────────────────────────────────────────────────────────
    let response = ''
    let nextFase = fase

    // Comando global: reiniciar en cualquier fase
    if (textLower === 'reiniciar') {
      response = MSG.bienvenida()
      nextFase = 'nombre'

    // FAQ: responde preguntas sin romper el flujo de reserva
    } else if (fase && fase !== 'nombre' && detectFaq(textLower)) {
      response = faqResponse(detectFaq(textLower)!) + flowReminder(fase)
      nextFase = fase

    // Despedida/pausa: no insistir con el menú del flujo
    } else if (fase && fase !== 'nombre' && esDespedida(textLower)) {
      response = `¡Con gusto! Aquí estamos cuando quieras retomar. 😊`
      nextFase = fase

    } else if (!fase || fase === 'saludo') {
      const nombreDetectado = extraerNombreDeAnuncio(text)
      if (nombreDetectado) {
        if (leadId) await supabase.from('leads').update({ nombre: nombreDetectado }).eq('id', leadId)
        response = `Mucho gusto, *${nombreDetectado}*! 😊\n\n` + MSG.pedirCheckin()
        nextFase = 'checkin'
      } else {
        response = MSG.bienvenida()
        nextFase = 'nombre'
      }

    } else if (fase === 'nombre') {
      const nombre = text.trim()
      if (!esNombreValido(nombre)) {
        response = `Ese no me parece un nombre 😅 ¿Me compartes tu nombre completo?`
        nextFase = 'nombre'
      } else {
        if (leadId) await supabase.from('leads').update({ nombre }).eq('id', leadId)
        response = `Mucho gusto, *${nombre}*! 😊\n\n` + MSG.pedirCheckin()
        nextFase = 'checkin'
      }

    // Fase "tipo_renta" — solo la usan conversaciones que ya venían de antes de
    // este cambio de flujo (2026-07-15). Conversaciones nuevas ya no pasan por aquí.
    } else if (fase === 'tipo_renta') {
      let tipo: string | null = null
      if (textLower.includes('noche') || text === '1') tipo = 'noche'
      else if (textLower.includes('mes') || text === '2') tipo = 'mes'

      if (!tipo) {
        response = MSG.errorTipoRenta()
        nextFase = 'tipo_renta'
      } else {
        if (leadId) await supabase.from('leads').update({ tipo_renta: tipo }).eq('id', leadId)
        response = `Renta *por ${tipo}* ✅\n\n` + MSG.pedirCheckin()
        nextFase = 'checkin'
      }

    } else if (fase === 'checkin') {
      const fecha = parseDate(text)
      if (!fecha) {
        response = MSG.errorFecha()
        nextFase = 'checkin'
      } else if (esFechaAnteriorAHoy(fecha)) {
        response = MSG.errorFechaPasada()
        nextFase = 'checkin'
      } else {
        if (leadId) await supabase.from('leads').update({ fecha_checkin: fecha }).eq('id', leadId)
        response = `Llegada: *${text}* ✅\n\n` + MSG.pedirCheckout()
        nextFase = 'checkout'
      }

    } else if (fase === 'checkout') {
      const fecha = parseDate(text)
      if (!fecha) {
        response = MSG.errorFecha()
        nextFase = 'checkout'
      } else {
        const { data: leadCheckin } = leadId
          ? await supabase.from('leads').select('fecha_checkin').eq('id', leadId).maybeSingle()
          : { data: null }
        if (leadCheckin?.fecha_checkin && fecha <= leadCheckin.fecha_checkin) {
          response = MSG.errorFechaCheckoutInvalida()
          nextFase = 'checkout'
        } else {
          if (leadId) await supabase.from('leads').update({ fecha_checkout: fecha }).eq('id', leadId)
          response = `Salida: *${text}* ✅\n\n` + MSG.pedirPersonas()
          nextFase = 'personas'
        }
      }

    } else if (fase === 'personas') {
      const num = parseInt(text, 10)
      if (isNaN(num) || num < 1 || num > 30) {
        response = MSG.errorPersonas()
        nextFase = 'personas'
      } else {
        const { data: lead } = leadId
          ? await supabase.from('leads').select('nombre, fecha_checkin, fecha_checkout').eq('id', leadId).maybeSingle()
          : { data: null }
        const checkin = lead?.fecha_checkin || ''
        const checkout = lead?.fecha_checkout || ''
        const nombreLead = lead?.nombre || profileName || 'amigo/a'
        const tipoRenta = inferirTipoRenta(checkin, checkout)
        const noches = calcularNoches(checkin, checkout)

        if (leadId) {
          await supabase.from('leads').update({ num_personas: num, tipo_renta: tipoRenta, stage: 'cotizado' }).eq('id', leadId)
        }

        const rango = calcularRangoPrecio(tipoRenta, num, noches)

        if (!rango) {
          // Excepción real, no una limitación nuestra: el catálogo actual no
          // tiene ningún loft para más de 2 personas (Grande = hasta 2), así
          // que no hay rango que calcular. Se mantiene el comportamiento
          // anterior — avisar al asesor de inmediato, sin pasar por el filtro
          // de confirmación de precio (no aplica: no hay precio que confirmar).
          response =
            `¡Perfecto, *${nombreLead}*! 🙌 Ya tengo tus datos:\n\n` +
            `📅 *Llegada:* ${formatFecha(checkin)}\n` +
            `📅 *Salida:* ${formatFecha(checkout)}\n` +
            `👥 *Personas:* ${num}\n\n` +
            `Un asesor verificará la disponibilidad y se pondrá en contacto contigo en breve. 😊`
          nextFase = 'esperando_asesor'
          await alertarAdmin(
            `🆕 *Lead listo — verificar disponibilidad*\n\n` +
            `👤 *Nombre:* ${nombreLead}\n` +
            `📱 *WhatsApp:* ${from}\n` +
            `📅 *Llegada:* ${formatFecha(checkin)}\n` +
            `📅 *Salida:* ${formatFecha(checkout)}\n` +
            `👥 *Personas:* ${num}\n\n` +
            `Contactar para confirmar disponibilidad y cerrar.`
          )
        } else {
          response = MSG.rangoPrecio(nombreLead, tipoRenta, rango)
          nextFase = 'confirmar_interes'
        }
      }

    } else if (fase === 'confirmar_interes') {
      if (esRespuestaAfirmativa(textLower)) {
        const { data: lead } = leadId
          ? await supabase.from('leads').select('nombre, fecha_checkin, fecha_checkout, num_personas').eq('id', leadId).maybeSingle()
          : { data: null }
        const nombreLead = lead?.nombre || profileName || 'amigo/a'
        response =
          `¡Perfecto, *${nombreLead}*! 🙌 Ya tengo tus datos:\n\n` +
          `📅 *Llegada:* ${formatFecha(lead?.fecha_checkin || '')}\n` +
          `📅 *Salida:* ${formatFecha(lead?.fecha_checkout || '')}\n` +
          `👥 *Personas:* ${lead?.num_personas ?? '-'}\n\n` +
          `Un asesor verificará la disponibilidad y se pondrá en contacto contigo en breve. 😊`
        nextFase = 'esperando_asesor'
        await alertarAdmin(
          `🆕 *Lead listo — verificar disponibilidad*\n\n` +
          `👤 *Nombre:* ${nombreLead}\n` +
          `📱 *WhatsApp:* ${from}\n` +
          `📅 *Llegada:* ${formatFecha(lead?.fecha_checkin || '')}\n` +
          `📅 *Salida:* ${formatFecha(lead?.fecha_checkout || '')}\n` +
          `👥 *Personas:* ${lead?.num_personas ?? '-'}\n\n` +
          `Confirmó que el rango de precio le interesa. Contactar para confirmar disponibilidad y cerrar.`
        )
      } else if (esRespuestaNegativa(textLower)) {
        // Filtro pedido por el negocio: si el rango no le funciona, se marca
        // como no_interesado y NO se alerta al asesor — el objetivo es que el
        // asesor solo reciba leads que ya confirmaron que el precio les sirve.
        if (leadId) await supabase.from('leads').update({ stage: 'no_interesado' }).eq('id', leadId)
        response = MSG.cierreNoInteresado()
        nextFase = 'no_interesado'
      } else {
        response = MSG.errorConfirmarInteres()
        nextFase = 'confirmar_interes'
      }

    } else if (fase === 'no_interesado') {
      // Fase terminal (mismo patrón que 'esperando_asesor'): si el lead vuelve
      // a escribir después de descartarse por precio, no rompe el flujo.
      response = `Gracias por tu tiempo 🙏 Si en otro momento buscas algo dentro de este rango, aquí estamos para ayudarte.`
      nextFase = 'no_interesado'

    } else if (fase === 'tipo_loft') {
      const { data: lead } = leadId
        ? await supabase.from('leads').select('nombre, tipo_renta, fecha_checkin, fecha_checkout, num_personas').eq('id', leadId).maybeSingle()
        : { data: null }
      const tipoRenta = lead?.tipo_renta || 'noche'
      const personas = lead?.num_personas || 1
      const loft = parseLoft(text, tipoRenta, personas)

      if (!loft) {
        response = MSG.errorTipoLoft()
        nextFase = 'tipo_loft'
      } else if (loft === 'consultar') {
        response = `Perfecto, un asesor te contactará para darte las opciones disponibles. 😊\n\nSi tienes dudas también puedes llamarnos al *+52 55 3481 5126*.`
        nextFase = 'confirmado'
        // Alerta: lead pide hablar con asesor
        await alertarAdmin(
          `💬 *Lead pide hablar con asesor*\n\n` +
          `👤 *Nombre:* ${lead?.nombre || profileName || 'Sin nombre'}\n` +
          `📱 *WhatsApp:* ${from}\n` +
          `🏷 *Renta:* ${tipoRenta === 'noche' ? 'Por noche' : 'Por mes'}\n` +
          `👥 *Personas:* ${personas}\n\n` +
          `Quiere ver opciones distintas. Contactar para cerrar.`
        )
      } else {
        if (leadId) {
          await supabase.from('leads').update({ stage: 'cotizado' }).eq('id', leadId)
        }
        response = MSG.confirmado(
          tipoRenta,
          loft,
          lead?.fecha_checkin || '',
          lead?.fecha_checkout || '',
          personas,
          lead?.nombre || profileName || 'amigo'
        )
        nextFase = 'confirmado'
      }

    } else if (fase === 'confirmado') {
      response = MSG.asesorActivo()
      nextFase = 'confirmado'
      // Alerta: lead confirmó reserva (solo la primera vez — cuando stage sigue en 'cotizado')
      if (leadId) {
        const { data: leadActual } = await supabase.from('leads').select('stage, nombre, tipo_renta, fecha_checkin, fecha_checkout, num_personas, loft_asignado').eq('id', leadId).maybeSingle()
        if (leadActual?.stage === 'cotizado') {
          await supabase.from('leads').update({ stage: 'deposito_pendiente' }).eq('id', leadId)
          await alertarAdmin(
            `🏠 *Nueva reserva confirmada*\n\n` +
            `👤 *Nombre:* ${leadActual.nombre || profileName || 'Sin nombre'}\n` +
            `📱 *WhatsApp:* ${from}\n` +
            `🏷 *Renta:* ${leadActual.tipo_renta === 'noche' ? 'Por noche' : 'Por mes'}\n` +
            `📅 *Checkin:* ${formatFecha(leadActual.fecha_checkin || '')}\n` +
            `📅 *Checkout:* ${formatFecha(leadActual.fecha_checkout || '')}\n` +
            `👥 *Personas:* ${leadActual.num_personas || '-'}\n` +
            `🛏 *Loft:* ${leadActual.loft_asignado || 'pendiente'}\n\n` +
            `El lead confirmó interés. Contactar para coordinar depósito.`
          )
        }
      }

    } else if (fase === 'esperando_asesor') {
      response = `Ya tengo tus datos ✅ Un asesor te contactará en breve para confirmar disponibilidad. Si tienes alguna otra duda mientras tanto, con gusto te ayudo. 😊`
      nextFase = 'esperando_asesor'

    } else {
      // Fase desconocida — reiniciar
      response = MSG.saludo(profileName)
      nextFase = 'tipo_renta'
    }

    // ── Actualizar conversación ──────────────────────────────────────────────
    console.log('[webhook] fase:', fase, '→', nextFase, 'convId:', convId, 'from:', from)
    if (convId) {
      const { error: updateError } = await supabase.from('whatsapp_conversaciones').update({
        fase: nextFase,
        ultimo_mensaje_at: new Date().toISOString(),
        seguimiento_enviado: false,
      }).eq('id', convId)
      if (updateError) console.error('[webhook] conv update error:', updateError)

      // Loguear respuesta del bot
      if (response) {
        await supabase.from('whatsapp_mensajes').insert([{
          conversacion_id: convId,
          rol: 'bot',
          contenido: response,
          raw_payload: {},
        }])
      }
    }

    // ── Enviar respuesta ─────────────────────────────────────────────────────
    if (response) {
      await sendMetaWhatsAppMessage({ to: from, body: response })
    }

    return Response.json({ ok: true })
  } catch (error) {
    console.error('[webhook anaxagoras]', error)
    return Response.json({ ok: false, error: String(error) }, { status: 200 })
  }
}
