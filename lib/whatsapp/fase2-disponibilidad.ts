export type TipoRenta = 'noche' | 'mes'
export type TipoLoft = 'chico' | 'mediano' | 'grande'

export type LoftCandidato = {
  id?: string
  nombre: string
  tipo: string
  orden?: number | null
}

export type ConsultaDisponibilidad = (params: {
  checkin: string
  checkout: string
  personas: number
}) => Promise<{ disponibles: LoftCandidato[]; ocupados: LoftCandidato[] }>

const PRIORIDAD_POR_PERSONAS: Record<'una' | 'dos', TipoLoft[]> = {
  una: ['chico', 'mediano', 'grande'],
  dos: ['mediano', 'grande'],
}

function formatFecha(fecha: string): string {
  if (!fecha) return '-'
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

export function calcularNochesFase2(checkin: string, checkout: string): number {
  if (!checkin || !checkout) return 0
  const d1 = new Date(`${checkin}T00:00:00Z`)
  const d2 = new Date(`${checkout}T00:00:00Z`)
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return 0
  const noches = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
  return noches > 0 ? noches : 0
}

export function tipoRentaDesdeFechas(checkin: string, checkout: string): TipoRenta {
  return calcularNochesFase2(checkin, checkout) >= 28 ? 'mes' : 'noche'
}

export function tiposAdecuadosParaPersonas(personas: number): TipoLoft[] {
  if (personas <= 1) return PRIORIDAD_POR_PERSONAS.una
  if (personas <= 2) return PRIORIDAD_POR_PERSONAS.dos
  return []
}

export function precioTotalEstimado({
  tipoRenta,
  tipoLoft,
  personas,
  noches,
}: {
  tipoRenta: TipoRenta
  tipoLoft: TipoLoft
  personas: number
  noches: number
}): { monto: number; texto: string } {
  if (tipoRenta === 'mes') {
    const monto =
      tipoLoft === 'chico'
        ? 12000
        : tipoLoft === 'grande'
          ? personas <= 1 ? 16000 : 18000
          : personas <= 1 ? 14000 : 16000
    return { monto, texto: `$${monto.toLocaleString('es-MX')} MXN/mes` }
  }

  const porNoche = tipoLoft === 'chico' ? 700 : tipoLoft === 'grande' ? 900 : 800
  const monto = porNoche * Math.max(noches, 1)
  return {
    monto,
    texto: `$${monto.toLocaleString('es-MX')} MXN (${noches} noche${noches !== 1 ? 's' : ''} × $${porNoche})`,
  }
}

export function nombreTipoLoft(tipo: string): string {
  if (tipo === 'chico') return 'Loft Chico'
  if (tipo === 'mediano') return 'Loft Mediano'
  if (tipo === 'grande') return 'Loft Grande'
  return tipo || 'Loft'
}

function tipoNormalizado(tipo: string | null | undefined): TipoLoft | null {
  const t = (tipo || '').toLowerCase()
  if (t === 'chico' || t === 'mediano' || t === 'grande') return t
  return null
}

export function elegirLoftDisponible(disponibles: LoftCandidato[], personas: number): LoftCandidato | null {
  const tipos = tiposAdecuadosParaPersonas(personas)
  for (const tipo of tipos) {
    const loft = disponibles.find((l) => tipoNormalizado(l.tipo) === tipo)
    if (loft) return loft
  }
  return null
}

export function tiposDisponiblesTexto(disponibles: LoftCandidato[], personas: number): string {
  const permitidos = new Set(tiposAdecuadosParaPersonas(personas))
  const tipos = Array.from(new Set(
    disponibles
      .map((l) => tipoNormalizado(l.tipo))
      .filter((t): t is TipoLoft => !!t && permitidos.has(t))
  ))
  if (!tipos.length) return ''
  return tipos.map(nombreTipoLoft).join(', ')
}

async function sugerirFechaCercana({
  checkin,
  checkout,
  personas,
  consultar,
}: {
  checkin: string
  checkout: string
  personas: number
  consultar: ConsultaDisponibilidad
}): Promise<{ checkin: string; checkout: string; tipos: string } | null> {
  const noches = calcularNochesFase2(checkin, checkout)
  if (!noches) return null
  const base = new Date(`${checkin}T00:00:00Z`)
  for (let offset = 1; offset <= 30; offset += 1) {
    const ci = new Date(base.getTime())
    ci.setUTCDate(ci.getUTCDate() + offset)
    const co = new Date(ci.getTime())
    co.setUTCDate(co.getUTCDate() + noches)
    const ciISO = ci.toISOString().slice(0, 10)
    const coISO = co.toISOString().slice(0, 10)
    const r = await consultar({ checkin: ciISO, checkout: coISO, personas })
    const tipos = tiposDisponiblesTexto(r.disponibles, personas)
    if (tipos) return { checkin: ciISO, checkout: coISO, tipos }
  }
  return null
}

export type ResultadoDisponibilidadFase2 =
  | { ok: true; response: string; alerta: string; loft: LoftCandidato; tipoRenta: TipoRenta; total: string }
  | { ok: false; response: string; alerta: string; tiposMismaFecha: string; sugerencia: { checkin: string; checkout: string; tipos: string } | null }

export async function resolverDisponibilidadFase2({
  nombre,
  whatsapp,
  checkin,
  checkout,
  personas,
  consultar,
}: {
  nombre: string
  whatsapp: string
  checkin: string
  checkout: string
  personas: number
  consultar: ConsultaDisponibilidad
}): Promise<ResultadoDisponibilidadFase2> {
  const noches = calcularNochesFase2(checkin, checkout)
  const tipoRenta = tipoRentaDesdeFechas(checkin, checkout)
  const disponibilidad = await consultar({ checkin, checkout, personas })
  const loft = elegirLoftDisponible(disponibilidad.disponibles, personas)

  if (loft) {
    const tipoLoft = tipoNormalizado(loft.tipo) || 'mediano'
    const total = precioTotalEstimado({ tipoRenta, tipoLoft, personas, noches }).texto
    const tipoTexto = nombreTipoLoft(tipoLoft)
    const response =
      `¡Sí tenemos disponibilidad estimada! 🙌\n\n` +
      `Para *${personas} persona${personas !== 1 ? 's' : ''}* del *${formatFecha(checkin)}* al *${formatFecha(checkout)}*, aparece disponible un *${tipoTexto}*.\n\n` +
      `💰 *Total estimado:* ${total}\n\n` +
      `Un asesor te confirma la disponibilidad y te ayuda a apartar. 🙌`
    const alerta =
      `🆕 *Lead con disponibilidad estimada*\n\n` +
      `👤 *Nombre:* ${nombre}\n` +
      `📱 *WhatsApp:* ${whatsapp}\n` +
      `📅 *Llegada:* ${formatFecha(checkin)}\n` +
      `📅 *Salida:* ${formatFecha(checkout)}\n` +
      `👥 *Personas:* ${personas}\n` +
      `🛏 *Loft sugerido:* ${tipoTexto}\n` +
      `💰 *Total estimado:* ${total}\n\n` +
      `Confirmar disponibilidad en Excel y apartar si procede.`
    return { ok: true, response, alerta, loft, tipoRenta, total }
  }

  const tiposMismaFecha = tiposDisponiblesTexto(disponibilidad.disponibles, personas)
  const sugerencia = tiposMismaFecha
    ? null
    : await sugerirFechaCercana({ checkin, checkout, personas, consultar })
  const alternativa = tiposMismaFecha
    ? `Para esas fechas podría revisar contigo otra opción: *${tiposMismaFecha}*.`
    : sugerencia
      ? `La fecha libre más cercana que veo es del *${formatFecha(sugerencia.checkin)}* al *${formatFecha(sugerencia.checkout)}* con: *${sugerencia.tipos}*.`
      : `No veo una alternativa libre cercana en los próximos días, pero un asesor puede revisar opciones manualmente.`

  const response =
    `Por ahora no veo disponibilidad estimada para *${personas} persona${personas !== 1 ? 's' : ''}* del *${formatFecha(checkin)}* al *${formatFecha(checkout)}*. 😕\n\n` +
    `${alternativa}\n\n` +
    `De todos modos, un asesor te contacta para confirmar y proponerte opciones.`
  const alerta =
    `🟠 *Lead sin disponibilidad estimada*\n\n` +
    `👤 *Nombre:* ${nombre}\n` +
    `📱 *WhatsApp:* ${whatsapp}\n` +
    `📅 *Llegada:* ${formatFecha(checkin)}\n` +
    `📅 *Salida:* ${formatFecha(checkout)}\n` +
    `👥 *Personas:* ${personas}\n` +
    `🛏 *Loft sugerido:* sin disponibilidad automática\n` +
    `💰 *Total estimado:* pendiente\n\n` +
    `Revisar fechas alternativas o confirmar manualmente.`
  return { ok: false, response, alerta, tiposMismaFecha, sugerencia }
}
