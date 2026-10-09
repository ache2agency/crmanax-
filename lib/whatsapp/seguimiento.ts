import { createServiceRoleClient } from '@/utils/supabase/server'
import { sendMetaWhatsAppMessage } from '@/lib/whatsapp/provider'
import {
  FASES_SIN_SEGUIMIENTO,
  STAGES_SIN_SEGUIMIENTO,
  SEGUIMIENTO_MIN_HORAS,
  SEGUIMIENTO_MAX_HORAS,
  esHorarioDeSeguimiento,
  debeDescartarPorSinRespuesta,
  STAGES_SIN_RESPUESTA,
  FASES_QUE_ESPERAN_HUMANO,
  HORAS_SIN_RESPUESTA,
} from '@/lib/whatsapp/bot-parsers'

export const MENSAJE_SEGUIMIENTO = '¿Te quedó alguna duda sobre los lofts de Anaxágoras 41? Con gusto te ayudamos. 😊'

type Supabase = ReturnType<typeof createServiceRoleClient>

/**
 * Manda "¿Te quedó alguna duda?" a quien dejó el flujo del bot a medias hace
 * entre 10 y 23 horas (antes de que cierre la ventana de 24h de Meta).
 *
 * Excluye (bug 3-oct-2026: se le mandaba a quien esperaba asesor):
 *  - fases esperando_asesor / confirmado / no_interesado
 *  - conversaciones en modo humano o donde un humano ya intervino
 *    (`humano_intervino`, y por si ese flag no se guardó, cualquier mensaje rol='agente')
 *  - leads ya descartados o que ya lleva un asesor (deposito_pendiente en adelante)
 *
 * Se llama desde el cron diario (/api/whatsapp/reactivacion) y, de forma
 * oportunista, después de cada webhook entrante — así no depende de que el
 * único cron diario caiga justo en la ventana de cada lead.
 * Cada conversación se "reclama" con un update condicional
 * (seguimiento_enviado false → true) ANTES de enviar, para que dos ejecuciones
 * simultáneas nunca manden el mensaje dos veces.
 */
export async function enviarSeguimientos(
  supabase: Supabase,
  opts: { ahora?: Date; limite?: number } = {}
): Promise<number> {
  const ahora = opts.ahora ?? new Date()
  if (!esHorarioDeSeguimiento(ahora)) return 0

  const desde = new Date(ahora.getTime() - SEGUIMIENTO_MAX_HORAS * 3_600_000).toISOString()
  const hasta = new Date(ahora.getTime() - SEGUIMIENTO_MIN_HORAS * 3_600_000).toISOString()

  const { data: convs } = await supabase
    .from('whatsapp_conversaciones')
    .select('id, whatsapp, fase, lead_id')
    .eq('estado', 'abierta')
    .eq('seguimiento_enviado', false)
    .eq('humano_intervino', false)
    .eq('modo_humano', false)
    .not('fase', 'in', `(${FASES_SIN_SEGUIMIENTO.join(',')})`)
    .gte('ultimo_mensaje_at', desde)
    .lte('ultimo_mensaje_at', hasta)
    .limit(opts.limite ?? 50)

  const candidatos = (convs || []) as { id: string; whatsapp: string; fase: string | null; lead_id: string | null }[]
  if (candidatos.length === 0) return 0

  const ids = candidatos.map((c) => c.id)
  const { data: conAgente } = await supabase
    .from('whatsapp_mensajes')
    .select('conversacion_id')
    .in('conversacion_id', ids)
    .eq('rol', 'agente')
  const idsConAgente = new Set((conAgente || []).map((m: { conversacion_id: string }) => m.conversacion_id))

  const leadIds = candidatos.map((c) => c.lead_id).filter(Boolean) as string[]
  const { data: leads } = leadIds.length
    ? await supabase.from('leads').select('id, stage').in('id', leadIds)
    : { data: [] }
  const stagePorLead = new Map((leads || []).map((l: { id: string; stage: string }) => [l.id, l.stage]))

  let enviados = 0
  for (const conv of candidatos) {
    if (idsConAgente.has(conv.id)) continue
    const stage = conv.lead_id ? stagePorLead.get(conv.lead_id) : null
    if (stage && STAGES_SIN_SEGUIMIENTO.includes(stage)) continue

    const { data: reclamada } = await supabase
      .from('whatsapp_conversaciones')
      .update({ seguimiento_enviado: true })
      .eq('id', conv.id)
      .eq('seguimiento_enviado', false)
      .select('id')
    if (!reclamada || reclamada.length === 0) continue // otra ejecución ya lo tomó

    try {
      await sendMetaWhatsAppMessage({ to: conv.whatsapp, body: MENSAJE_SEGUIMIENTO })
      await supabase.from('whatsapp_mensajes').insert([{
        conversacion_id: conv.id,
        rol: 'bot',
        contenido: MENSAJE_SEGUIMIENTO,
        raw_payload: { tipo: 'seguimiento_automatico' },
      }])
      enviados++
    } catch (e) {
      // Se queda marcado como enviado a propósito: reintentar cada pocos
      // minutos contra Meta (p. ej. ventana de 24h ya cerrada) solo ensucia.
      console.error('[seguimiento] envío falló:', conv.whatsapp, e)
    }
  }

  return enviados
}

/**
 * Pasa a no_interesado a los leads de nuevo_contacto/cotizado que llevan 48 h
 * sin contestar después de nuestro último mensaje (bot o asesor). La
 * conversación se queda abierta: si el lead vuelve a escribir, el webhook lo
 * regresa a su columna. Los que esperan a un asesor (esperando_asesor/
 * confirmado) no se tocan: ahí falta que alguien los atienda.
 */
export async function descartarLeadsSinRespuesta(
  supabase: Supabase,
  opts: { ahora?: Date; limite?: number } = {}
): Promise<number> {
  const ahora = opts.ahora ?? new Date()
  const corte = new Date(ahora.getTime() - HORAS_SIN_RESPUESTA * 3_600_000).toISOString()

  const { data: convs } = await supabase
    .from('whatsapp_conversaciones')
    .select('id, lead_id, fase, modo_humano, ultimo_mensaje_at')
    .eq('estado', 'abierta')
    .eq('modo_humano', false)
    .not('lead_id', 'is', null)
    .not('fase', 'in', `(${FASES_QUE_ESPERAN_HUMANO.join(',')})`)
    .lte('ultimo_mensaje_at', corte)
    .order('ultimo_mensaje_at', { ascending: false })
    .limit(500)

  const candidatos = (convs || []) as { id: string; lead_id: string; fase: string | null; modo_humano: boolean; ultimo_mensaje_at: string }[]
  if (candidatos.length === 0) return 0

  const stagePorLead = new Map<string, string>()
  const leadIds = candidatos.map((c) => c.lead_id)
  for (let i = 0; i < leadIds.length; i += 100) {
    const { data: leads } = await supabase
      .from('leads')
      .select('id, stage')
      .in('id', leadIds.slice(i, i + 100))
      .in('stage', STAGES_SIN_RESPUESTA)
    for (const l of (leads || []) as { id: string; stage: string }[]) stagePorLead.set(l.id, l.stage)
  }

  let marcados = 0
  for (const conv of candidatos) {
    if (marcados >= (opts.limite ?? 100)) break
    const stage = stagePorLead.get(conv.lead_id)
    if (!stage) continue
    // Último mensaje real de la conversación (ultimo_mensaje_at no siempre
    // cambia con los mensajes del bot o del asesor).
    const { data: ultimo } = await supabase
      .from('whatsapp_mensajes')
      .select('rol, created_at')
      .eq('conversacion_id', conv.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!debeDescartarPorSinRespuesta({
      stage,
      fase: conv.fase,
      modoHumano: conv.modo_humano,
      ultimoRol: ultimo?.rol,
      ultimoMensajeAt: ultimo?.created_at ?? conv.ultimo_mensaje_at,
      ahora,
    })) continue
    const { data: movido } = await supabase
      .from('leads')
      .update({ stage: 'no_interesado' })
      .eq('id', conv.lead_id)
      .eq('stage', stage)
      .select('id')
    if (movido && movido.length > 0) {
      marcados++
      await supabase.from('lead_activities').insert([{
        lead_id: conv.lead_id,
        actor_id: null,
        event_type: 'sin_respuesta_48h',
        title: 'Sin respuesta 48 h → No interesado',
        detail: `Estaba en ${stage}. Si vuelve a escribir regresa solo a su etapa.`,
        meta: { source: 'bot', stage_anterior: stage },
      }])
    }
  }
  return marcados
}

// Throttle por instancia para el barrido oportunista desde el webhook: como
// mucho una consulta cada 10 min por instancia de la función.
const INTERVALO_BARRIDO_MS = 10 * 60 * 1000
let ultimoBarrido = 0

export async function barridoSeguimientosOportunista(supabase: Supabase): Promise<void> {
  const ahora = Date.now()
  if (ahora - ultimoBarrido < INTERVALO_BARRIDO_MS) return
  ultimoBarrido = ahora
  try {
    await enviarSeguimientos(supabase, { limite: 20 })
  } catch (e) {
    console.error('[seguimiento] barrido oportunista falló:', e)
  }
  try {
    await descartarLeadsSinRespuesta(supabase, { limite: 20 })
  } catch (e) {
    console.error('[seguimiento] barrido sin respuesta falló:', e)
  }
}
