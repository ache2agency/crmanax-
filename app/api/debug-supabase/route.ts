import { createServiceRoleClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = createServiceRoleClient()
    const { searchParams } = new URL(request.url)
    const numero = searchParams.get('numero') // ej: 028306

    // Traer conversaciones filtrando por número si se pasa
    let query = supabase
      .from('whatsapp_conversaciones')
      .select('id, whatsapp, fase, estado, created_at, ultimo_mensaje_at')
      .order('created_at', { ascending: false })
      .limit(10)

    if (numero) {
      query = query.ilike('whatsapp', `%${numero}%`)
    }

    const { data: convs } = await query

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
