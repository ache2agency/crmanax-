import { createServiceRoleClient } from '@/utils/supabase/server'
import { sendMetaWhatsAppMessage } from '@/lib/whatsapp/provider'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ADMIN_WHATSAPP = process.env.ALERT_WHATSAPP_NUMBER || '+525534815126'
const MENSAJE_SEGUIMIENTO = '¿Te quedó alguna duda sobre los lofts de Anaxágoras 41? Con gusto te ayudamos. 😊'

const FASE_LEGIBLE: Record<string, string> = {
  saludo: 'apenas saludó',
  nombre: 'dando su nombre',
  tipo_renta: 'eligiendo tipo de renta',
  checkin: 'dando fecha de llegada',
  checkout: 'dando fecha de salida',
  personas: 'dando número de personas',
  tipo_loft: 'eligiendo loft',
  confirmado: 'ya confirmó su interés',
}

type LeadRow = {
  id: string
  nombre: string | null
  whatsapp: string
  tipo_renta: string | null
  fecha_checkin: string | null
  fecha_checkout: string | null
  num_personas: number | null
}

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim() === secret
  return request.headers.get('x-cron-secret') === secret
}

function resumenAvance(lead: LeadRow, fase: string | null): string {
  const partes: string[] = []
  if (lead.nombre && lead.nombre !== 'Prospecto WhatsApp') partes.push('nombre')
  if (lead.tipo_renta) partes.push('tipo de renta')
  if (lead.fecha_checkin) partes.push('fecha de llegada')
  if (lead.fecha_checkout) partes.push('fecha de salida')
  if (lead.num_personas) partes.push('número de personas')
  const datos = partes.length ? `Ya dio: ${partes.join(', ')}.` : 'Solo escribió, no ha dado más información todavía.'
  const status = fase && FASE_LEGIBLE[fase] ? FASE_LEGIBLE[fase] : 'en proceso'
  return `${datos}\nFase: ${status}.`
}

// ─── Parte 1: resumen a Alexis 15 min después de un lead nuevo ────────────────
async function alertarNuevosLeads(supabase: ReturnType<typeof createServiceRoleClient>): Promise<number> {
  const limite = new Date(Date.now() - 15 * 60 * 1000).toISOString()

  const { data: leads } = await supabase
    .from('leads')
    .select('id, nombre, whatsapp, tipo_renta, fecha_checkin, fecha_checkout, num_personas')
    .eq('resumen_alertado', false)
    .lte('created_at', limite)
    .limit(50)

  for (const lead of (leads || []) as LeadRow[]) {
    const { data: conv } = await supabase
      .from('whatsapp_conversaciones')
      .select('fase')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const resumen = resumenAvance(lead, conv?.fase || null)
    try {
      await sendMetaWhatsAppMessage({
        to: ADMIN_WHATSAPP,
        body:
          `🆕 *Nuevo lead* (hace 15 min)\n\n` +
          `👤 *Nombre:* ${lead.nombre || 'Sin nombre'}\n` +
          `📱 *WhatsApp:* ${lead.whatsapp}\n\n` +
          resumen,
      })
    } catch (e) {
      console.error('[reactivacion] alerta 15min falló:', e)
    }
    await supabase.from('leads').update({ resumen_alertado: true }).eq('id', lead.id)
  }

  return leads?.length || 0
}

// ─── Parte 2: seguimiento 10-20h a quien dejó la conversación sin contestar ───
async function enviarSeguimientos(supabase: ReturnType<typeof createServiceRoleClient>): Promise<number> {
  const desde = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString()
  const hasta = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString()

  const { data: convs } = await supabase
    .from('whatsapp_conversaciones')
    .select('id, whatsapp, fase')
    .eq('estado', 'abierta')
    .eq('seguimiento_enviado', false)
    .neq('fase', 'confirmado')
    .gte('ultimo_mensaje_at', desde)
    .lte('ultimo_mensaje_at', hasta)
    .limit(50)

  for (const conv of convs || []) {
    try {
      await sendMetaWhatsAppMessage({ to: conv.whatsapp, body: MENSAJE_SEGUIMIENTO })
      await supabase.from('whatsapp_mensajes').insert([{
        conversacion_id: conv.id,
        rol: 'bot',
        contenido: MENSAJE_SEGUIMIENTO,
        raw_payload: { tipo: 'seguimiento_automatico' },
      }])
    } catch (e) {
      console.error('[reactivacion] seguimiento falló:', e)
      continue
    }
    await supabase.from('whatsapp_conversaciones').update({ seguimiento_enviado: true }).eq('id', conv.id)
  }

  return convs?.length || 0
}

async function handler(request: Request) {
  if (!verifyCronSecret(request)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const nuevosLeadsAlertados = await alertarNuevosLeads(supabase)
  const seguimientosEnviados = await enviarSeguimientos(supabase)

  return Response.json({ ok: true, nuevosLeadsAlertados, seguimientosEnviados })
}

export async function GET(request: Request) {
  return handler(request)
}

export async function POST(request: Request) {
  return handler(request)
}
