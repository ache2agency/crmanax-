import { createServiceRoleClient } from '@/utils/supabase/server'
import { parseReservasExcel } from './parser'

type SyncResult = {
  syncId: string
  rows: number
  warnings: unknown[]
}

function normalizarDropboxUrl(url: string) {
  if (!url) return url
  if (url.includes('dropbox.com')) {
    if (url.includes('dl=0')) return url.replace('dl=0', 'dl=1')
    if (!url.includes('dl=1')) return `${url}${url.includes('?') ? '&' : '?'}dl=1`
  }
  return url
}

export async function syncReservasDesdeDropbox(): Promise<SyncResult> {
  const sourceUrl = process.env.DROPBOX_RESERVAS_URL
  if (!sourceUrl) throw new Error('Falta DROPBOX_RESERVAS_URL en el entorno')

  const supabase = createServiceRoleClient()
  const startedAt = new Date().toISOString()

  const { data: syncRow, error: syncInsertError } = await supabase
    .from('reservas_sync')
    .insert({ started_at: startedAt, status: 'running' })
    .select('id')
    .single()

  if (syncInsertError) throw syncInsertError

  const syncId = syncRow.id as string

  try {
    const response = await fetch(normalizarDropboxUrl(sourceUrl), { cache: 'no-store' })
    if (!response.ok) throw new Error(`No se pudo descargar el Excel: HTTP ${response.status}`)

    const buffer = Buffer.from(await response.arrayBuffer())

    const { data: lofts, error: loftsError } = await supabase
      .from('lofts')
      .select('id, nombre')

    if (loftsError) throw loftsError

    const parsed = await parseReservasExcel(buffer, lofts || [])

    const { data: replacedCount, error: replaceError } = await supabase.rpc(
      'replace_excel_reservas',
      { p_rows: parsed.rows, p_sync_id: syncId }
    )

    if (replaceError) throw replaceError

    const rows = Number(replacedCount || parsed.rows.length)
    await supabase
      .from('reservas_sync')
      .update({
        finished_at: new Date().toISOString(),
        status: 'success',
        rows_count: rows,
        error: null,
      })
      .eq('id', syncId)

    return { syncId, rows, warnings: parsed.warnings }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    await supabase
      .from('reservas_sync')
      .update({
        finished_at: new Date().toISOString(),
        status: 'error',
        rows_count: 0,
        error: detail,
      })
      .eq('id', syncId)

    throw error
  }
}
