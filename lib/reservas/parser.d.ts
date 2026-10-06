export type ParsedReservaExcel = {
  excel_control_no: number | null
  origen: 'excel'
  canal: 'airbnb' | 'directo'
  nombre_huesped: string
  telefono: string | null
  email: string | null
  loft_id: string | null
  tipo_renta: 'dia' | 'mes'
  fecha_checkin: string
  fecha_checkout: string
  num_adultos: number
  extras: number
  notas: string | null
}

export function normalizarDepto(depto: unknown): string | null
export function excelDateToISO(value: unknown): string | null
export function parseReservasExcel(
  buffer: Buffer,
  lofts?: { id: string; nombre: string }[]
): Promise<{
  rows: ParsedReservaExcel[]
  warnings: unknown[]
  stats: { filasVacias: number; filasSinCheckin: number }
}>
