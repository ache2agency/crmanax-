import { createServiceRoleClient } from '@/utils/supabase/server'
import { enviarPushATodos } from '@/lib/push'
import { detectarConflictos, resumenFrescura, type EstadoFuente } from './conflictos'
import { ventanaIcal, esColaVentana } from './ical'

export async function leerMonitorReservas() {
  const db = createServiceRoleClient()
  const { hoy, limite } = ventanaIcal()
  const [{ data: estados, error: e1 }, { data: conflictos, error: e2 }, { data: lofts, error: e3 }] = await Promise.all([
    db.from('reservas_fuentes').select('*'),
    db.from('reservas_conflictos').select('*').is('resuelto_at', null).lt('fecha_inicio', limite).gt('fecha_fin', hoy).order('fecha_inicio'),
    db.from('lofts').select('id, nombre').eq('activo', true),
  ])
  if (e1 || e2 || e3) throw new Error('No se pudo consultar el monitor de disponibilidad (revisar SQL v13)')
  return { estados: (estados || []) as EstadoFuente[], conflictos: conflictos || [], lofts: lofts || [], frescura: resumenFrescura(estados || [], (lofts || []).map(l => l.id)) }
}

export async function actualizarMonitorReservas(sync?: { excelOk: boolean; loftsOk: string[] }) {
  const db = createServiceRoleClient()
  const { hoy, limite } = ventanaIcal()
  const { data: lofts, error: loftError } = await db.from('lofts').select('id, nombre').eq('activo', true)
  if (loftError) throw new Error('No se pudieron leer lofts para el monitor')
  const estados = sync ? [
    { fuente_key: 'excel', origen: 'excel', loft_id: null, ok: sync.excelOk },
    ...(lofts || []).map(l => ({ fuente_key: `airbnb_ical:${l.id}`, origen: 'airbnb_ical', loft_id: l.id, ok: sync.loftsOk.includes(l.id) })),
  ] : []
  const evaluados = sync?.excelOk ? sync.loftsOk : []
  let conflictos: ReturnType<typeof detectarConflictos> = []
  if (evaluados.length) {
    // Paginar: Supabase limita a 1,000 filas por respuesta.
    const reservas = []
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from('reservas').select('id, loft_id, origen, fecha_checkin, fecha_checkout').in('origen', ['excel', 'airbnb_ical']).lt('fecha_checkin', limite).gt('fecha_checkout', hoy).order('id').range(offset, offset + 999)
      if (error) throw new Error('No se pudieron leer reservas para detectar conflictos')
      reservas.push(...(data || []))
      if ((data || []).length < 1000) break
    }
    conflictos = detectarConflictos(reservas.filter(r => r.origen !== 'airbnb_ical' || !esColaVentana(r.fecha_checkin, r.fecha_checkout)), evaluados)
  }
  const { error } = await db.rpc('actualizar_monitor_reservas', { p_estados: estados, p_conflictos: conflictos, p_lofts_evaluados: evaluados, p_now: new Date().toISOString() })
  if (error) throw new Error('No se pudo guardar el monitor de disponibilidad (revisar SQL v13)')
  // Sin VAPID no consumir avisos que todavía no pueden enviarse.
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return leerMonitorReservas()
  const { data: avisos, error: claimError } = await db.rpc('reclamar_avisos_reservas')
  if (claimError) throw new Error('No se pudieron reclamar avisos de disponibilidad')
  for (const aviso of avisos || []) await enviarPushATodos(aviso)
  return leerMonitorReservas()
}
