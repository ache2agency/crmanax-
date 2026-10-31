import { ventanaIcal } from '@/lib/reservas/ical'
import { createServiceRoleClient } from '@/utils/supabase/server'

export type LoftDisponible = {
  id: string
  nombre: string
  tipo: string
  orden: number | null
}

const CAPACIDAD_MAX_POR_TIPO: Record<string, number> = {
  chico: 1,
  mediano: 2,
  grande: 2,
}

export async function loftsDisponibles({
  checkin,
  checkout,
  personas,
}: {
  checkin: string
  checkout: string
  personas?: number
}): Promise<{ disponibles: LoftDisponible[]; ocupados: LoftDisponible[] }> {
  const supabase = createServiceRoleClient()

  const { data: lofts, error: loftsErr } = await supabase
    .from('lofts')
    .select('id, nombre, tipo, orden')
    .eq('activo', true)
    .order('orden', { ascending: true })

  if (loftsErr) throw loftsErr

  const { data: traslapes, error: reservasErr } = await supabase
    .from('reservas')
    .select('loft_id, origen, fecha_checkin, fecha_checkout')
    .lt('fecha_checkin', checkout)
    .gt('fecha_checkout', checkin)

  if (reservasErr) throw reservasErr

  const { limite } = ventanaIcal()
  // Las filas iCal y Excel se consultan juntas. Incluso un bloqueo antiguo
  // conservado por fallo de red deja de aplicarse fuera del horizonte.
  const ocupadosIds = new Set((traslapes || []).filter(r => r.origen !== 'airbnb_ical' || (r.fecha_checkin < limite && checkin < limite)).map(r => r.loft_id).filter(Boolean))

  const cumpleCapacidad = (loft: LoftDisponible) => {
    if (!personas) return true
    const maximo = CAPACIDAD_MAX_POR_TIPO[loft.tipo] ?? 1
    return personas <= maximo
  }

  const todos = (lofts || []) as LoftDisponible[]
  const enRango = todos.filter(cumpleCapacidad)

  return {
    disponibles: enRango.filter((loft) => !ocupadosIds.has(loft.id)),
    ocupados: enRango.filter((loft) => ocupadosIds.has(loft.id)),
  }
}
