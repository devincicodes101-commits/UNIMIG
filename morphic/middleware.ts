import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { UserRole } from '@/lib/auth'

// ─────────────────────────────────────────────
// Route Configuration
// ─────────────────────────────────────────────
const publicRoutes = ['/auth/login', '/auth/register', '/auth/error']
const adminOnlyRoutes = ['/admin']

// Roles that are allowed to access the main chat/dashboard
const allowedRoles: UserRole[] = [
  'admin',
  'management',
  'sales',
  'support',
  'operations',
  'accounting',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Let /api/python/* pass through to vercel.json rewrites ────────
  if (pathname.startsWith('/api/python')) {
    return NextResponse.next()
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  const isPublicRoute = publicRoutes.some(route => pathname === route)
  const isAdminRoute = adminOnlyRoutes.some(route => pathname.startsWith(route))

  // ── Redirect unauthenticated users to login ─────────────────
  if (pathname === '/' && !token) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // ── Prevent authenticated users from re-visiting login/register
  if ((pathname === '/auth/login' || pathname === '/auth/register') && token) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // ── Admin-only routes ───────────────────────────────────────
  if (isAdminRoute) {
    if (!token) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
    if (token.role !== 'admin') {
      return NextResponse.redirect(new URL('/?error=AccessDenied', request.url))
    }
  }

  // ── /auth/pending logic ─────────────────────────────────────
  if (pathname === '/auth/pending') {
    if (!token) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
    if (token.role && token.role !== 'unassigned') {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  // ── Global Unassigned User Check ────────────────────────────
  if (
    token &&
    !isPublicRoute &&
    pathname !== '/' &&
    !pathname.startsWith('/search/') &&
    token.role === 'unassigned'
  ) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // ── Root path ───────────────────────────────────────────────
  if (pathname === '/') {
    if (!token) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
    '/admin/:path*',
    '/dashboard/:path*',
    '/search/:path*',
  ],
}
