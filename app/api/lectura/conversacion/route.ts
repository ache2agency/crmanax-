import { lectura } from '@/lib/lectura/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET(req: Request) { return lectura(req, true) }

// Next sintetiza HEAD desde GET; rechazarlo explícitamente sin leer la BD.
export function HEAD() { return new Response(null, { status: 405, headers: { Allow: 'GET', 'Cache-Control': 'no-store' } }) }

export const OPTIONS = HEAD
