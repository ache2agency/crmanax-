import { createServiceRoleClient } from '@/utils/supabase/server'
import { crearLectura } from './servicio'
import { crearResumen } from './resumen'
import { configuracionResumen } from './resumen-config'

export const lectura = crearLectura({
  client: createServiceRoleClient,
  resumen: crearResumen(configuracionResumen),
  token: () => process.env.LECTURA_TOKEN,
})
