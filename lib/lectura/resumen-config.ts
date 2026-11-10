import type { ConfigResumen } from './resumen'

export const configuracionResumen: ConfigResumen = {
  "crm": "Anaxágoras",
  etapas: {
    "nuevo_contacto": "Nuevo contacto",
    "cotizado": "Cotizado",
    "deposito_pendiente": "Deposito pendiente",
    "reservado": "Reservado",
    "hospedado": "Hospedado",
    "completado": "Completado",
    "no_interesado": "No interesado"
  },
  legacy: {
    "interesado": "nuevo_contacto",
    "en_proceso": "cotizado",
    "rentado": "completado",
    "nuevo": "nuevo_contacto",
    "contactado": "nuevo_contacto",
    "propuesta": "cotizado",
    "cerrado": "completado",
    "inscrito": "completado",
    "perdido": "no_interesado",
    "archivado": "no_interesado",
    "primer_contacto": "nuevo_contacto",
    "examen_ubicacion": "cotizado",
    "clase_muestra": "cotizado",
    "segundo_contacto": "cotizado",
    "promocion_enviada": "cotizado",
    "tercer_contacto": "cotizado",
    "inscripcion_pendiente": "deposito_pendiente"
  },
  "internos": [],
  "leadSelect": "id,nombre,loft_id,stage,created_at",
  "calientes": [
    "deposito_pendiente",
    "reserva",
    "reservar"
  ],
  "finales": [
    "reservado",
    "hospedado",
    "completado",
    "no_interesado"
  ],
  "logros": [
    "reservado"
  ],
  "archivados": [
    "no_interesado"
  ],
  "etiquetas": {
    "sin_iniciar": "Sin iniciar",
    "saludo": "Saludo",
    "programa": "Programa",
    "correo": "Correo",
    "info_enviada": "Info enviada",
    "dudas": "Dudas",
    "accion": "Acción",
    "seguimiento": "Seguimiento",
    "cerrado": "Cerrado",
    "perdido": "Perdido",
    "confirmar_interes": "Esperando confirmación de precio",
    "no_interesado": "Descartado por precio",
    "nombre": "Nombre",
    "precios": "Precios",
    "fechas": "Fechas",
    "personas": "Personas",
    "disponibilidad": "Disponibilidad",
    "esperando_asesor": "Esperando asesor",
    "confirmado": "Confirmado",
    "tipo_renta": "Tipo de renta",
    "checkin": "Llegada",
    "checkout": "Salida",
    "tipo_loft": "Tipo de loft",
    "confirmar_precios": "Esperando confirmación de precios"
  }
}
