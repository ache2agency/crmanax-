import ExcelJS from 'exceljs'

function cellValue(cell) {
  const value = cell?.value
  if (value == null) return null
  if (typeof value === 'object' && 'result' in value) return value.result ?? null
  if (typeof value === 'object' && 'text' in value) return value.text ?? null
  if (typeof value === 'object' && 'richText' in value) {
    return value.richText.map((part) => part.text).join('')
  }
  return value
}

function text(value) {
  if (value == null) return null
  const trimmed = String(value).trim()
  return trimmed || null
}

function numberOrNull(value) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function normalizarDepto(depto) {
  const value = text(depto)?.toUpperCase().replace(/[\s-]/g, '')
  if (!value) return null
  const match = value.match(/^(PB|1ER|2DO)(\d{2})$/)
  if (!match) return null
  return `${match[1]}-${match[2]}`
}

export function excelDateToISO(value) {
  if (!value) return null
  let date = null

  if (value instanceof Date) {
    date = value
  } else if (typeof value === 'number') {
    date = new Date(Math.round((value - 25569) * 86400 * 1000))
  } else {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) date = parsed
  }

  if (!date || Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

export async function parseReservasExcel(buffer, lofts = []) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const worksheet = workbook.getWorksheet('RESERVAS')
  if (!worksheet) throw new Error('No se encontro la hoja RESERVAS en el archivo')

  const loftByNombre = new Map(lofts.map((loft) => [loft.nombre, loft.id]))
  const rows = []
  const warnings = []
  let filasVacias = 0
  let filasSinCheckin = 0

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < 6) return

    const controlNo = cellValue(row.getCell(1))
    const canalRaw = cellValue(row.getCell(3))
    const nombre = text(cellValue(row.getCell(4)))
    const telefono = text(cellValue(row.getCell(6)))
    const email = text(cellValue(row.getCell(7)))
    const adultos = numberOrNull(cellValue(row.getCell(9)))
    const noches = numberOrNull(cellValue(row.getCell(10))) || 1
    const checkinRaw = cellValue(row.getCell(11))
    const deptoRaw = cellValue(row.getCell(13))
    const tipoRentaRaw = text(cellValue(row.getCell(14)))?.toUpperCase()
    const extras = numberOrNull(cellValue(row.getCell(15))) || 0

    if (!nombre && !checkinRaw) {
      filasVacias += 1
      return
    }

    const fecha_checkin = excelDateToISO(checkinRaw)
    if (!fecha_checkin) {
      filasSinCheckin += 1
      warnings.push({ fila: rowNumber, tipo: 'sin_checkin', nombre })
      return
    }

    const checkoutDate = new Date(`${fecha_checkin}T00:00:00.000Z`)
    checkoutDate.setUTCDate(checkoutDate.getUTCDate() + noches)
    const fecha_checkout = excelDateToISO(checkoutDate)

    const deptoNormalizado = normalizarDepto(deptoRaw)
    const loft_id = deptoNormalizado ? loftByNombre.get(deptoNormalizado) ?? null : null
    if (!loft_id) {
      warnings.push({
        fila: rowNumber,
        tipo: 'loft_no_resuelto',
        controlNo,
        nombre,
        deptoRaw: text(deptoRaw),
      })
    }

    let tipo_renta = tipoRentaRaw
    if (tipo_renta === 'DIA') tipo_renta = 'dia'
    else if (tipo_renta === 'MES') tipo_renta = 'mes'
    else tipo_renta = noches >= 28 ? 'mes' : 'dia'

    const canal = text(canalRaw)?.toUpperCase() === 'AIRBNB' ? 'airbnb' : 'directo'

    rows.push({
      excel_control_no: numberOrNull(controlNo),
      origen: 'excel',
      canal,
      nombre_huesped: nombre || '(sin nombre)',
      telefono,
      email,
      loft_id,
      tipo_renta,
      fecha_checkin,
      fecha_checkout,
      num_adultos: adultos && adultos > 0 ? adultos : 1,
      extras,
      notas: loft_id ? null : `Depto sin resolver en el Excel: "${text(deptoRaw) || ''}" (fila ${rowNumber})`,
    })
  })

  return { rows, warnings, stats: { filasVacias, filasSinCheckin } }
}
