import { createClient } from "@supabase/supabase-js";

/**
 * Server-klient med "service role"-nøkkel. Går UTENOM Row Level Security,
 * så den MÅ kun brukes på serveren (server actions / server-komponenter) og
 * alltid med streng avgrensning i koden.
 *
 * Brukes av den offentlige stemplingssiden (/stemple), som ikke har en
 * innlogget bruker, men som alltid er låst til én bils data via koden i URL-en.
 *
 * Krever miljøvariabelen SUPABASE_SERVICE_ROLE_KEY (kun på server, ALDRI
 * NEXT_PUBLIC_). Legges inn i Vercel og i .env.local.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Mangler NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
