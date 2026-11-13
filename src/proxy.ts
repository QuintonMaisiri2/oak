import { AUTH_COOKIE_OPTIONS, isStaffUserAsync } from "@/lib/auth/policy";
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-current-path', pathname);

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (pathname.startsWith('/admin')) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('your-project'));

    let isAuthenticated = false;

    if (isSupabaseConfigured) {
      // Secure Supabase Session Check
      const supabase = createServerClient(supabaseUrl!, supabaseAnonKey!, {
        cookieOptions: AUTH_COOKIE_OPTIONS,
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({
              request: { headers: requestHeaders },
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, { ...options, ...AUTH_COOKIE_OPTIONS })
            );
          },
        },
      });

      const { data: { user } } = await supabase.auth.getUser();
      
      // Enforce admin rule: verified email + allowed domain + active admin_users record
      if (user) {
        isAuthenticated = await isStaffUserAsync(user);
      }
    }

    if (
      pathname === '/admin/login' || 
      pathname === '/admin/set-password' ||
      pathname === '/admin/programme' ||
      pathname.startsWith('/admin/programme/')
    ) {
      if (isAuthenticated && (pathname === '/admin/login' || pathname === '/admin/set-password')) {
        const nextUrl = request.nextUrl.searchParams.get('next') || '/admin';
        return NextResponse.redirect(new URL(nextUrl, request.url));
      }
      return response;
    }

    if (!isAuthenticated) {
      // Unauthenticated user attempting to access admin area: redirect to login
      const loginUrl = new URL('/admin/login', request.url);
      if (pathname !== '/admin') {
        loginUrl.searchParams.set('next', pathname);
      }
      const denied = NextResponse.redirect(loginUrl);
      response.cookies.getAll().forEach(cookie => denied.cookies.set(cookie));
      return denied;
    }
  }

  return response;
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
