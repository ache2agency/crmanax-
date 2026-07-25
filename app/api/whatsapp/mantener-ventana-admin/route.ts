import { createServiceRoleClient } from '@/utils/supabase/server'
import { sendMetaWhatsAppTemplate } from '@/lib/whatsapp/provider'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Template aprobado en Meta — sin variables, trae un botón de respuesta rápida
// que al tocarlo reabre la ventana de 24h del admin (ver registrarAperturaVentanaAdmin
// en app/api/whatsapp/webhook/route.ts). Enviado a revisión de Meta el 2026-07-15.
const ALERT_TEMPLATE_NAME = 'alerta_reactivacion'

const ADMIN_WHATSAPP_NUMBERS = (process.env.ALERT_WHATSAPP_NUMBER || '+525534815126,+527471028306')
  .split(',')
  .map((n) => n.trim())
  .filter(Boolean)

// Se manda el template cuando pasaron 20h desde la última apertura — deja 4h de
// margen antes de que la ventana de 24h se cierre de verdad. Correr este cron
// cada pocas horas (recomendado: cada 4h) para no dejar pasar el umbral.
const HORAS_ANTES_DE_CERRAR = 20

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim() === secret
  return request.headers.get('x-cron-secret') === secret
}

async function handler(request: Request) {
  if (!verifyCronSecret(request)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const limite = new Date(Date.now() - HORAS_ANTES_DE_CERRAR * 60 * 60 * 1000).toISOString()

  const nudgeados: string[] = []
  for (const numero of ADMIN_WHATSAPP_NUMBERS) {
    const { data } = await supabase
      .from('admin_ventana_24h')
      .select('ultima_apertura')
      .eq('whatsapp', numero)
      .maybeSingle()

    const necesitaNudge = !data?.ultima_apertura || (data.ultima_apertura as string) <= limite
    if (!necesitaNudge) continue

    try {
      await sendMetaWhatsAppTemplate({ to: numero, templateName: ALERT_TEMPLATE_NAME })
      nudgeados.push(numero)
    } catch (e) {
      console.error(`[mantener-ventana-admin] template falló (${numero}):`, e)
    }
  }

  return Response.json({ ok: true, nudgeados })
}

export async function GET(request: Request) {
  return handler(request)
}

export async function POST(request: Request) {
  return handler(request)
}
