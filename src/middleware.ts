import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Exclure les routes API du middleware (elles gèrent leur propre authentification)
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return res;
  }

  // Routes publiques (splash, login)
  const publicRoutes = ['/splash', '/auth/login'];
  const isPublicRoute = publicRoutes.some((route) =>
    req.nextUrl.pathname === route || req.nextUrl.pathname.startsWith(route)
  );

  // Routes protégées
  const protectedRoutes = ['/dashboard', '/billing', '/accounting', '/expenses', '/administration', '/courriers', '/archives', '/users', '/settings'];
  const isProtectedRoute = protectedRoutes.some((route) =>
    req.nextUrl.pathname.startsWith(route)
  );

  // Routes d'authentification
  const authRoutes = ['/auth/login'];
  const isAuthRoute = authRoutes.some((route) =>
    req.nextUrl.pathname.startsWith(route)
  );

  // Laisser passer les routes publiques
  if (isPublicRoute) {
    return res;
  }

  // Rediriger vers login si non authentifié et route protégée
  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL('/auth/login', req.url));
  }

  // Rediriger vers dashboard si authentifié et sur route d'auth
  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - sw.js (service worker)
     * - manifest.json (PWA manifest)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

