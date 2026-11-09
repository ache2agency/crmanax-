import { createServiceRoleClient } from '@/utils/supabase/server'
import { crearLectura } from './servicio'

export const lectura = crearLectura({
  client: createServiceRoleClient,
  token: () => process.env.LECTURA_TOKEN,
})
