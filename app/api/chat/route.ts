import { NextResponse } from 'next/server'

const SYSTEM_PROMPT =
  'Eres un asistente comercial para Instituto Windsor. Ayudas al equipo de admisiones y seguimiento a priorizar prospectos, dar mejor acompañamiento y convertir interesados en alumnos. Cuando te compartan información de leads, analiza el contexto y da recomendaciones concretas.'

export async function POST(request: Request) {
  try {
    const { messages, leads } = await request.json()

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Falta configurar OPENAI_API_KEY en el servidor.' },
        { status: 500 }
      )
    }

    const contextSnippet = leads
      ? JSON.stringify(leads).slice(0, 6000)
      : 'Sin leads cargados todavía.'

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'system',
            content: `Contexto de leads actuales (JSON recortado): ${contextSnippet}`,
          },
          ...(Array.isArray(messages) ? messages : []),
        ],
        temperature: 0.4,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: 'Error al llamar a OpenAI', detail: errorText },
        { status: 500 }
      )
    }

    const data = await response.json()
    const reply = data?.choices?.[0]?.message

    if (!reply) {
      return NextResponse.json(
        { error: 'Respuesta vacía de OpenAI' },
        { status: 500 }
      )
    }

    return NextResponse.json({ reply })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Error procesando la solicitud de chat', detail: String(error) },
      { status: 500 }
    )
  }
}
