import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase-klient for nettleseren (klientkomponenter).
 * Brukes når kode kjører i brukerens nettleser, f.eks. innloggingsskjema.
 * Leser de offentlige nøklene som er trygge å sende til nettleseren
 * (de er beskyttet av Row Level Security i databasen).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
