import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/suspended',
  '/banned',
];

const PUBLIC_ROUTES = [
  '/',
  ...AUTH_ROUTES,
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Basic check for auth token
  const hasToken = request.cookies.has('accessToken') || request.cookies.has('token');
  
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname === route);
  
  const isAuthRoute = AUTH_ROUTES.some(route => pathname === route);

  // If trying to access protected route without token → redirect to login
  if (!isPublicRoute && !hasToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If trying to access auth routes while already logged in → redirect to dashboard
  if (isAuthRoute && hasToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     * - Static assets (svg, png, jpg, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.ico$).*)',
  ],
};
