import { createServiceRoleClient } from '@/utils/supabase/server'
import { enviarSeguimientos, descartarLeadsSinRespuesta } from '@/lib/whatsapp/seguimiento'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim() === secret
  return request.headers.get('x-cron-secret') === secret
}

// Seguimiento 10-23h a quien dejó el flujo sin contestar. La lógica (filtros,
// ventana, horario) vive en lib/whatsapp/seguimiento.ts y la comparte el
// webhook, que también la dispara de forma oportunista.
async function handler(request: Request) {
  if (!verifyCronSecret(request)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const seguimientosEnviados = await enviarSeguimientos(supabase)
  const descartadosSinRespuesta = await descartarLeadsSinRespuesta(supabase)

  return Response.json({ ok: true, seguimientosEnviados, descartadosSinRespuesta })
}

export async function GET(request: Request) {
  return handler(request)
}

export async function POST(request: Request) {
  return handler(request)
}
