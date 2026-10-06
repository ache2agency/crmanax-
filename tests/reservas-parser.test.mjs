import test from 'node:test'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import { parseReservasExcel, normalizarDepto } from '../lib/reservas/parser.js'

async function buildWorkbookBuffer() {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('RESERVAS')

  for (let index = 1; index <= 5; index += 1) {
    worksheet.getRow(index).getCell(1).value = `header ${index}`
  }

  const row = worksheet.getRow(6)
  row.getCell(1).value = 101
  row.getCell(3).value = 'AIRBNB'
  row.getCell(4).value = 'Persona Demo'
  row.getCell(6).value = '5550000000'
  row.getCell(7).value = 'demo@example.com'
  row.getCell(9).value = 2
  row.getCell(10).value = 3
  row.getCell(11).value = new Date('2026-10-06T00:00:00Z')
  row.getCell(13).value = 'PB01'
  row.getCell(14).value = 'DIA'
  row.getCell(15).value = 100

  return Buffer.from(await workbook.xlsx.writeBuffer())
}

test('normaliza departamentos del Excel', () => {
  assert.equal(normalizarDepto('PB01'), 'PB-01')
  assert.equal(normalizarDepto('1ER11'), '1ER-11')
  assert.equal(normalizarDepto('2DO-24'), '2DO-24')
  assert.equal(normalizarDepto('otro'), null)
})

test('parsea la hoja RESERVAS sin datos reales de huespedes', async () => {
  const buffer = await buildWorkbookBuffer()
  const parsed = await parseReservasExcel(buffer, [{ id: '00000000-0000-0000-0000-000000000001', nombre: 'PB-01' }])

  assert.equal(parsed.rows.length, 1)
  assert.deepEqual(parsed.rows[0], {
    excel_control_no: 101,
    origen: 'excel',
    canal: 'airbnb',
    nombre_huesped: 'Persona Demo',
    telefono: '5550000000',
    email: 'demo@example.com',
    loft_id: '00000000-0000-0000-0000-000000000001',
    tipo_renta: 'dia',
    fecha_checkin: '2026-10-06',
    fecha_checkout: '2026-10-09',
    num_adultos: 2,
    extras: 100,
    notas: null,
  })
})
