import { createServiceRoleClient } from '@/utils/supabase/server'

export type LoftDisponible = {
  id: string
  nombre: string
  tipo: string
  orden: number | null
}

// Capacidad máxima por tipo de loft (ningún tipo aloja más de 2 personas hoy;
// grupos mayores los atiende un asesor manualmente, ver calcularRangoPrecio
// en el webhook del bot).
const CAPACIDAD_MAX_POR_TIPO: Record<string, number> = {
  chico: 1,
  mediano: 2,
  grande: 2,
}

// Trae los lofts activos que no tienen ninguna reserva traslapada con el rango
// [checkin, checkout) solicitado, opcionalmente filtrados por capacidad mínima.
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
    .select('loft_id')
    .lt('fecha_checkin', checkout)
    .gt('fecha_checkout', checkin)

  if (reservasErr) throw reservasErr

  const ocupadosIds = new Set((traslapes || []).map((r) => r.loft_id).filter(Boolean))

  const cumpleCapacidad = (loft: LoftDisponible) => {
    if (!personas) return true
    const maximo = CAPACIDAD_MAX_POR_TIPO[loft.tipo] ?? 1
    return personas <= maximo
  }

  const todos = (lofts || []) as LoftDisponible[]
  const enRango = todos.filter(cumpleCapacidad)

  return {
    disponibles: enRango.filter((l) => !ocupadosIds.has(l.id)),
    ocupados: enRango.filter((l) => ocupadosIds.has(l.id)),
  }
}
