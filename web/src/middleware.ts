import { NextResponse, type NextRequest } from 'next/server'

const securityHeaders: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()',
  'X-DNS-Prefetch-Control': 'on',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value)
  }

  const path = request.nextUrl.pathname.toLowerCase()

  // Login must never be served from an old cached SPA shell (wheat crest + old copy).
  if (path === '/login') {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Clear-Site-Data', '"cache"')
  }

  // Block obvious probe paths early
  if (
    path.includes('wp-admin') ||
    path.includes('phpmyadmin') ||
    path.endsWith('.php') ||
    path.includes('/.env')
  ) {
    return new NextResponse('Not found', { status: 404 })
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
