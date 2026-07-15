import { createServiceRoleClient } from '@/utils/supabase/server'
import {
  getMetaConfig,
  normalizePhoneNumber,
  sendMetaWhatsAppMessage,
} from '@/lib/whatsapp/provider'

const ADMIN_WHATSAPP_NUMBERS = (process.env.ALERT_WHATSAPP_NUMBER || '+525534815126,+527471028306')
  .split(',')
  .map((n) => n.trim())
  .filter(Boolean)

async function alertarAdmin(mensaje: string) {
  for (const numero of ADMIN_WHATSAPP_NUMBERS) {
    try {
      await sendMetaWhatsAppMessage({ to: numero, body: mensaje })
    } catch (e) {
      console.error(`[webhook] alerta admin falló (${numero}):`, e)
    }
  }
}

async function alertarNuevoLead(profileName: string, from: string, primerMensaje: string) {
  await alertarAdmin(
    `🆕 *Nuevo lead*\n\n` +
    `👤 *Nombre:* ${profileName || 'Sin nombre'}\n` +
    `📱 *WhatsApp:* ${from}\n\n` +
    `"${primerMensaje}"`
  )
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

async function parseIncoming(request: Request): Promise<IncomingWhatsAppMessage | null> {
  try {
    const payload = await request.json().catch(() => null)
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

    const messages = Array.isArray(value.messages) ? value.messages : []
    const message = messages[0] as Record<string, unknown> | undefined
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

  errorPersonas: () =>
    `Por favor escribe el número de personas (ej: *2*)`,

  errorTipoLoft: () =>
    `Por favor elige una opción válida (escribe *1* o *2*).`,

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
}

// ─── FAQ detector ─────────────────────────────────────────────────────────────

function detectFaq(textLower: string): string | null {
  if (/precio|costo|cuánto|cuanto|tarifa|cobran|valen|rate/.test(textLower)) return 'precios'
  if (/ubica|dónde|donde|direcci|mapa|cómo llegar|como llegar/.test(textLower)) return 'ubicacion'
  if (/servicio|incluye|incluy|wifi|internet|luz|agua|gas|limpieza|lavander/.test(textLower)) return 'servicios'
  if (/estacionamiento|parking|carro|auto|coche/.test(textLower)) return 'estacionamiento'
  if (/roof|terraza|evento|renta.*espacio|event/.test(textLower)) return 'rooftop'
  if (/segur|cámara|camara|acceso|cerradura/.test(textLower)) return 'seguridad'
  return null
}

function faqResponse(key: string): string {
  switch (key) {
    case 'precios': return MSG.precios()
    case 'ubicacion': return MSG.ubicacion()
    case 'servicios': return MSG.servicios()
    case 'estacionamiento': return MSG.estacionamiento()
    case 'rooftop': return MSG.rooftop()
    case 'seguridad': return MSG.seguridad()
    default: return MSG.noInfo()
  }
}

function flowReminder(fase: string | null): string {
  if (!fase || fase === 'saludo' || fase === 'nombre' || fase === 'confirmado') return ''
  if (fase === 'tipo_renta') return `\n\n${MSG.pedirTipoRenta()}`
  if (fase === 'checkin') return `\n\n${MSG.pedirCheckin()}`
  if (fase === 'checkout') return `\n\n${MSG.pedirCheckout()}`
  if (fase === 'personas') return `\n\n${MSG.pedirPersonas()}`
  if (fase === 'tipo_loft') return `\n\n_Elige el tipo de loft respondiendo *1* o *2*._`
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
    const incoming = await parseIncoming(request)
    if (!incoming) return Response.json({ ok: true, ignored: true })

    const supabase = createServiceRoleClient()
    const { from, body, profileName, rawPayload } = incoming
    const text = body.trim()
    const textLower = text.toLowerCase()

    // ── Buscar conversación abierta ──────────────────────────────────────────
    const { data: conv } = await supabase
      .from('whatsapp_conversaciones')
      .select('id, fase, lead_id, modo_humano')
      .eq('whatsapp', from)
      .eq('estado', 'abierta')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Si está en modo humano, solo loguear
    if (conv?.modo_humano) {
      await supabase.from('whatsapp_mensajes').insert([{
        conversacion_id: conv.id,
        rol: 'usuario',
        contenido: text,
        raw_payload: rawPayload,
      }])
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
        response = MSG.saludo(nombreDetectado)
        nextFase = 'tipo_renta'
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
        response = MSG.saludo(nombre)
        nextFase = 'tipo_renta'
      }

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
        if (leadId) await supabase.from('leads').update({ fecha_checkout: fecha }).eq('id', leadId)
        response = `Salida: *${text}* ✅\n\n` + MSG.pedirPersonas()
        nextFase = 'personas'
      }

    } else if (fase === 'personas') {
      const num = parseInt(text, 10)
      if (isNaN(num) || num < 1 || num > 30) {
        response = MSG.errorPersonas()
        nextFase = 'personas'
      } else {
        if (leadId) {
          await supabase.from('leads').update({ num_personas: num }).eq('id', leadId)
        }
        const { data: lead } = leadId
          ? await supabase.from('leads').select('tipo_renta').eq('id', leadId).maybeSingle()
          : { data: null }
        const tipoRenta = lead?.tipo_renta || 'noche'
        response = opcionesTipoLoft(tipoRenta, num)
        nextFase = 'tipo_loft'
      }

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
