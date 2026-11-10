import { NextResponse } from 'next/server'
import { motorPreviewHabilitado, opcionLoft, validarBusqueda } from '@/lib/motor-reservas'
import { ventanaIcal, esColaVentana } from '@/lib/reservas/ical'
import { resumenFrescura, type EstadoFuente } from '@/lib/reservas/conflictos'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }

// GET explícito: no cliente con sesión, RPC, escrituras ni datos de huéspedes.
async function leer<T>(tabla: string, parametros: Record<string, string>): Promise<T[]> {
  const url = new URL(`/rest/v1/${tabla}`, process.env.NEXT_PUBLIC_SUPABASE_URL)
  for (const [k, v] of Object.entries(parametros)) url.searchParams.set(k, v)
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('Entorno no configurado')
  const respuesta = await fetch(url, { method: 'GET', headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store', signal: AbortSignal.timeout(12000) })
  if (!respuesta.ok) throw new Error('Consulta no disponible')
  return respuesta.json()
}

export async function GET(request: Request) {
  if (!motorPreviewHabilitado()) return new NextResponse(null, { status: 404 })
  const params = new URL(request.url).searchParams
  const busqueda = { entrada: params.get('entrada') || '', salida: params.get('salida') || '', personas: Number(params.get('personas')) }
  const { hoy, limite } = ventanaIcal()
  const error = validarBusqueda(busqueda, hoy, limite)
  if (error) return NextResponse.json({ error }, { status: 400, headers })
  try {
    type Loft = { id: string; nombre: string; tipo: string }
    type Bloqueo = { loft_id: string; origen: string; fecha_checkin: string; fecha_checkout: string }
    const [lofts, estados] = await Promise.all([
      leer<Loft>('lofts', { select: 'id,nombre,tipo', activo: 'eq.true', order: 'orden.asc' }),
      leer<EstadoFuente>('reservas_fuentes', { select: 'fuente_key,origen,loft_id,ultimo_exito_at' }),
    ])
    const ocupados = new Set<string>()
    // Checkout exclusivo; paginación evita declarar libre por el límite de 1,000 filas.
    for (let offset = 0; ; offset += 1000) {
      const rows = await leer<Bloqueo>('reservas', { select: 'loft_id,origen,fecha_checkin,fecha_checkout', fecha_checkin: `lt.${busqueda.salida}`, fecha_checkout: `gt.${busqueda.entrada}`, order: 'id.asc', limit: '1000', offset: String(offset) })
      for (const r of rows) if (r.origen !== 'airbnb_ical' || (r.fecha_checkin < limite && !esColaVentana(r.fecha_checkin, r.fecha_checkout))) ocupados.add(r.loft_id)
      if (rows.length < 1000) break
    }
    const frescura = resumenFrescura(estados, lofts.map(l => l.id))
    const opciones = lofts.filter(l => !ocupados.has(l.id)).map(l => opcionLoft(l, busqueda)).filter(Boolean)
    const fechas = estados.map(e => e.ultimo_exito_at).filter((d): d is string => !!d).sort()
    return NextResponse.json({ opciones, datosViejos: frescura.vieja, actualizado: fechas[0] || null, consultado: new Date().toISOString() }, { headers })
  } catch {
    return NextResponse.json({ error: 'No pudimos consultar la disponibilidad. Intenta de nuevo en un momento.' }, { status: 503, headers })
  }
}
