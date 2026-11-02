import { ventanaIcal } from './ical'

export type TipoConflicto = 'doble_reserva_riesgo' | 'traslape_excel' | 'solo_airbnb'
export type Conflicto = { loft_id: string; tipo: TipoConflicto; fecha_inicio: string; fecha_fin: string; detalle: string }
export type ReservaComparada = { loft_id: string; origen: string; fecha_checkin: string; fecha_checkout: string }
export const ACCION_CONFLICTO: Record<TipoConflicto, string> = {
  doble_reserva_riesgo: 'Bloquear en Airbnb',
  traslape_excel: 'Revisar Excel: dos reservas encimadas',
  solo_airbnb: 'Verificar preparación o registrar reserva en Excel',
}

// Solo evaluar lofts cuyo feed se guardó correctamente EN ESTE sync.
export function detectarConflictos(reservas: ReservaComparada[], loftsOk: string[], now = new Date()): Conflicto[] {
  const { hoy, limite } = ventanaIcal(now)
  const result: Conflicto[] = []
  for (const loft_id of new Set(loftsOk)) {
    const rows = reservas.filter(r => r.loft_id === loft_id && r.fecha_checkin < limite && r.fecha_checkout > hoy)
    const edges = Array.from(new Set([hoy, limite, ...rows.flatMap(r => [r.fecha_checkin < hoy ? hoy : r.fecha_checkin, r.fecha_checkout > limite ? limite : r.fecha_checkout])])).sort()
    for (const tipo of Object.keys(ACCION_CONFLICTO) as TipoConflicto[]) {
      let last: Conflicto | undefined
      for (let i = 0; i < edges.length - 1; i++) {
        const start = edges[i], end = edges[i + 1]
        const active = rows.filter(r => r.fecha_checkin <= start && r.fecha_checkout > start)
        const excel = active.filter(r => r.origen === 'excel').length
        const airbnb = active.some(r => r.origen === 'airbnb_ical')
        const matches = tipo === 'doble_reserva_riesgo' ? excel > 0 && !airbnb : tipo === 'traslape_excel' ? excel > 1 : airbnb && excel === 0
        if (!matches) { last = undefined; continue }
        if (last?.fecha_fin === start) last.fecha_fin = end
        else { last = { loft_id, tipo, fecha_inicio: start, fecha_fin: end, detalle: ACCION_CONFLICTO[tipo] }; result.push(last) }
      }
    }
  }
  return result.sort((a, b) => Number(a.tipo === 'solo_airbnb') - Number(b.tipo === 'solo_airbnb') || a.loft_id.localeCompare(b.loft_id) || a.fecha_inicio.localeCompare(b.fecha_inicio))
}

export type EstadoFuente = { fuente_key: string; origen: string; loft_id: string | null; ultimo_exito_at: string | null; ultimo_intento_ok?: boolean; ultimo_intento_at?: string | null }
export function fuenteVieja(exito: string | null | undefined, now = new Date()) {
  const time = exito ? Date.parse(exito) : NaN
  return !Number.isFinite(time) || now.getTime() - time > 2 * 60 * 60 * 1000
}
export function resumenFrescura(estados: EstadoFuente[], loftIds: string[], now = new Date()) {
  const excel = estados.find(s => s.fuente_key === 'excel')
  const feeds = loftIds.map(id => estados.find(s => s.origen === 'airbnb_ical' && s.loft_id === id))
  return { vieja: fuenteVieja(excel?.ultimo_exito_at, now) || feeds.some(s => fuenteVieja(s?.ultimo_exito_at, now)), excel, feeds }
}
