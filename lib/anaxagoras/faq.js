// Detección determinista de las preguntas con texto aprobado. No cambia fases.
export function detectarFaqAprobada(texto) {
  const t = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (/persona(?:s)?\s+(?:extra|adicional)|(?:extra|adicional).{0,20}persona|visita.{0,35}(?:qued|dorm|aloj|noche)|(?:qued|dorm|aloj).{0,35}(?:visita|invitad)/.test(t)) return 'persona_adicional'
  if (/mascota|pet\s*friendly|petfriendly|perr[oa]|gat[oa]/.test(t)) return 'mascotas'
  if (/\b(?:impuestos?|iva|factura\w*)\b|\bi\.?\s*v\.?\s*a\./.test(t)) return 'impuestos'
  if (/comprobantes?.{0,25}ingres|estados? de cuenta|saldos? promedio/.test(t)) return 'comprobante_ingresos'
  if (/check\s*[- ]?\s*(?:in|out)\b|(?:horario|hora).{0,50}(?:entr|salir|salida|lleg)|(?:entr|lleg).{0,35}(?:temprano|8\s*(?:am|a\.m)|ocho|manana)/.test(t)) return 'entrada_salida'
  if (/puedo.{0,20}(?:ir|pasar).{0,15}(?:ver|conocer)|visitar|visitas?|cita.*(?:ver|conocer)|(?:ver|conocer).{0,20}(?:lugar|instalaciones)/.test(t)) return 'visitas'
  if (/areas? comunes|parrilla|cocina|jacuzzi|lavanderia/.test(t) || (/terraza/.test(t) && !/roof|evento|fiesta|rentar/.test(t))) return 'areas_comunes'
  if (/contrato.{0,30}(?:mensual|por mes|arrendamiento|ano|anual)|(?:renta|rentas|rentar|contrato|busco|buscando).{0,40}(?:anual|por (?:un )?ano|largo plazo|permanente|tradicional)/.test(t)) return 'contrato_mensual'
  if (/(?:otra|otras|unica|sucursal).{0,25}(?:ubicacion|ciudad|sucursal)|(?:tienen|estan|hay|ubicacion).{0,25}(?:monterrey|guadalajara|puebla|queretaro|toluca|otra ciudad)/.test(t)) return 'ubicacion_unica'
  if (/que.{0,20}(?:datos|necesitas).{0,25}(?:cotiz|precio)|como.{0,20}cotiz/.test(t)) return 'pedir_fechas'
  return null
}
