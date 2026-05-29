import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Holder Supabase-innloggingen "fersk" på hver forespørsel, og sender
 * uinnloggede brukere til /login. Kalles fra proxy.ts (Next.js 16).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Viktig: getUser() validerer token mot Supabase og fornyer cookien.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Uinnlogget? Send til /login (bortsett fra selve /login-siden og den
  // offentlige stemplingssiden /stemple som sjåfører bruker uten innlogging).
  const pathname = request.nextUrl.pathname;
  if (
    !user &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/stemple")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
