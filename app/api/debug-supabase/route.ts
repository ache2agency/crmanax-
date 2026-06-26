import { createServiceRoleClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const results: Record<string, unknown> = {}

  try {
    const supabase = createServiceRoleClient()
    results.supabase_client = 'OK'

    // Test 1: select conversaciones
    const { data: convs, error: selectError } = await supabase
      .from('whatsapp_conversaciones')
      .select('id, whatsapp, fase, estado')
      .limit(5)
    results.select_conv = selectError ? { error: selectError } : { count: convs?.length, rows: convs }

    // Test 2: insert de prueba
    const { data: inserted, error: insertError } = await supabase
      .from('whatsapp_conversaciones')
      .insert([{ whatsapp: '+52_test_debug', estado: 'abierta', fase: 'saludo' }])
      .select('id')
      .maybeSingle()
    results.insert_conv = insertError ? { error: insertError } : { ok: true, id: inserted?.id }

    // Limpiar si se insertó
    if (inserted?.id) {
      await supabase.from('whatsapp_conversaciones').delete().eq('id', inserted.id)
      results.cleanup = 'OK'
    }

    // Test 3: env vars
    results.env = {
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
      service_role_key: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
      meta_phone_number_id: process.env.META_PHONE_NUMBER_ID || 'MISSING',
      meta_waba_id: process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID || 'MISSING',
    }

  } catch (e) {
    results.fatal_error = String(e)
  }

  return NextResponse.json(results, { status: 200 })
}
