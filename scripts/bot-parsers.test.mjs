// Pruebas de la lógica pura del bot (fechas, nombres, mensajes sin fecha).
// Correr con:  node --test scripts/bot-parsers.test.mjs   (Node >= 23, quita tipos de TS solo)
// Los casos con comentario "real" son mensajes reales de leads (revisión 3-oct-2026).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  extraerFechas,
  decidirFechas,
  clasificarSinFecha,
  extraerNombre,
  debeRetomarConAsesor,
  esHorarioDeSeguimiento,
  sumarMesesISO,
} from '../lib/whatsapp/bot-parsers.ts'

const HOY = '2026-10-01' // jueves

const fechas = (t, ref) => extraerFechas(t, HOY, ref).fechas

test('fechas numéricas sueltas y con espacios/typos de separador', () => {
  assert.deepEqual(fechas('15/10/2026'), ['2026-10-15'])
  assert.deepEqual(fechas('15-10-26'), ['2026-10-15'])
  assert.deepEqual(fechas('22 /09/2026'), ['2026-09-22']) // real
  assert.deepEqual(fechas('18 /09/ 2026'), ['2026-09-18']) // real
  assert.deepEqual(fechas('09/10//2026'), ['2026-10-09']) // real
  assert.deepEqual(fechas('en mi día de entrada sería 25/ 09/2026'), ['2026-09-25']) // real
  assert.deepEqual(fechas('Me gustaría 01/10/2026'), ['2026-10-01']) // real
  assert.deepEqual(fechas('30/112026'), []) // real: ambiguo, no adivinar
  assert.deepEqual(fechas('31/02/2027'), [])
  assert.deepEqual(fechas('20/10'), ['2026-10-20'])
  assert.deepEqual(fechas('llego entre 7-9 pm'), [])
})

test('rangos en un solo mensaje', () => {
  assert.deepEqual(fechas('02/10/2026 al 04/10/2026'), ['2026-10-02', '2026-10-04']) // real
  assert.deepEqual(fechas('2/10/2026 al 4/10/2026'), ['2026-10-02', '2026-10-04']) // real
  assert.deepEqual(fechas('Llegada 02/10/2026\nSalida 03/10/2026'), ['2026-10-02', '2026-10-03']) // real
  assert.deepEqual(fechas('29/09/2026\n3/10/2026'), ['2026-09-29', '2026-10-03']) // real
  assert.deepEqual(fechas('22/10/2026 a 23/11/2026'), ['2026-10-22', '2026-11-23']) // real
  assert.deepEqual(fechas('23/9/26 al 1/10/26'), ['2026-09-23', '2026-10-01']) // real
  assert.deepEqual(fechas('16 al 19 Octubre'), ['2026-10-16', '2026-10-19']) // real
  assert.deepEqual(fechas('del 15 al 19 de octubre'), ['2026-10-15', '2026-10-19'])
  assert.deepEqual(fechas('15 de octubre al 2 de noviembre'), ['2026-10-15', '2026-11-02'])
  assert.deepEqual(fechas('28 al 3 de noviembre'), ['2026-10-28', '2026-11-03'])
  assert.deepEqual(fechas('28 de diciembre al 3 de enero'), ['2026-12-28', '2027-01-03'])
})

test('fechas en español, relativas y días de la semana', () => {
  assert.deepEqual(fechas('1ro octubre 2026'), ['2026-10-01']) // real
  assert.deepEqual(fechas('15 de septiembre'), ['2027-09-15']) // ya pasó → año siguiente
  assert.deepEqual(fechas('mañana'), ['2026-10-02'])
  assert.deepEqual(fechas('pasado mañana'), ['2026-10-03'])
  assert.deepEqual(fechas('hoy mañana lo antes posible'), []) // ambiguo
  assert.deepEqual(fechas('Sería para mañana y el sábado'), ['2026-10-02', '2026-10-03']) // real
  assert.deepEqual(fechas('Saldría el domingo en la tarde', '2026-10-02'), ['2026-10-04']) // real
  assert.deepEqual(fechas('el domingo en la mañana', '2026-10-02'), ['2026-10-04'])
  assert.deepEqual(fechas('domingo 4 de octubre'), ['2026-10-04'])
})

test('duraciones', () => {
  assert.equal(extraerFechas('M quiero quedar un mes', HOY).duracion?.meses, 1) // real
  assert.equal(extraerFechas('1 octubre todo el mes', HOY).duracion?.meses, 1) // real
  assert.equal(extraerFechas('una semana', HOY).duracion?.dias, 7)
  assert.equal(extraerFechas('3 noches', HOY).duracion?.dias, 3)
  assert.equal(extraerFechas('dos meses', HOY).duracion?.meses, 2)
  assert.equal(extraerFechas('Se pueden habitar por mes', HOY).duracion, null) // real: pregunta, no duración
  assert.equal(sumarMesesISO('2026-01-31', 1), '2026-02-28')
})

test('decidirFechas en fase checkin', () => {
  assert.deepEqual(decidirFechas('checkin', '16 al 19 Octubre', HOY), { tipo: 'completo', checkin: '2026-10-16', checkout: '2026-10-19' })
  // real: año de salida mal escrito (2016) → se corrige
  assert.deepEqual(decidirFechas('checkin', '15/10/2026 al 19/10/2016', HOY), { tipo: 'completo', checkin: '2026-10-15', checkout: '2026-10-19' })
  assert.deepEqual(decidirFechas('checkin', '1 octubre todo el mes', HOY), { tipo: 'completo', checkin: '2026-10-01', checkout: '2026-11-01' })
  assert.deepEqual(decidirFechas('checkin', '20/10/2026', HOY), { tipo: 'solo_checkin', checkin: '2026-10-20' })
  assert.equal(decidirFechas('checkin', 'M quiero quedar un mes', HOY).tipo, 'solo_duracion')
  assert.deepEqual(
    decidirFechas('checkin', '20/10/2026', HOY, null, { dias: 0, meses: 1, texto: '1 mes' }),
    { tipo: 'completo', checkin: '2026-10-20', checkout: '2026-11-20' }
  )
  assert.deepEqual(decidirFechas('checkin', '20/09/2026', HOY), { tipo: 'fecha_pasada', fecha: '2026-09-20' }) // real
  assert.equal(decidirFechas('checkin', 'Gracias', HOY).tipo, 'sin_fecha')
})

test('decidirFechas en fase checkout', () => {
  const ci = '2026-10-02'
  assert.deepEqual(decidirFechas('checkout', 'Saldría el domingo en la tarde', HOY, ci), { tipo: 'completo', checkin: ci, checkout: '2026-10-04' }) // real
  assert.deepEqual(decidirFechas('checkout', '02/10/2026 al 04/10/2026', HOY, ci), { tipo: 'completo', checkin: ci, checkout: '2026-10-04' }) // real
  assert.deepEqual(decidirFechas('checkout', 'una semana', HOY, ci), { tipo: 'completo', checkin: ci, checkout: '2026-10-09' })
  assert.deepEqual(decidirFechas('checkout', '01/10/2026', HOY, ci), { tipo: 'checkout_invalido' })
  assert.equal(decidirFechas('checkout', 'No tengo fecha de salida', HOY, ci).tipo, 'sin_fecha') // real
})

test('mensajes sin fecha no se tratan como fecha mal escrita', () => {
  assert.equal(clasificarSinFecha('Me gustaría hacer una visita para ver los cuartos'), 'visita') // real
  assert.equal(clasificarSinFecha('Gracias'), 'cortesia') // real
  assert.equal(clasificarSinFecha('Ya'), 'cortesia') // real
  assert.equal(clasificarSinFecha('.'), 'cortesia') // real
  assert.equal(clasificarSinFecha('Si, por favor'), 'cortesia') // real
  assert.equal(clasificarSinFecha('Buenas tardes'), 'cortesia') // real
  assert.equal(clasificarSinFecha('No tengo fecha de salida'), 'sin_fecha_definida') // real
  assert.equal(clasificarSinFecha('No tengo aún fecha de salida'), 'sin_fecha_definida') // real
  assert.equal(clasificarSinFecha('lo mas pronto'), 'sin_fecha_definida') // real
  assert.equal(clasificarSinFecha('No sé exactamente, pero sería la semana próxima'), 'sin_fecha_definida') // real
  assert.equal(clasificarSinFecha('No entendí'), 'quiere_humano') // real
  assert.equal(clasificarSinFecha('ya no escriban no contestan lo que pregunto'), 'quiere_humano') // real
  assert.equal(clasificarSinFecha('Quiero información'), 'info') // real
  assert.equal(clasificarSinFecha('Hola, vi su anuncio en Facebook. Te comparto la información solicitada:'), 'info') // real
  assert.equal(clasificarSinFecha('Se pueden habitar por mes'), 'info') // real
  assert.equal(clasificarSinFecha('no es un depa?'), 'pregunta') // real
  assert.equal(clasificarSinFecha('Vivo en la Ciudad'), 'otro') // real
})

test('nombre: rechaza frases que no son nombre y limpia presentaciones', () => {
  assert.equal(extraerNombre('Manejas x mes'), null) // real: se guardó como nombre el 2-oct
  assert.equal(extraerNombre('Hola, vi su anuncio en Facebook. Te comparto la información solicitada:'), null) // real
  assert.equal(extraerNombre('Quiero información'), null)
  assert.equal(extraerNombre('Se renta por mes'), null)
  assert.equal(extraerNombre('Marco Antonio García'), 'Marco Antonio García') // real
  assert.equal(extraerNombre('Leticia'), 'Leticia') // real
  assert.equal(extraerNombre('Hola, soy Ana López'), 'Ana López')
  assert.equal(extraerNombre('Me llamo José'), 'José')
  assert.equal(extraerNombre('César servidor'), 'César') // real
  assert.equal(extraerNombre('María de la Luz'), 'María de la Luz')
})

test('lead descartado / atendido por humano que vuelve a escribir', () => {
  const ahora = new Date('2026-10-04T12:00:00Z')
  // real: Fernando (+525668594640) — Alexis le escribió en la conversación cerrada
  assert.equal(debeRetomarConAsesor({ humanoIntervino: true, stage: 'no_interesado', fase: 'no_interesado', ultimoMensajeAt: '2026-09-29T14:36:00Z', ahora }), true)
  // real: Miguel (+525574429353) — dijo "No" al rango y al minuto mandó su presupuesto
  assert.equal(debeRetomarConAsesor({ humanoIntervino: false, stage: 'no_interesado', fase: 'no_interesado', ultimoMensajeAt: '2026-10-04T11:59:00Z', ahora }), true)
  // descartado hace meses y sin humano: flujo normal desde cero
  assert.equal(debeRetomarConAsesor({ humanoIntervino: false, stage: 'no_interesado', fase: 'no_interesado', ultimoMensajeAt: '2026-06-01T00:00:00Z', ahora }), false)
  assert.equal(debeRetomarConAsesor({ humanoIntervino: false, stage: 'nuevo_contacto', fase: 'checkin', ultimoMensajeAt: '2026-10-03T00:00:00Z', ahora }), false)
})

test('horario de seguimiento (CDMX 8:00-21:00)', () => {
  assert.equal(esHorarioDeSeguimiento(new Date('2026-10-04T14:48:00Z')), true) // 8:48 CDMX (cron diario)
  assert.equal(esHorarioDeSeguimiento(new Date('2026-10-04T09:00:00Z')), false) // 3:00 CDMX
  assert.equal(esHorarioDeSeguimiento(new Date('2026-10-05T02:30:00Z')), true) // 20:30 CDMX
  assert.equal(esHorarioDeSeguimiento(new Date('2026-10-05T03:00:00Z')), false) // 21:00 CDMX
})
