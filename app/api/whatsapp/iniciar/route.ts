import { createClient, createServiceRoleClient } from '@/utils/supabase/server'
import { getWhatsAppProvider, sendMetaWhatsAppTemplate } from '@/lib/whatsapp/provider'
import { normalizarTelefonoInicio, textoPlantillaInicio } from '@/lib/whatsapp/iniciar'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const session = await createClient()
    const { data: { user }, error: authError } = await session.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autorizado' }, { status: 401 })
    let body
    try { body = await request.json() } catch {
      return Response.json({ error: 'JSON inválido' }, { status: 400 })
    }
    if (typeof body?.lead_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.lead_id)) {
      return Response.json({ error: 'lead_id inválido' }, { status: 400 })
    }
    // RLS de la sesión: el asesor solo puede iniciar contacto con sus leads.
    const { data: lead, error } = await session.from('leads')
      .select('id, nombre, whatsapp').eq('id', body.lead_id).maybeSingle()
    if (error) return Response.json({ error: 'No se pudo consultar el prospecto' }, { status: 503 })
    if (!lead) return Response.json({ error: 'Prospecto no encontrado o sin acceso' }, { status: 404 })
    const telefono = normalizarTelefonoInicio(lead.whatsapp)
    if (!telefono) return Response.json({ error: 'WhatsApp inválido; revisa el código de país y el número' }, { status: 400 })
    if (getWhatsAppProvider() !== 'meta') {
      return Response.json({ error: 'El primer contacto requiere Meta' }, { status: 400 })
    }
    const db = createServiceRoleClient()
    const nombre = lead.nombre?.trim() || 'ahí'
    const contenido = textoPlantillaInicio(nombre)
    // Reserva persistente ANTES de llamar a Meta. Nunca enviar si falla el RPC.
    const { data: claim, error: claimError } = await db.rpc('reservar_inicio_whatsapp', {
      p_lead_id: lead.id, p_telefono: telefono, p_usuario: user.id,
    })
    if (claimError || !claim) return Response.json({ error: 'No se pudo preparar el contacto. Verifica la migración v14.' }, { status: 503 })
    if (claim.status === 'cooldown') return Response.json({
      error: 'Ya se inició o intentó este contacto hace menos de 24 h. Revisa la conversación antes de reenviar.',
      conversacion_id: claim.conversacion_id,
    }, { status: 409 })
    if (claim.status === 'conflict') return Response.json({ error: 'El número pertenece a otra conversación. Revisa los prospectos duplicados.' }, { status: 409 })
    if (claim.status === 'existing') return Response.json({ ok: true, existente: true, conversacion_id: claim.conversacion_id })
    if (claim.status !== 'claimed') return Response.json({ error: 'No se pudo reservar el contacto' }, { status: 503 })
    let sent
    try {
      sent = await sendMetaWhatsAppTemplate({ to: telefono, templateName: 'seguimiento_solicitud_anax', parameters: [nombre] })
      if (!sent.id) throw new Error('Meta no devolvió identificador')
    } catch {
      // Un timeout puede ocurrir DESPUÉS de que Meta acepte. No liberar ni reintentar.
      return Response.json({ error: 'No se confirmó el envío. Revisa el historial y Meta antes de reintentar; el intento queda protegido durante 24 h.', conversacion_id: claim.conversacion_id }, { status: 502 })
    }
    const { error: finishError } = await db.rpc('confirmar_inicio_whatsapp', {
      p_mensaje_id: claim.mensaje_id, p_contenido: contenido, p_meta_id: sent.id,
    })
    if (finishError) return Response.json({ error: 'Meta aceptó la plantilla, pero falta confirmar el historial. No reenvíes; requiere revisión.', conversacion_id: claim.conversacion_id }, { status: 503 })
    return Response.json({ ok: true, conversacion_id: claim.conversacion_id, contenido })
  } catch {
    return Response.json({ error: 'No se pudo iniciar WhatsApp' }, { status: 503 })
  }
}
