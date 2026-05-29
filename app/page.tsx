import { redirect } from "next/navigation";

// Forsiden sender videre til dagsoversikten.
// (Uinnloggede blir sendt til /login av proxy.ts.)
export default function Home() {
  redirect("/dagsoversikt");
}
