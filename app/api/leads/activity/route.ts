import { NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const payload = (await request.json()) as {
      lead_id?: string
      event_type?: string
      title?: string
      detail?: string
      meta?: Record<string, unknown>
    }

    if (!payload.lead_id || !payload.event_type || !payload.title) {
      return NextResponse.json(
        { error: 'lead_id, event_type y title son obligatorios' },
        { status: 400 }
      )
    }

    const service = createServiceRoleClient()
    const { data, error } = await service
      .from('lead_activities')
      .insert([
        {
          lead_id: payload.lead_id,
          actor_id: user.id,
          event_type: payload.event_type,
          title: payload.title,
          detail: payload.detail || '',
          meta: payload.meta || {},
        },
      ])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ activity: data })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
