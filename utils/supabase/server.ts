import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        // En Server Components de Next.js, modificar cookies directamente
        // causa el error "Cookies can only be modified in a Server Action or Route Handler".
        // Para evitarlo aquí, ignoramos los intentos de escritura.
        setAll() {
          // no-op en este contexto
        },
      },
    }
  )
}

// Cliente con service role para tareas de backend (ej. RAG) que necesitan ignorar RLS.
// IMPORTANTE: Usa una env privada como SUPABASE_SERVICE_ROLE_KEY; no expongas esta key en el frontend.
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY (o NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) en el entorno')
  }

  return createSupabaseClient(url, serviceRoleKey)
}
