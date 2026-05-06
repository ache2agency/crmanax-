import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  // Redirige siempre a /login en el mismo dominio (producción o local),
  // evitando depender de NEXT_PUBLIC_SITE_URL o localhost:3000.
  const redirectUrl = new URL('/login', request.url)
  return NextResponse.redirect(redirectUrl)
}