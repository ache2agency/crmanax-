import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { syncReservasDesdeDropbox } from '@/lib/reservas/sync'

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

    const result = await syncReservasDesdeDropbox()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
