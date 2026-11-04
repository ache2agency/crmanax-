import { calcularNochesFase2, precioTotalEstimado, tipoRentaDesdeFechas, tiposAdecuadosParaPersonas } from './whatsapp/fase2-disponibilidad'

export type BusquedaEstancia = { entrada: string; salida: string; personas: number }
export type OpcionLoft = { id: string; nombre: string; tipo: 'chico' | 'mediano' | 'grande'; capacidad: number; metros: number; noche: number; mes: number; estimado: number; tipoRenta: 'noche' | 'mes' }
export function validarBusqueda(b: BusquedaEstancia, hoy: string, limite: string) {
  const real = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v
  if (!real(b.entrada) || !real(b.salida)) return 'Elige fechas válidas de entrada y salida.'
  if (b.entrada < hoy) return 'La entrada debe ser hoy o una fecha posterior.'
  if (b.salida <= b.entrada) return 'La salida debe ser posterior a la entrada.'
  if (b.salida > limite) return 'Puedes consultar estancias dentro de los próximos 12 meses.'
  if (!Number.isInteger(b.personas) || b.personas < 1 || b.personas > 6) return 'Elige entre 1 y 6 huéspedes.'
  return null
}
export function opcionLoft(loft: { id: string; nombre: string; tipo: string }, b: BusquedaEstancia): OpcionLoft | null {
  if (!tiposAdecuadosParaPersonas(b.personas).includes(loft.tipo as OpcionLoft['tipo'])) return null
  const tipo = loft.tipo as OpcionLoft['tipo']
  const tipoRenta = tipoRentaDesdeFechas(b.entrada, b.salida)
  const precio = (renta: 'noche' | 'mes', noches: number) => precioTotalEstimado({ tipoRenta: renta, tipoLoft: tipo, personas: b.personas, noches }).monto
  return { id: loft.id, nombre: loft.nombre, tipo, capacidad: tipo === 'chico' ? 1 : 2, metros: tipo === 'chico' ? 16 : tipo === 'mediano' ? 24 : 32, noche: precio('noche', 1), mes: precio('mes', 1), tipoRenta, estimado: precio(tipoRenta, calcularNochesFase2(b.entrada, b.salida)) }
}

export function motorPreviewHabilitado() {
  return process.env.MOTOR_RESERVAS_PREVIEW === '1' && (process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV === 'development')
}
