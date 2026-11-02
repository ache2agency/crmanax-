import { NextResponse } from 'next/server'
import { actualizarMonitorReservas } from '@/lib/reservas/monitor'

// Puede programarse aparte del sync para detectar que éste dejó de ejecutarse.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try { return NextResponse.json(await actualizarMonitorReservas()) }
  catch { return NextResponse.json({ error: 'Falló el monitor de disponibilidad' }, { status: 500 }) }
}
