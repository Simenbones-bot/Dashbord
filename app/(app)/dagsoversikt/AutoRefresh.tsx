"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Kaller router.refresh() hvert minutt slik at server-komponenten henter
// ferske data uten full side-reload (Next.js App Router soft refresh).
export default function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
