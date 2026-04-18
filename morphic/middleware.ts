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
    // Not logged in → send to login
    if (!token) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
    // Has a real role now → send to home (role was updated by admin)
    if (token.role && token.role !== 'unassigned') {
      return NextResponse.redirect(new URL('/', request.url))
    }
    // Still unassigned → show the pending page
    return NextResponse.next()
  }

  // ── Global Unassigned User Check ────────────────────────────
  // If the user is unassigned, restrict access to the dashboard/chat routes only.
  // They will be blocked by a dialog overlay in the chat UI.
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
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
    '/admin/:path*',
    '/dashboard/:path*',
    '/search/:path*',
  ],
}
