import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { Resend } from 'resend'

const DIAS_ENVIO = [1, 7, 14, 21, 28, 35, 42]
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

function placeholderAsunto(dia: number, nombre: string) {
  return `Instituto Windsor – Seguimiento día ${dia}${nombre ? ` – Hola ${nombre}` : ''}`
}

function placeholderContenido(dia: number, nombre: string) {
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'
  return `${saludo}\n\nEste es el día ${dia} de tu secuencia de seguimiento con Instituto Windsor.\n\n(Contenido placeholder – personalizar después.)\n\nSaludos,\nEquipo Instituto Windsor`
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { lead_id, email, nombre } = body as { lead_id?: string; email?: string; nombre?: string }

    if (!lead_id || !email?.trim()) {
      return NextResponse.json(
        { error: 'lead_id y email son obligatorios' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const rows = DIAS_ENVIO.map((dia_envio) => ({
      lead_id,
      email: email.trim(),
      nombre: nombre?.trim() || null,
      dia_envio,
      asunto: placeholderAsunto(dia_envio, nombre?.trim() || ''),
      contenido: placeholderContenido(dia_envio, nombre?.trim() || ''),
      enviado: false,
    }))

    const { data: inserted, error: insertError } = await supabase
      .from('email_sequences')
      .insert(rows)
      .select('id, dia_envio')

    if (insertError) {
      return NextResponse.json(
        { error: 'Error creando secuencia', detail: insertError.message },
        { status: 500 }
      )
    }

    const firstRow = inserted?.find((r) => r.dia_envio === 1)
    if (!firstRow) {
      return NextResponse.json({ ok: true, message: 'Secuencia creada (sin envío inmediato)' })
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { ok: true, message: 'Secuencia creada. Configura RESEND_API_KEY para envío inmediato.' }
      )
    }

    const resend = new Resend(apiKey)
    const firstContent = rows.find((r) => r.dia_envio === 1)!
    const { error: sendError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [email.trim()],
      subject: firstContent.asunto,
      text: firstContent.contenido,
    })

    if (sendError) {
      return NextResponse.json(
        { ok: true, message: 'Secuencia creada. Error enviando primer correo.', detail: String(sendError) }
      )
    }

    await supabase
      .from('email_sequences')
      .update({ enviado: true, fecha_envio: new Date().toISOString() })
      .eq('id', firstRow.id)

    return NextResponse.json({ ok: true, message: 'Secuencia creada y primer correo enviado' })
  } catch (e) {
    return NextResponse.json(
      { error: 'Error en secuencia de emails', detail: String(e) },
      { status: 500 }
    )
  }
}
