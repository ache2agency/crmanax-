// Lógica pura (sin Supabase ni WhatsApp) del bot de Anaxágoras: interpretación
// de fechas, nombres y mensajes que no son fechas. Vive aparte del webhook para
// poder probarse con `node --test scripts/bot-parsers.test.mjs`. Por eso este
// archivo NO debe importar nada con alias `@/`.

// ─── Fechas: utilidades ───────────────────────────────────────────────────────

export const MESES_ES: Record<string, string> = {
  enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
  julio: '07', agosto: '08', septiembre: '09', setiembre: '09', octubre: '10',
  noviembre: '11', diciembre: '12',
}

const DIAS_SEMANA: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
}

const NUMEROS_ES: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7,
  ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, quince: 15, veinte: 20,
}

export function normalizar(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function sumarDiasISO(fechaISO: string, dias: number): string {
  const d = new Date(`${fechaISO}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

// Suma meses de calendario (15/10 + 1 mes = 15/11). Si el día no existe en el
// mes destino (31/01 + 1 mes) se usa el último día de ese mes.
export function sumarMesesISO(fechaISO: string, meses: number): string {
  const [y, m, d] = fechaISO.split('-').map(Number)
  const totalMes = (m - 1) + meses
  const y2 = y + Math.floor(totalMes / 12)
  const m2 = ((totalMes % 12) + 12) % 12
  const ultimoDia = new Date(Date.UTC(y2, m2 + 1, 0)).getUTCDate()
  const dt = new Date(Date.UTC(y2, m2, Math.min(d, ultimoDia)))
  return dt.toISOString().slice(0, 10)
}

// Valida que year/month/day formen una fecha real de calendario (rechaza
// cosas como "31 de febrero", que Date() de otro modo rueda a marzo).
export function fechaCalendarioValida(year: string, month: string, day: string): boolean {
  const y = Number(year)
  const m = Number(month)
  const d = Number(day)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

export function formatFecha(fecha: string): string {
  if (!fecha) return '-'
  const [y, m, d] = fecha.split('-')
  if (!y || !m || !d) return '-'
  return `${d}/${m}/${y}`
}

export type Duracion = { dias: number; meses: number; texto: string }

export function sumarDuracion(fechaISO: string, dur: Duracion): string {
  let f = fechaISO
  if (dur.meses) f = sumarMesesISO(f, dur.meses)
  if (dur.dias) f = sumarDiasISO(f, dur.dias)
  return f
}

// ─── Fechas: extracción ───────────────────────────────────────────────────────

type Token = { pos: number; fin: number; fecha: string }

// Fecha sin año explícito: si ya pasó respecto a `base`, se asume el año siguiente.
function conAnioImplicito(mes: string, dia: string, base: string): string | null {
  let year = base.slice(0, 4)
  if (!fechaCalendarioValida(year, mes, dia)) {
    // 29/02 en año no bisiesto: probar el siguiente
    year = String(Number(year) + 1)
    if (!fechaCalendarioValida(year, mes, dia)) return null
  }
  let fecha = `${year}-${mes}-${dia}`
  if (fecha < base) {
    const y2 = String(Number(year) + 1)
    if (!fechaCalendarioValida(y2, mes, dia)) return null
    fecha = `${y2}-${mes}-${dia}`
  }
  return fecha
}

function anioCompleto(y: string): string {
  return y.length === 2 ? `20${y}` : y
}

function solapa(tokens: Token[], pos: number, fin: number): boolean {
  return tokens.some((t) => pos < t.fin && fin > t.pos)
}

/**
 * Busca TODAS las fechas y una posible duración dentro de un mensaje libre.
 * Acepta:
 *  - numéricas: 15/10/2026, 15-10-2026, 15.10.26, "22 /09/ 2026", "09/10//2026", 15/10 (sin año)
 *  - en español: "15 de octubre", "1ro octubre 2026", "16 al 19 Octubre", "del 15 al 19 de octubre"
 *  - relativas: hoy, mañana, pasado mañana (no "en la mañana"), "el domingo"
 *  - duraciones: "un mes", "todo el mes", "una semana", "3 noches", "2 meses"
 * `referencia` (p. ej. la fecha de llegada ya guardada) sirve como base para
 * resolver días de la semana y fechas sin año.
 */
export function extraerFechas(
  text: string,
  hoy: string,
  referencia?: string
): { fechas: string[]; duracion: Duracion | null } {
  const t = normalizar(text).replace(/\s+/g, ' ')
  const tokens: Token[] = []
  const meses = Object.keys(MESES_ES).join('|')
  const baseInicial = referencia && referencia > hoy ? referencia : hoy

  // 1) Rango de días con un solo mes: "16 al 19 octubre", "del 15 al 19 de octubre de 2026"
  const reRangoMes = new RegExp(
    `\\b(\\d{1,2})(?:ro|o|°|º)?\\s*(?:al|a|-|y|hasta(?: el)?)\\s*(\\d{1,2})(?:ro|o|°|º)?\\s+(?:de\\s+)?(${meses})\\b(?:\\s+(?:de\\s+|del\\s+)?(\\d{4}))?`,
    'g'
  )
  for (const m of t.matchAll(reRangoMes)) {
    const pos = m.index ?? 0
    const fin = pos + m[0].length
    const mes = MESES_ES[m[3]]
    const d1 = m[1].padStart(2, '0')
    const d2 = m[2].padStart(2, '0')
    let f2: string | null
    if (m[4]) f2 = fechaCalendarioValida(m[4], mes, d2) ? `${m[4]}-${mes}-${d2}` : null
    else f2 = conAnioImplicito(mes, d2, baseInicial)
    if (!f2) continue
    // "28 al 3 de noviembre": el primer día cae en el mes anterior
    let f1: string | null
    if (Number(d1) <= Number(d2)) {
      f1 = fechaCalendarioValida(f2.slice(0, 4), mes, d1) ? `${f2.slice(0, 7)}-${d1}` : null
    } else {
      const mesAnt = sumarMesesISO(`${f2.slice(0, 7)}-01`, -1)
      f1 = fechaCalendarioValida(mesAnt.slice(0, 4), mesAnt.slice(5, 7), d1) ? `${mesAnt.slice(0, 7)}-${d1}` : null
    }
    if (!f1) continue
    tokens.push({ pos, fin, fecha: f1 }, { pos: pos + 1, fin, fecha: f2 })
  }

  // 2) Fecha en español: "15 de octubre", "1ro octubre 2026", "15 de octubre del 2026"
  const reMes = new RegExp(
    `\\b(\\d{1,2})(?:ro|o|°|º)?\\s+(?:de\\s+)?(${meses})\\b(?:\\s+(?:de\\s+|del\\s+)?(\\d{4}))?`,
    'g'
  )
  for (const m of t.matchAll(reMes)) {
    const pos = m.index ?? 0
    const fin = pos + m[0].length
    if (solapa(tokens, pos, fin)) continue
    const mes = MESES_ES[m[2]]
    const dia = m[1].padStart(2, '0')
    const fecha = m[3]
      ? (fechaCalendarioValida(m[3], mes, dia) ? `${m[3]}-${mes}-${dia}` : null)
      : conAnioImplicito(mes, dia, tokens.length ? tokens[tokens.length - 1].fecha : baseInicial)
    if (fecha) tokens.push({ pos, fin, fecha })
  }

  // 3) Numéricas con año: 15/10/2026, 15-10-26, "22 /09/ 2026", "09/10//2026"
  const reNumAnio = /(?<![\d/.-])(\d{1,2})\s*[/.-]+\s*(\d{1,2})\s*[/.-]+\s*(\d{4}|\d{2})(?![\d/])/g
  for (const m of t.matchAll(reNumAnio)) {
    const pos = m.index ?? 0
    const fin = pos + m[0].length
    if (solapa(tokens, pos, fin)) continue
    const dia = m[1].padStart(2, '0')
    const mes = m[2].padStart(2, '0')
    const year = anioCompleto(m[3])
    if (fechaCalendarioValida(year, mes, dia)) tokens.push({ pos, fin, fecha: `${year}-${mes}-${dia}` })
  }

  // 4) Numéricas sin año, solo con "/": 15/10 (con "-" sería ambiguo: "7-9 pm")
  const reNumSinAnio = /(?<![\d/.-])(\d{1,2})\s*\/\s*(\d{1,2})(?![\d/.-])/g
  for (const m of t.matchAll(reNumSinAnio)) {
    const pos = m.index ?? 0
    const fin = pos + m[0].length
    if (solapa(tokens, pos, fin)) continue
    const dia = m[1].padStart(2, '0')
    const mes = m[2].padStart(2, '0')
    if (Number(mes) < 1 || Number(mes) > 12) continue
    const fecha = conAnioImplicito(mes, dia, tokens.length ? tokens[tokens.length - 1].fecha : baseInicial)
    if (fecha) tokens.push({ pos, fin, fecha })
  }

  // 5) Relativas: hoy / mañana / pasado mañana. "En la mañana" / "por la
  //    mañana" es hora del día, no fecha. Si aparecen dos relativas distintas
  //    a la vez ("hoy mañana lo antes posible") es ambiguo: se ignoran.
  const relativas: Token[] = []
  for (const m of t.matchAll(/\bpasado manana\b/g)) {
    relativas.push({ pos: m.index ?? 0, fin: (m.index ?? 0) + m[0].length, fecha: sumarDiasISO(hoy, 2) })
  }
  for (const m of t.matchAll(/(?<!\bla |\bpasado |\bmuy )\bmanana\b/g)) {
    const pos = m.index ?? 0
    if (solapa(relativas, pos, pos + m[0].length)) continue
    relativas.push({ pos, fin: pos + m[0].length, fecha: sumarDiasISO(hoy, 1) })
  }
  for (const m of t.matchAll(/\bhoy\b/g)) {
    relativas.push({ pos: m.index ?? 0, fin: (m.index ?? 0) + m[0].length, fecha: hoy })
  }
  if (new Set(relativas.map((r) => r.fecha)).size === 1) tokens.push(relativas[0])

  // 6) Días de la semana: la siguiente ocurrencia después de la fecha anterior
  //    del mensaje (o de la llegada guardada, o de ayer → hoy cuenta).
  const reDia = /\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/g
  for (const m of t.matchAll(reDia)) {
    const pos = m.index ?? 0
    const fin = pos + m[0].length
    if (solapa(tokens, pos, fin)) continue
    // "domingo 5 de octubre" / "hoy sábado": el día de la semana solo describe
    // una fecha que ya viene pegada a él, no es una fecha nueva.
    if (tokens.some((x) => (x.pos >= fin && x.pos - fin <= 3) || (pos >= x.fin && pos - x.fin <= 3))) continue
    const anteriores = tokens.filter((x) => x.pos < pos).sort((a, b) => a.pos - b.pos)
    const base = anteriores.length
      ? anteriores[anteriores.length - 1].fecha
      : referencia || sumarDiasISO(hoy, -1)
    const objetivo = DIAS_SEMANA[m[1]]
    const baseDow = new Date(`${base}T00:00:00Z`).getUTCDay()
    let delta = (objetivo - baseDow + 7) % 7
    if (delta === 0) delta = 7
    tokens.push({ pos, fin, fecha: sumarDiasISO(base, delta) })
  }

  tokens.sort((a, b) => a.pos - b.pos)

  // Duración
  let duracion: Duracion | null = null
  if (/\btodo el mes\b/.test(t)) {
    duracion = { dias: 0, meses: 1, texto: '1 mes' }
  } else {
    const numeros = Object.keys(NUMEROS_ES).join('|')
    const reDur = new RegExp(`\\b(\\d{1,2}|${numeros})\\s+(meses|mes|semanas|semana|noches|noche|dias|dia|anos|ano)\\b`)
    const m = t.match(reDur)
    if (m && !solapa(tokens, m.index ?? 0, (m.index ?? 0) + m[0].length)) {
      const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUMEROS_ES[m[1]]
      const unidad = m[2]
      if (n > 0) {
        if (unidad.startsWith('mes')) duracion = { dias: 0, meses: n, texto: `${n} ${n === 1 ? 'mes' : 'meses'}` }
        else if (unidad.startsWith('ano')) duracion = { dias: 0, meses: 12 * n, texto: `${n} ${n === 1 ? 'año' : 'años'}` }
        else if (unidad.startsWith('semana')) duracion = { dias: 7 * n, meses: 0, texto: `${n} ${n === 1 ? 'semana' : 'semanas'}` }
        else duracion = { dias: n, meses: 0, texto: `${n} ${n === 1 ? 'noche' : 'noches'}` }
      }
    }
  }

  return { fechas: tokens.map((x) => x.fecha), duracion }
}

/** Compatibilidad: primera fecha que aparezca en el mensaje, o null. */
export function parseDate(text: string, hoy: string = hoyISO()): string | null {
  return extraerFechas(text, hoy).fechas[0] ?? null
}

// Si la salida quedó antes que la llegada solo porque el año está mal escrito
// ("15/10/2026 al 19/10/2016"), se corrige al año de la llegada (o el
// siguiente, para estancias que cruzan año nuevo). Si el año es el mismo y aun
// así queda antes, NO se adivina: es un error real del lead.
function corregirAnioSalida(checkin: string, checkout: string): string {
  if (checkout > checkin) return checkout
  if (checkout.slice(0, 4) >= checkin.slice(0, 4)) return checkout
  const md = checkout.slice(5)
  for (const y of [Number(checkin.slice(0, 4)), Number(checkin.slice(0, 4)) + 1]) {
    const cand = `${y}-${md}`
    if (fechaCalendarioValida(String(y), md.slice(0, 2), md.slice(3)) && cand > checkin) return cand
  }
  return checkout
}

export type DecisionFecha =
  | { tipo: 'completo'; checkin: string; checkout: string }
  | { tipo: 'solo_checkin'; checkin: string }
  | { tipo: 'solo_duracion'; duracion: Duracion }
  | { tipo: 'fecha_pasada'; fecha: string }
  | { tipo: 'checkout_invalido' }
  | { tipo: 'sin_fecha' }

/**
 * Decide qué hacer con un mensaje en las fases 'checkin' o 'checkout'.
 * - `checkinGuardado`: llegada ya guardada en el lead (solo fase checkout).
 * - `duracionPendiente`: duración que el lead ya dijo ("un mes") antes de dar
 *   su llegada; se usa para calcular la salida sin volver a preguntarla.
 */
export function decidirFechas(
  fase: 'checkin' | 'checkout',
  text: string,
  hoy: string,
  checkinGuardado?: string | null,
  duracionPendiente?: Duracion | null
): DecisionFecha {
  const { fechas, duracion } = extraerFechas(text, hoy, fase === 'checkout' ? checkinGuardado || undefined : undefined)

  if (fase === 'checkin') {
    if (fechas.length === 0) return duracion ? { tipo: 'solo_duracion', duracion } : { tipo: 'sin_fecha' }
    const checkin = fechas[0]
    if (checkin < hoy) return { tipo: 'fecha_pasada', fecha: checkin }
    const dur = duracion || duracionPendiente || null
    let checkout = fechas[1] ?? (dur ? sumarDuracion(checkin, dur) : null)
    if (checkout) {
      checkout = corregirAnioSalida(checkin, checkout)
      if (checkout > checkin) return { tipo: 'completo', checkin, checkout }
    }
    return { tipo: 'solo_checkin', checkin }
  }

  // fase checkout
  if (fechas.length >= 2) {
    const checkin = fechas[0]
    if (checkin < hoy) return { tipo: 'fecha_pasada', fecha: checkin }
    const checkout = corregirAnioSalida(checkin, fechas[1])
    if (checkout <= checkin) return { tipo: 'checkout_invalido' }
    return { tipo: 'completo', checkin, checkout }
  }
  if (fechas.length === 1) {
    if (!checkinGuardado) return { tipo: 'completo', checkin: '', checkout: fechas[0] }
    const checkout = corregirAnioSalida(checkinGuardado, fechas[0])
    if (checkout <= checkinGuardado) return { tipo: 'checkout_invalido' }
    return { tipo: 'completo', checkin: checkinGuardado, checkout }
  }
  if (duracion && checkinGuardado) {
    return { tipo: 'completo', checkin: checkinGuardado, checkout: sumarDuracion(checkinGuardado, duracion) }
  }
  return { tipo: 'sin_fecha' }
}

// ─── Mensajes que no son fechas ───────────────────────────────────────────────

export type TipoSinFecha = 'visita' | 'sin_fecha_definida' | 'quiere_humano' | 'info' | 'cortesia' | 'pregunta' | 'otro'

export function pareceInterrogacion(textLower: string): boolean {
  if (/[?¿]/.test(textLower)) return true
  return /^(puedo|se puede|se pueden|podr[ií]a|quiero saber|quisiera saber|me interesa saber|necesito saber|informaci[oó]n|qu[eé]|c[oó]mo|cu[aá]ndo|d[oó]nde|por qu[eé]|tienen|manejan|manejas|hay)\b/.test(textLower.trim())
}

/**
 * Clasifica un mensaje recibido en fase de fecha que NO contiene ninguna fecha
 * reconocible, para no contestar "No pude entender esa fecha" a cosas como
 * "Gracias", "Me gustaría hacer una visita" o "No tengo fecha de salida".
 */
export function clasificarSinFecha(text: string): TipoSinFecha {
  const t = normalizar(text).trim()
  if (/\bvisita|\bir a ver\b|\bpasar a ver\b|\bconocer(los|las|lo)?\b|\bver (el|los|las|un|una) (loft|lofts|cuarto|cuartos|depa|depas|departamento|departamentos|lugar|espacio|instalaciones)|\bagendar\b|\bcita\b/.test(t)) {
    return 'visita'
  }
  if (/\bno (tengo|se|sabria)\b.*\bfecha|\bno tengo fecha|\b(aun|todavia) no (se|tengo|lo se|la tengo|defino)|\bno (lo )?se (aun|todavia|exactamente|bien)\b|\bindefinid|\blo mas pronto|\bcuanto antes|\b(semana|mes) (proxima|proximo|que viene|entrante)|\bproxim[ao] (semana|mes)|\bno tengo (aun |todavia )?(la )?(fecha|salida|llegada)|\bdepende\b|\bsin fecha\b|\bno la tendria\b|\bno se\b$/.test(t)) {
    return 'sin_fecha_definida'
  }
  if (/\bno entend|\bno (me )?(contestan|responden|entienden|explican)|\bno contesta|\bya no escriban\b|\bhablar con (alguien|una persona|un asesor|asesor|un humano)|\basesor\b|\bpersona real\b|\bun humano\b|\bllamar(me|nos)?\b|\bllamada\b/.test(t)) {
    return 'quiere_humano'
  }
  // Pide información general o pregunta por renta mensual ("Quiero información",
  // "Se pueden habitar por mes"): se le dan las tarifas y se vuelve a pedir la fecha.
  if (/\b(informacion|informes|info|detalles)\b|\bpor mes\b|\bx mes\b|\bmensual|\bpor noche\b/.test(t)) return 'info'
  if (pareceInterrogacion(t)) return 'pregunta'
  const palabras = t.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean)
  if (
    palabras.length === 0 ||
    (palabras.length <= 5 && /^(gracias|muchas gracias|mil gracias|ok|okay|okey|va|vale|ya|listo|perfecto|si|claro|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hola|de acuerdo|entendido|sale|porfavor|por favor|adelante|bien)\b/.test(t))
  ) {
    return 'cortesia'
  }
  return 'otro'
}

// ─── Nombre ───────────────────────────────────────────────────────────────────

// Palabras que delatan que el mensaje no es un nombre (pregunta, saludo,
// intención de renta). "Manejas x mes" se guardó como nombre el 2-oct-2026.
const PALABRAS_NO_NOMBRE = new Set([
  'hola', 'gracias', 'buenas', 'buenos', 'tardes', 'noches', 'dias', 'dia',
  'informacion', 'info', 'informes', 'precio', 'precios', 'costo', 'costos', 'cuanto', 'cuesta', 'cuestan',
  'quiero', 'quisiera', 'necesito', 'busco', 'buscando', 'renta', 'rentas', 'rentan', 'rento', 'rentar',
  'loft', 'lofts', 'disponibilidad', 'disponible', 'ayuda', 'porfavor', 'favor', 'saludos', 'oferta',
  'ofertas', 'departamento', 'depa', 'cuarto', 'cuartos', 'habitacion', 'mes', 'meses', 'mensual',
  'noche', 'semana', 'semanas', 'x', 'manejas', 'manejan', 'tienes', 'tienen', 'hay', 'interesa',
  'interesado', 'interesada', 'anuncio', 'visita', 'ok', 'si', 'no', 'fecha', 'llegada', 'salida',
  'personas', 'persona', 'puedo', 'pueden', 'aceptan', 'mascota', 'mascotas', 'ubicacion', 'donde',
  'como', 'cuando', 'que', 'por', 'para', 'con', 'mas', 'estoy', 'vivo', 'sera', 'seria',
])

// Quita fórmulas de presentación: "Soy Ana", "Me llamo Ana López", "Mi nombre
// es Ana", "César, su servidor".
export function limpiarNombre(text: string): string {
  let t = text.trim().replace(/[.!¡,;:]+$/g, '').trim()
  t = t.replace(/^(hola[,!.\s]*)?(buen[oa]s?\s+(d[ií]as|tardes|noches)[,!.\s]*)?/i, '').trim()
  t = t.replace(/^(soy|me llamo|mi nombre es|habla|le saluda|te saluda)\s+/i, '').trim()
  t = t.replace(/[,\s]+(su|tu)?\s*servidor(a)?$/i, '').trim()
  return t.replace(/[.!¡,;:]+$/g, '').trim()
}

export function esNombreValido(text: string): boolean {
  const t = text.trim()
  if (!t || t.length > 40) return false
  if (/[?¿@$]/.test(t)) return false
  if (/\d/.test(t)) return false
  if (!/[a-záéíóúñ]/i.test(t)) return false
  const palabras = t.split(/\s+/).filter(Boolean)
  if (palabras.length === 0 || palabras.length > 4) return false
  if (palabras.map(normalizar).some((p) => PALABRAS_NO_NOMBRE.has(p.replace(/[^a-z]/g, '')))) return false
  return true
}

/** Nombre limpio si el mensaje parece un nombre; null si no. */
export function extraerNombre(text: string): string | null {
  const limpio = limpiarNombre(text)
  return esNombreValido(limpio) ? limpio : null
}

// ─── Lead descartado que vuelve a escribir ────────────────────────────────────

const DIAS_RETOMAR_DESCARTADO = 14

/**
 * Un lead cuya última conversación está cerrada vuelve a escribir. Si un
 * asesor ya lo había atendido, o si lo había descartado hace poco
 * (no_interesado), NO se reinicia el flujo desde cero (pedir nombre otra vez):
 * se reabre esa conversación y se pasa con un asesor.
 */
export function debeRetomarConAsesor(params: {
  humanoIntervino: boolean
  stage: string | null | undefined
  fase: string | null | undefined
  ultimoMensajeAt: string | null | undefined
  ahora: Date
}): boolean {
  if (params.humanoIntervino) return true
  const descartado = params.stage === 'no_interesado' || params.fase === 'no_interesado'
  if (!descartado || !params.ultimoMensajeAt) return false
  const dias = (params.ahora.getTime() - new Date(params.ultimoMensajeAt).getTime()) / 86_400_000
  return dias <= DIAS_RETOMAR_DESCARTADO
}

// ─── Seguimiento automático ("¿Te quedó alguna duda?") ────────────────────────

// Fases en las que NO tiene sentido el seguimiento automático: el lead ya está
// con un asesor, ya confirmó, o ya se descartó.
export const FASES_SIN_SEGUIMIENTO = ['esperando_asesor', 'confirmado', 'no_interesado']

// Etapas del lead en las que ya lo lleva un humano o ya está descartado.
export const STAGES_SIN_SEGUIMIENTO = ['no_interesado', 'deposito_pendiente', 'reservado', 'hospedado', 'completado']

// Meta solo deja mandar texto libre dentro de las 24h desde el último mensaje
// del lead: la ventana tiene que cerrar antes de eso.
export const SEGUIMIENTO_MIN_HORAS = 10
export const SEGUIMIENTO_MAX_HORAS = 23

// No mandar seguimientos de madrugada (CDMX = UTC-6 fijo desde 2022).
export function esHorarioDeSeguimiento(ahora: Date): boolean {
  const horaCDMX = (ahora.getUTCHours() + 18) % 24
  return horaCDMX >= 8 && horaCDMX < 21
}
