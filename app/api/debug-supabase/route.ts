import { createServiceRoleClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createServiceRoleClient()

    // Traer las últimas 3 conversaciones con sus mensajes
    const { data: convs } = await supabase
      .from('whatsapp_conversaciones')
      .select('id, whatsapp, fase, estado, created_at, ultimo_mensaje_at')
      .order('created_at', { ascending: false })
      .limit(3)

    const results = []
    for (const conv of convs || []) {
      const { data: msgs } = await supabase
        .from('whatsapp_mensajes')
        .select('rol, contenido, created_at')
        .eq('conversacion_id', conv.id)
        .order('created_at', { ascending: true })

      results.push({ conv, mensajes: msgs || [] })
    }

    return NextResponse.json(results, { status: 200 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 200 })
  }
}
