import { ventanaIcal } from '@/lib/reservas/ical'
import { NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/utils/supabase/server'

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
    const mes = searchParams.get('mes')

    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      return NextResponse.json({ error: 'mes es obligatorio, formato YYYY-MM' }, { status: 400 })
    }

    const inicioMes = `${mes}-01`
    const [year, month] = mes.split('-').map(Number)
    const finMes = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)

    const service = createServiceRoleClient()
    const [{ data: lofts, error: loftsErr }, { data: reservas, error: reservasErr }, { data: syncs, error: syncErr }, { data: icalSyncs, error: icalSyncErr }] =
      await Promise.all([
        service.from('lofts').select('id, nombre, tipo, orden').eq('activo', true).order('orden', { ascending: true }),
        service
          .from('reservas')
          .select('id, origen, canal, nombre_huesped, telefono, loft_id, tipo_renta, fecha_checkin, fecha_checkout, num_adultos, notas')
          .lt('fecha_checkin', finMes)
          .gt('fecha_checkout', inicioMes)
          .order('fecha_checkin', { ascending: true }),
        service
          .from('reservas_sync')
          .select('id, started_at, finished_at, status, rows_count, error, origen, avisos')
          .eq('origen', 'excel')
          .order('started_at', { ascending: false })
          .limit(1),
        service.from('reservas_sync').select('id, started_at, finished_at, status, rows_count, error, origen, avisos')
          .eq('origen', 'airbnb_ical').order('started_at', { ascending: false }).limit(1),
      ])

    if (loftsErr) throw loftsErr
    if (reservasErr) throw reservasErr
    if (syncErr) throw syncErr
    if (icalSyncErr) throw icalSyncErr

    const { limite } = ventanaIcal()
    const visibles = (reservas || []).filter(r => r.origen !== 'airbnb_ical' || r.fecha_checkin < limite).map(r => r.origen === 'airbnb_ical' ? {
      ...r, fecha_checkout: r.fecha_checkout > limite ? limite : r.fecha_checkout,
      nombre_huesped: 'Bloqueado en Airbnb (sin detalle)', telefono: null, notas: null,
    } : r)
    return NextResponse.json({ lofts, reservas: visibles, lastSync: syncs?.[0] || null, lastIcalSync: icalSyncs?.[0] || null })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
