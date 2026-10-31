import { createServiceRoleClient } from '@/utils/supabase/server'
import { leerFeeds, sincronizarFeeds, ventanaIcal } from './ical'

export async function syncReservasAirbnb() {
  const db = createServiceRoleClient()
  const { data: sync, error: insertError } = await db.from('reservas_sync').insert({ status: 'running', origen: 'airbnb_ical' }).select('id').single()
  if (insertError) throw new Error('No se pudo iniciar la bitácora iCal; revisar migración v12')
  try {
    const feeds = leerFeeds(process.env.AIRBNB_ICAL_URLS)
    const { hoy, limite } = ventanaIcal()
    const [{ data: lofts, error: loftError }, { data: excel, error: excelError }] = await Promise.all([
      db.from('lofts').select('id, nombre').eq('activo', true),
      db.from('reservas').select('loft_id, fecha_checkin, fecha_checkout').eq('origen', 'excel').lt('fecha_checkin', limite).gt('fecha_checkout', hoy),
    ])
    if (loftError || excelError) throw new Error('No se pudieron consultar lofts/reservas para iCal')
    const result = await sincronizarFeeds(feeds, lofts || [], excel || [], {
      async replace(loftId, rows) {
        const { error } = await db.rpc('replace_airbnb_ical_reservas', { p_loft_id: loftId, p_rows: rows })
        if (error) throw new Error('No se pudieron guardar los bloqueos iCal')
      },
    })
    if (!Object.keys(feeds).length) result.errores.push('AIRBNB_ICAL_URLS sin configurar; no se actualizaron calendarios')
    const { error } = await db.from('reservas_sync').update({ finished_at: new Date().toISOString(), status: result.errores.length ? 'error' : 'success', rows_count: result.rows, error: result.errores.join('; ') || null, avisos: result.avisos }).eq('id', sync.id)
    if (error) throw new Error('No se pudo cerrar la bitácora iCal')
    return { syncId: sync.id, configurado: Object.keys(feeds).length > 0, ...result }
  } catch (error) {
    // Solo errores propios y saneados llegan aquí, nunca respuestas ni URLs del feed.
    const detail = error instanceof Error ? error.message : 'Error de sincronización iCal'
    await db.from('reservas_sync').update({ finished_at: new Date().toISOString(), status: 'error', error: detail }).eq('id', sync.id)
    throw new Error(detail)
  }
}
