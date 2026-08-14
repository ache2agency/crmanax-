// Import histórico, de una sola vez: lee la hoja RESERVAS del Excel de
// Anaxagoras (Dropbox) y carga los registros reales a la tabla `reservas`
// de Supabase. Idempotente: usa `excel_control_no` (columna A del Excel)
// como llave de dedupe, así que se puede correr más de una vez sin duplicar.
//
// Uso:
//   node scripts/import_reservas_excel.mjs <url-o-ruta-local-del-xlsx>
//
// Requiere supabase/migration_v10_reservas.sql ya aplicada en Supabase.

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import ExcelJS from 'exceljs';

function parseEnv(path) {
  const out = {};
  const content = readFileSync(path, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let val = m[2];
    val = val.replace(/^"|"$/g, '').replace(/\\n$/, '');
    out[m[1]] = val;
  }
  return out;
}

const env = parseEnv('.env.local');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const source = process.argv[2];
if (!source) {
  console.error('Uso: node scripts/import_reservas_excel.mjs <url-o-ruta-local-del-xlsx>');
  process.exit(1);
}

async function loadBuffer(source) {
  if (existsSync(source)) {
    return readFileSync(source);
  }
  const url = source.includes('dropbox.com') && !source.includes('dl=1')
    ? source.replace(/dl=0/, 'dl=1')
    : source;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// PB01 / 1ER11 / 2DO21 (Excel, sin guión) -> PB-01 / 1ER-11 / 2DO-21 (Supabase)
function normalizarDepto(depto) {
  if (!depto || typeof depto !== 'string') return null;
  const m = depto.trim().toUpperCase().match(/^(PB|1ER|2DO)(\d{2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}`;
}

function excelDateToISO(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function cellText(cell) {
  const v = cell?.value;
  if (v == null) return null;
  if (typeof v === 'object' && 'result' in v) return v.result ?? null; // celda con fórmula
  if (typeof v === 'object' && 'text' in v) return v.text ?? null; // rich text
  return v;
}

async function main() {
  console.log('Descargando/leyendo Excel...');
  const buffer = await loadBuffer(source);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const ws = workbook.getWorksheet('RESERVAS');
  if (!ws) throw new Error('No se encontró la hoja RESERVAS en el archivo');

  const { data: lofts, error: loftsErr } = await supabase.from('lofts').select('id, nombre');
  if (loftsErr) throw loftsErr;
  const loftByNombre = new Map(lofts.map((l) => [l.nombre, l.id]));

  const rows = [];
  const pendientesDepto = [];
  let filasVacias = 0;
  let filasSinCheckin = 0;

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < 6) return; // filas 1-5 son encabezado/plantilla

    const controlNo = cellText(row.getCell(1));
    const origenRaw = cellText(row.getCell(3));
    const nombre = cellText(row.getCell(4));
    const telefono = cellText(row.getCell(6));
    const email = cellText(row.getCell(7));
    const adultos = cellText(row.getCell(9));
    const noches = cellText(row.getCell(10));
    const checkinRaw = cellText(row.getCell(11));
    const deptoRaw = cellText(row.getCell(13));
    const tipoRentaRaw = cellText(row.getCell(14));
    const extras = cellText(row.getCell(15));

    // Filas plantilla sin capturar todavía (sin huésped ni fecha real).
    if (!nombre && !checkinRaw) {
      filasVacias++;
      return;
    }

    const checkin = excelDateToISO(checkinRaw);
    if (!checkin) {
      filasSinCheckin++;
      return; // dato incompleto (tiene nombre pero no fecha), no se puede calcular disponibilidad
    }
    const nochesNum = Number(noches) > 0 ? Number(noches) : 1;
    const checkoutDate = new Date(checkin + 'T00:00:00Z');
    checkoutDate.setUTCDate(checkoutDate.getUTCDate() + nochesNum);
    const checkout = excelDateToISO(checkoutDate);

    const origen = String(origenRaw || '').trim().toUpperCase() === 'AIRBNB' ? 'airbnb' : 'directo';

    let tipoRenta = String(tipoRentaRaw || '').trim().toUpperCase();
    if (tipoRenta === 'DIA') tipoRenta = 'dia';
    else if (tipoRenta === 'MES') tipoRenta = 'mes';
    else tipoRenta = nochesNum >= 28 ? 'mes' : 'dia'; // misma regla que documenta el propio Excel

    const deptoNormalizado = normalizarDepto(deptoRaw);
    const loft_id = deptoNormalizado ? loftByNombre.get(deptoNormalizado) ?? null : null;
    if (!loft_id) {
      pendientesDepto.push({ fila: rowNumber, controlNo, nombre, deptoRaw });
    }

    rows.push({
      excel_control_no: controlNo ? Number(controlNo) : null,
      origen,
      nombre_huesped: nombre || '(sin nombre)',
      telefono: telefono ? String(telefono) : null,
      email: email ? String(email) : null,
      loft_id,
      tipo_renta: tipoRenta,
      fecha_checkin: checkin,
      fecha_checkout: checkout,
      num_adultos: Number(adultos) > 0 ? Number(adultos) : 1,
      extras: Number(extras) || 0,
      notas: loft_id ? null : `Depto sin resolver en el Excel: "${deptoRaw}" (fila ${rowNumber})`,
    });
  });

  console.log(
    `Filas con datos reales: ${rows.length} | filas plantilla vacías: ${filasVacias} | ` +
      `filas con nombre pero sin check-in (descartadas): ${filasSinCheckin}`
  );
  if (pendientesDepto.length) {
    console.log(`Reservas con depto sin resolver (quedan con loft_id=null):`, pendientesDepto);
  }

  if (rows.length === 0) {
    console.log('Nada que importar.');
    return;
  }

  const { data, error } = await supabase
    .from('reservas')
    .upsert(rows, { onConflict: 'excel_control_no' })
    .select('id');

  if (error) {
    console.error('Error insertando en Supabase:', error);
    process.exit(1);
  }

  console.log(`Import completo: ${data.length} reservas insertadas/actualizadas.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
