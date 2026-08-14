import { NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/utils/supabase/server'

// GET /api/reservas?mes=YYYY-MM — reservas que se traslapan con ese mes, para pintar la grilla.
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
    const mes = searchParams.get('mes') // YYYY-MM

    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      return NextResponse.json({ error: 'mes es obligatorio, formato YYYY-MM' }, { status: 400 })
    }

    const inicioMes = `${mes}-01`
    const [y, m] = mes.split('-').map(Number)
    const finMes = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10) // día 1 del mes siguiente

    const service = createServiceRoleClient()
    const [{ data: lofts, error: loftsErr }, { data: reservas, error: reservasErr }] = await Promise.all([
      service.from('lofts').select('id, nombre, tipo, orden').eq('activo', true).order('orden', { ascending: true }),
      service
        .from('reservas')
        .select('id, origen, nombre_huesped, telefono, loft_id, tipo_renta, fecha_checkin, fecha_checkout, num_adultos, notas')
        .lt('fecha_checkin', finMes)
        .gt('fecha_checkout', inicioMes)
        .order('fecha_checkin', { ascending: true }),
    ])

    if (loftsErr) throw loftsErr
    if (reservasErr) throw reservasErr

    return NextResponse.json({ lofts, reservas })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}

// POST /api/reservas — captura manual de una reserva desde el CRM.
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const payload = (await request.json()) as {
      origen?: string
      nombre_huesped?: string
      telefono?: string
      email?: string
      loft_id?: string
      tipo_renta?: string
      fecha_checkin?: string
      fecha_checkout?: string
      num_adultos?: number
      monto?: number
      lead_id?: string
      notas?: string
    }

    const requeridos: (keyof typeof payload)[] = [
      'origen',
      'nombre_huesped',
      'loft_id',
      'tipo_renta',
      'fecha_checkin',
      'fecha_checkout',
    ]
    const faltantes = requeridos.filter((k) => !payload[k])
    if (faltantes.length) {
      return NextResponse.json({ error: `Faltan campos obligatorios: ${faltantes.join(', ')}` }, { status: 400 })
    }

    if (payload.fecha_checkout! <= payload.fecha_checkin!) {
      return NextResponse.json({ error: 'fecha_checkout debe ser posterior a fecha_checkin' }, { status: 400 })
    }

    const service = createServiceRoleClient()

    // Traslapes existentes en ese loft — se avisa pero no se bloquea (el negocio
    // ya tiene casos reales de traslape que se resuelven a mano).
    const { data: traslapes } = await service
      .from('reservas')
      .select('id, nombre_huesped, fecha_checkin, fecha_checkout')
      .eq('loft_id', payload.loft_id)
      .lt('fecha_checkin', payload.fecha_checkout)
      .gt('fecha_checkout', payload.fecha_checkin)

    const { data, error } = await service
      .from('reservas')
      .insert([
        {
          origen: payload.origen,
          nombre_huesped: payload.nombre_huesped,
          telefono: payload.telefono || null,
          email: payload.email || null,
          loft_id: payload.loft_id,
          tipo_renta: payload.tipo_renta,
          fecha_checkin: payload.fecha_checkin,
          fecha_checkout: payload.fecha_checkout,
          num_adultos: payload.num_adultos || 1,
          monto: payload.monto || 0,
          lead_id: payload.lead_id || null,
          notas: payload.notas || null,
        },
      ])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ reserva: data, traslapes: traslapes || [] })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
