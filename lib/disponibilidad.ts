import { fuenteVieja } from '@/lib/reservas/conflictos'
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
}): Promise<{ disponibles: LoftDisponible[]; ocupados: LoftDisponible[]; datosViejos: boolean }> {
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

  // El bot usa Excel y reservas propias (crm/motor). iCal solo informa al panel.
  const ocupadosIds = new Set((traslapes || []).filter(r => r.origen !== 'airbnb_ical').map(r => r.loft_id).filter(Boolean))

  const cumpleCapacidad = (loft: LoftDisponible) => {
    if (!personas) return true
    const maximo = CAPACIDAD_MAX_POR_TIPO[loft.tipo] ?? 1
    return personas <= maximo
  }

  const todos = (lofts || []) as LoftDisponible[]
  const enRango = todos.filter(cumpleCapacidad)

  let datosViejos = true
  try {
    // No depender del monitor conjunto ni de errores/conflictos de Airbnb.
    const { data: excel, error } = await supabase.from('reservas_fuentes')
      .select('ultimo_exito_at').eq('fuente_key', 'excel').maybeSingle()
    if (!error) datosViejos = fuenteVieja(excel?.ultimo_exito_at)
  } catch { /* Sin frescura verificable del Excel, no afirmar disponibilidad. */ }
  return {
    datosViejos,
    disponibles: enRango.filter((loft) => !ocupadosIds.has(loft.id)),
    ocupados: enRango.filter((loft) => ocupadosIds.has(loft.id)),
  }
}
