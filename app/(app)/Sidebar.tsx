"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  href: string;
  ready: boolean; // false = skjerm ikke bygget ennaa
};

const NAV: NavItem[] = [
  { label: "Dagsoversikt", href: "/dagsoversikt", ready: true },
  { label: "Rutemaster", href: "/rutemaster", ready: true },
  { label: "Kunder", href: "/kunder", ready: true },
  { label: "Biler", href: "/biler", ready: true },
  { label: "Sjåfører", href: "/sjaforer", ready: true },
  { label: "Kontroll", href: "/kontroll", ready: false },
];

export default function Sidebar({
  unitName,
  unitCode,
  userName,
  roleLabel,
}: {
  unitName: string;
  unitCode: string;
  userName: string;
  roleLabel: string;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* ---------- Toppmeny for smale skjermer / mobil ---------- */}
      <header
        className="sticky top-0 z-40 border-b md:hidden"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <span
            className="text-base font-semibold tracking-tight"
            style={{ color: "var(--bring-green)" }}
          >
            Drift
          </span>
          <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
            {unitCode}
          </span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map((item) =>
            item.ready ? (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-full px-3 py-1.5 text-[13.5px] font-medium"
                style={{
                  backgroundColor:
                    pathname === item.href ? "var(--green-soft)" : "var(--background)",
                  color:
                    pathname === item.href
                      ? "var(--bring-green)"
                      : "var(--foreground)",
                }}
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.href}
                className="whitespace-nowrap rounded-full px-3 py-1.5 text-[13.5px] font-medium"
                style={{ color: "var(--text-tertiary)", backgroundColor: "var(--background)" }}
              >
                {item.label}
              </span>
            ),
          )}
        </nav>
      </header>

      {/* ---------- Sidemeny for skjerm (fra 768px) ---------- */}
      <aside
        className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r md:flex"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="px-5 py-5">
          <span
            className="text-lg font-semibold tracking-tight"
            style={{ color: "var(--bring-green)" }}
          >
            Drift
          </span>
        </div>

        <nav className="flex-1 px-3">
          {NAV.map((item) => {
            const active = pathname === item.href;
            if (!item.ready) {
              return (
                <span
                  key={item.href}
                  className="mb-1 flex items-center justify-between rounded-[10px] px-3 py-2.5 text-[14.5px] font-medium"
                  style={{ color: "var(--text-tertiary)", cursor: "default" }}
                  title="Kommer snart"
                >
                  {item.label}
                  <span className="text-[10px] uppercase tracking-wide">snart</span>
                </span>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className="mb-1 flex items-center rounded-[10px] px-3 py-2.5 text-[14.5px] font-medium transition-colors"
                style={{
                  backgroundColor: active ? "var(--green-soft)" : "transparent",
                  color: active ? "var(--bring-green)" : "var(--foreground)",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-2 border-t p-3" style={{ borderColor: "var(--border)" }}>
          <div
            className="rounded-[10px] px-3 py-2.5"
            style={{ backgroundColor: "var(--background)" }}
          >
            <p className="text-[13px] font-semibold">{unitName}</p>
            <p className="text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
              {unitCode}
            </p>
          </div>
          <div className="flex items-center gap-2.5 px-1 py-1">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: "var(--bring-green)" }}
            >
              {userName.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">{userName}</p>
              <p className="text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
                {roleLabel}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
