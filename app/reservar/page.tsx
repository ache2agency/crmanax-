import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { motorPreviewHabilitado } from '@/lib/motor-reservas'
import MotorReservas from './motor'
import './reservar.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Tu estancia · Anaxágoras 41', description: 'Encuentra tu loft en Piedad Narvarte, Ciudad de México.', robots: { index: false, follow: false } }
export default function Reservar() {
  if (!motorPreviewHabilitado()) notFound()
  return <MotorReservas />
}
