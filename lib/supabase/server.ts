import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase-klient for serveren (server-komponenter, route handlers).
 * Brukes når kode kjører på Vercel/serveren. Den leser og skriver
 * innloggings-informasjon via cookies, slik at brukeren forblir innlogget.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Kan kalles fra en server-komponent der cookies ikke kan skrives.
            // Da håndteres oppdatering av sesjon i en proxy/middleware senere.
          }
        },
      },
    },
  );
}
