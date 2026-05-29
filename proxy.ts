import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/update-session";

// I Next.js 16 heter "middleware" nå "proxy". Kjorer for hver forespørsel.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Kjor for alle stier UNNTATT:
     * - _next/static, _next/image (Next.js sine egne filer)
     * - favicon og bildefiler
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
