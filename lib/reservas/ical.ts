// Este módulo nunca conserva UID, SUMMARY, DESCRIPTION ni URL del feed.
export type Bloqueo = { fecha_checkin: string; fecha_checkout: string }
export type Ocupacion = Bloqueo & { loft_id: string; origen?: string }
export type AvisoAirbnb = Bloqueo & { loft: string }

export function ventanaIcal(now = new Date()) {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const [y, m, d] = hoy.split('-').map(Number)
  const limite = new Date(Date.UTC(y + 1, m - 1, d)).toISOString().slice(0, 10)
  return { hoy, limite }
}

function fechaDate(value: string) {
  if (!/^\d{8}$/.test(value)) throw new Error('iCal requiere fechas DATE')
  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`
  const date = new Date(`${iso}T00:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso) throw new Error('Fecha iCal inválida')
  return iso
}

export function parseIcal(text: string, now = new Date()): Bloqueo[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').trim().split('\n')
  if (lines[0] !== 'BEGIN:VCALENDAR' || lines.at(-1) !== 'END:VCALENDAR') throw new Error('Calendario iCal incompleto')
  const { hoy, limite } = ventanaIcal(now)
  const rows: Bloqueo[] = []
  let event: Record<string, string> | null = null
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      if (event) throw new Error('VEVENT inválido')
      event = {}
    } else if (line === 'END:VEVENT') {
      if (!event) throw new Error('VEVENT inválido')
      if (event.RRULE || event.RDATE || event.EXDATE || event.RECURRENCE_ID) throw new Error('Recurrencia iCal no soportada')
      const start = fechaDate(event.DTSTART || '')
      const end = fechaDate(event.DTEND || '')
      if (end <= start) throw new Error('Intervalo iCal inválido')
      // DTEND es exclusivo. Recortar al horizonte evita bloquear fuera de 12 meses.
      if (end > hoy && start < limite) rows.push({ fecha_checkin: start < hoy ? hoy : start, fecha_checkout: end > limite ? limite : end })
      event = null
    } else if (event) {
      const colon = line.indexOf(':')
      const property = line.slice(0, colon).split(';')[0].replace(/-/g, '_')
      if (['DTSTART', 'DTEND', 'RRULE', 'RDATE', 'EXDATE', 'RECURRENCE_ID'].includes(property)) {
        if (colon < 0 || event[property]) throw new Error('Propiedad iCal inválida')
        event[property] = line.slice(colon + 1)
      }
    }
  }
  if (event) throw new Error('VEVENT incompleto')
  return rows
}

export function leerFeeds(raw: string | undefined): Record<string, string> {
  if (!raw) return {}
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw new Error('AIRBNB_ICAL_URLS debe ser un objeto JSON') }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('AIRBNB_ICAL_URLS debe ser un objeto JSON')
  const result: Record<string, string> = {}
  for (const [loft, value] of Object.entries(parsed)) {
    if (!/^(PB-0[1-4]|1ER-1[1-4]|2DO-2[1-4])$/.test(loft)) throw new Error('Loft inválido en AIRBNB_ICAL_URLS')
    try {
      const url = new URL(value)
      if (url.protocol !== 'https:' || !['www.airbnb.com', 'airbnb.com'].includes(url.hostname) || !url.pathname.startsWith('/calendar/ical/') || url.username || url.password) throw new Error()
      result[loft] = url.toString()
    } catch { throw new Error(`URL iCal inválida para ${loft}`) }
  }
  return result
}

export async function descargarIcal(url: string, now = new Date(), fetcher: typeof fetch = fetch): Promise<Bloqueo[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetcher(url, {
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10_000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AnaxagorasCalendar/1.0)', Accept: 'text/calendar' },
      })
      if (!response.ok) throw new Error()
      const text = await response.text()
      if (text.length > 2_000_000) throw new Error()
      return parseIcal(text, now)
    } catch { /* Nunca propagar errores de fetch: pueden contener la URL secreta. */ }
  }
  throw new Error('No se pudo descargar o validar el calendario tras 2 intentos')
}

export function diasExcelLibresEnAirbnb(excel: Bloqueo[], airbnb: Bloqueo[], now = new Date()): Bloqueo[] {
  const { hoy, limite } = ventanaIcal(now)
  const ocupadas = airbnb.slice().sort((a, b) => a.fecha_checkin.localeCompare(b.fecha_checkin))
  const pendientes: Bloqueo[] = []
  for (const row of excel) {
    let start = row.fecha_checkin < hoy ? hoy : row.fecha_checkin
    const end = row.fecha_checkout > limite ? limite : row.fecha_checkout
    for (const block of ocupadas) {
      if (block.fecha_checkout <= start || block.fecha_checkin >= end) continue
      if (block.fecha_checkin > start) pendientes.push({ fecha_checkin: start, fecha_checkout: block.fecha_checkin })
      if (block.fecha_checkout > start) start = block.fecha_checkout
    }
    if (start < end) pendientes.push({ fecha_checkin: start, fecha_checkout: end })
  }
  // Unir avisos solapados/adyacentes del mismo loft.
  const merged: Bloqueo[] = []
  for (const row of pendientes.sort((a, b) => a.fecha_checkin.localeCompare(b.fecha_checkin))) {
    const last = merged.at(-1)
    if (last && row.fecha_checkin <= last.fecha_checkout) last.fecha_checkout = row.fecha_checkout > last.fecha_checkout ? row.fecha_checkout : last.fecha_checkout
    else merged.push({ ...row })
  }
  return merged
}

export type IcalStore = {
  replace: (loftId: string, rows: Bloqueo[]) => Promise<void>
}

export async function sincronizarFeeds(feeds: Record<string, string>, lofts: { id: string; nombre: string }[], excel: Ocupacion[], store: IcalStore, now = new Date(), fetcher: typeof fetch = fetch) {
  const errores: string[] = []
  const avisos: AvisoAirbnb[] = []
  let rows = 0
  const entries = Object.entries(feeds)
  for (let i = 0; i < entries.length; i += 3) {
    await Promise.all(entries.slice(i, i + 3).map(async ([nombre, url]) => {
    const loft = lofts.find(l => l.nombre === nombre)
    if (!loft) { errores.push(`${nombre}: loft no encontrado`); return }
    try {
      const blocks = await descargarIcal(url, now, fetcher)
      await store.replace(loft.id, blocks)
      rows += blocks.length
      avisos.push(...diasExcelLibresEnAirbnb(excel.filter(r => r.loft_id === loft.id), blocks, now).map(r => ({ loft: nombre, ...r })))
    } catch {
      errores.push(`${nombre}: no se pudo sincronizar; se conservan los bloqueos anteriores`)
    }
    }))
  }
  return { rows, errores, avisos }
}
