import { NextResponse } from 'next/server'
import { sendMetaWhatsAppMessage, sendMetaWhatsAppTemplate } from '@/lib/whatsapp/provider'

// Endpoint temporal de diagnóstico — replica exactamente la lógica de alertarAdmin()
// del webhook (texto libre, y si falla, fallback al template alerta_reactivacion),
// pero devolviendo el resultado/error real de cada intento en vez de solo loguearlo.
// Borrar una vez confirmado el diagnóstico del 2026-07-17.

function verifySecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim() === secret
  return request.headers.get('x-cron-secret') === secret
}

const ADMIN_WHATSAPP_NUMBERS = (process.env.ALERT_WHATSAPP_NUMBER || '+525534815126,+527471028306')
  .split(',')
  .map((n) => n.trim())
  .filter(Boolean)

export async function GET(request: Request) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const url = new URL(request.url)
  const forzarTemplate = url.searchParams.get('mode') === 'template'

  const resultados = []
  for (const numero of ADMIN_WHATSAPP_NUMBERS) {
    const resultado: Record<string, unknown> = { numero }

    if (forzarTemplate) {
      try {
        const r2 = await sendMetaWhatsAppTemplate({ to: numero, templateName: 'alerta_reactivacion' })
        resultado.template = { ok: true, id: r2.id }
      } catch (e2) {
        resultado.template = { ok: false, error: e2 instanceof Error ? e2.message : String(e2) }
      }
      resultados.push(resultado)
      continue
    }

    try {
      const r = await sendMetaWhatsAppMessage({
        to: numero,
        body: '🧪 Prueba de diagnóstico — alertas de admin (puedes ignorar este mensaje)',
      })
      resultado.textoLibre = { ok: true, id: r.id }
    } catch (e) {
      resultado.textoLibre = { ok: false, error: e instanceof Error ? e.message : String(e) }
      try {
        const r2 = await sendMetaWhatsAppTemplate({ to: numero, templateName: 'alerta_reactivacion' })
        resultado.template = { ok: true, id: r2.id }
      } catch (e2) {
        resultado.template = { ok: false, error: e2 instanceof Error ? e2.message : String(e2) }
      }
    }
    resultados.push(resultado)
  }

  return NextResponse.json({ resultados })
}
