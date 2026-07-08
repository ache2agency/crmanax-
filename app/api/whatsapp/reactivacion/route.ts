import { createServiceRoleClient } from '@/utils/supabase/server'
import { sendMetaWhatsAppMessage } from '@/lib/whatsapp/provider'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MENSAJE_SEGUIMIENTO = '¿Te quedó alguna duda sobre los lofts de Anaxágoras 41? Con gusto te ayudamos. 😊'

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim() === secret
  return request.headers.get('x-cron-secret') === secret
}

// ─── Seguimiento 10-20h a quien dejó la conversación sin contestar ────────────
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
  const seguimientosEnviados = await enviarSeguimientos(supabase)

  return Response.json({ ok: true, seguimientosEnviados })
}

export async function GET(request: Request) {
  return handler(request)
}

export async function POST(request: Request) {
  return handler(request)
}
