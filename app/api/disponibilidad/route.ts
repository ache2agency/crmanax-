import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { loftsDisponibles } from '@/lib/disponibilidad'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const checkin = searchParams.get('checkin')
    const checkout = searchParams.get('checkout')
    const personasParam = searchParams.get('personas')

    if (!checkin || !checkout) {
      return NextResponse.json({ error: 'checkin y checkout son obligatorios (YYYY-MM-DD)' }, { status: 400 })
    }

    const personas = personasParam ? Number(personasParam) : undefined
    const resultado = await loftsDisponibles({ checkin, checkout, personas })

    return NextResponse.json(resultado)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
