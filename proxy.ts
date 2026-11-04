import { NextResponse, type NextRequest } from 'next/server'

// El preview de aprobación expone solo el prototipo. El CRM productivo no cambia.
export function proxy(request: NextRequest) {
  if (process.env.MOTOR_RESERVAS_PREVIEW !== '1' || process.env.VERCEL_ENV !== 'preview') return NextResponse.next()
  const path = request.nextUrl.pathname
  if (path === '/') return NextResponse.redirect(new URL('/reservar', request.url))
  if (path === '/reservar' || path === '/api/motor-reservas' || path.startsWith('/_next/') || path.startsWith('/estancias/')) {
    const response = NextResponse.next()
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
    return response
  }
  return new NextResponse(null, { status: 404 })
}
export const config = { matcher: '/:path*' }
