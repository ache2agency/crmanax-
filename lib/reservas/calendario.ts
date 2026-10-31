export type CeldaReserva = { origen: string; fecha_checkin: string; fecha_checkout: string }

export function ocupacionesEnDia<T extends CeldaReserva>(reservas: T[], dia: string): T[] {
  const ocupaciones = reservas.filter(r => r.fecha_checkin <= dia && r.fecha_checkout > dia)
  const excel = ocupaciones.filter(r => r.origen !== 'airbnb_ical')
  // Un bloqueo iCal nunca tapa al Excel ni duplica su ocupación en el panel.
  return excel.length ? excel : ocupaciones.slice(0, 1)
}
