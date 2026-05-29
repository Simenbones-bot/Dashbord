# Drift – Driftssystem for varebilselskap

Web- og mobilbasert driftssystem for et varebilselskap: planlegging av ruter,
daglig oppfølging, innstempling med bilsjekk, kontroll mot lønn, bilpark og
skadehåndtering.

**Mål-skala:** 50 enheter, 1 000 biler, 1 500 sjåfører.

## Teknologi

- **Next.js 16** (TypeScript, App Router) — frontend + backend
- **Supabase** — PostgreSQL-database, innlogging (Auth), tilgang (RLS), fillagring (Storage)
- **Vercel** — hosting (EU-region)

## Dokumentasjon

- `CLAUDE.md` – instruksjoner og status for prosjektet
- `kravspesifikasjon.md` – hva systemet skal gjøre
- `design-arkitektur.md` – hvordan det er bygget

## Kom i gang (utvikling)

1. Installer avhengigheter: `npm install`
2. Kopier `.env.local.example` til `.env.local` og fyll inn Supabase-nøklene dine.
3. Start utviklingsserver: `npm run dev` → åpne http://localhost:3000

Forsiden viser om appen får kontakt med Supabase.

## Status

Se gjeldende milepæl i `CLAUDE.md`. Nå: **M0 – oppsett (Next.js + Supabase + Vercel).**
