import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { syncReservasDesdeDropbox } from '@/lib/reservas/sync'
import { syncReservasAirbnb } from '@/lib/reservas/sync-ical'

export const maxDuration = 300

function hasCronSecret(request: Request) {
  const expected = process.env.CRON_SECRET
  if (!expected) return false

  const headerSecret = request.headers.get('x-cron-secret')
  const auth = request.headers.get('authorization') || ''
  return headerSecret === expected || auth === `Bearer ${expected}`
}

async function hasCrmSession() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return Boolean(user)
}

export async function POST(request: Request) {
  try {
    if (!hasCronSecret(request) && !(await hasCrmSession())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Un fallo de Dropbox no impide actualizar Airbnb (y viceversa).
    let excel = null
    let excelError: string | null = null
    try { excel = await syncReservasDesdeDropbox() } catch { excelError = 'Falló la sincronización del Excel; se conservan sus reservas anteriores' }
    let airbnb = null
    let airbnbError: string | null = null
    try { airbnb = await syncReservasAirbnb() } catch (error) { airbnbError = error instanceof Error ? error.message : 'Falló la sincronización iCal' }
    const ok = !excelError && !airbnbError && !airbnb?.errores.length
    return NextResponse.json({ ok, excel, excelError, airbnb, airbnbError }, { status: ok ? 200 : 207 })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}

// Los crons llaman GET con Authorization: Bearer CRON_SECRET.
export async function GET(request: Request) {
  if (!hasCronSecret(request)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  return POST(request)
}
