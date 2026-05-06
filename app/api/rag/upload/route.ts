import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const maxDuration = 60

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

function splitIntoChunks(text: string, wordsPerChunk = 500): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(' '))
  }
  return chunks
}

export async function POST(request: Request) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Falta configurar OPENAI_API_KEY' }, { status: 500 })
    }

    let contenido = ''
    let titulo = ''

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      if (!file) {
        return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
      }
      titulo = file.name
      const buffer = Buffer.from(await file.arrayBuffer())
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse')
      const parsed = await pdfParse(buffer)
      contenido = parsed.text
    } else {
      const body = await request.json()
      contenido = body.contenido || ''
      titulo = body.titulo || ''
    }

    if (!contenido.trim()) {
      return NextResponse.json({ error: 'El contenido está vacío' }, { status: 400 })
    }

    const chunks = splitIntoChunks(contenido.trim(), 500)

    // Timeout de seguridad para evitar que la petición a OpenAI se quede colgada
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120000) // 2 minutos

    const embeddingRes = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: 'text-embedding-ada-002', input: chunks }),
      signal: controller.signal,
    }).catch((e: any) => {
      if (e?.name === 'AbortError') {
        throw new Error('Timeout llamando a OpenAI embeddings (upload)')
      }
      throw e
    })

    clearTimeout(timeout)

    if (!embeddingRes.ok) {
      const detail = await embeddingRes.text()
      return NextResponse.json({ error: 'Error generando embeddings', detail }, { status: 500 })
    }

    const embeddingData = await embeddingRes.json()
    const vectors: number[][] = embeddingData.data?.map((d: any) => d.embedding) || []

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const rows = chunks.map((chunk, idx) => ({
      titulo: titulo || null,
      contenido: chunk,
      embedding: vectors[idx],
    }))

    const { error: insertError } = await supabase.from('documentos').insert(rows)
    if (insertError) {
      return NextResponse.json({ error: 'Error guardando documentos', detail: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, chunks_indexed: chunks.length, titulo })
  } catch (e) {
    console.error('[RAG upload] error:', e)
    return NextResponse.json({ error: 'Error procesando carga', detail: String(e) }, { status: 500 })
  }
}
