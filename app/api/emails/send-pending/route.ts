import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { Resend } from 'resend'

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

export async function GET() {
  return sendPendingEmails()
}

export async function POST() {
  return sendPendingEmails()
}

async function sendPendingEmails() {
  try {
    const supabase = await createClient()
    const today = new Date().toISOString().slice(0, 10)

    const { data: pending, error: fetchError } = await supabase
      .from('email_sequences')
      .select('id, email, nombre, dia_envio, asunto, contenido, created_at')
      .eq('enviado', false)

    if (fetchError) {
      return NextResponse.json(
        { error: 'Error leyendo pendientes', detail: fetchError.message },
        { status: 500 }
      )
    }

    const dueToday: typeof pending = []
    for (const row of pending || []) {
      const created = row.created_at?.slice(0, 10) || ''
      if (!created) continue
      const dueDate = new Date(created)
      dueDate.setDate(dueDate.getDate() + (row.dia_envio || 0))
      const dueStr = dueDate.toISOString().slice(0, 10)
      if (dueStr <= today) dueToday.push(row)
    }

    if (dueToday.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, message: 'No hay correos pendientes para hoy' })
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Falta RESEND_API_KEY' },
        { status: 500 }
      )
    }

    const resend = new Resend(apiKey)
    let sent = 0
    const errors: string[] = []

    for (const row of dueToday) {
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: [row.email],
        subject: row.asunto,
        text: row.contenido,
      })
      if (error) {
        errors.push(`${row.id}: ${String(error)}`)
        continue
      }
      await supabase
        .from('email_sequences')
        .update({ enviado: true, fecha_envio: new Date().toISOString() })
        .eq('id', row.id)
      sent++
    }

    return NextResponse.json({
      ok: true,
      sent,
      total: dueToday.length,
      errors: errors.length ? errors : undefined,
    })
  } catch (e) {
    return NextResponse.json(
      { error: 'Error enviando pendientes', detail: String(e) },
      { status: 500 }
    )
  }
}
