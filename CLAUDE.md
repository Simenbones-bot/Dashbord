# CLAUDE.md — Driftssystem for varebilselskap

Dette er instruksjonsfilen for prosjektet. Les hele filen før du gjør endringer.

---

## Om prosjektet

Et web- og mobilbasert driftssystem for et varebilselskap: planlegging av kjøring,
daglig oppfølging, innstempling med bilsjekk, kontroll mot lønn, bilpark og skadehåndtering.

**Mål-skala:** 50 enheter, 1 000 biler, 1 500 sjåfører.

---

## Viktig kontekst om meg som bygger dette

Jeg som eier prosjektet har **lite/ingen kodeerfaring**. Derfor:

- Forklar hva du gjør i **klartekst**, ikke bare kode.
- Jobb i **små steg**, én ting om gangen. Ikke bygg flere moduler samtidig.
- **Test underveis** og forklar hvordan jeg sjekker at noe virker.
- Ikke anta forkunnskap – si fra hvis jeg må gjøre noe utenfor editoren (f.eks. i Supabase).
- Foreslå alltid neste lille steg når du er ferdig.

---

## Teknologi (stack)

| Lag | Teknologi |
|---|---|
| Frontend + backend | Next.js (TypeScript) |
| Database, innlogging, lagring, tilgang | Supabase (PostgreSQL, Auth, Storage, Row Level Security) |
| Hosting | Vercel (app) + Supabase Cloud, **EU-region** (personopplysninger) |
| Sjåførgrensesnitt | Responsiv web i nettleser (ingen egen mobil-app i MVP) |

---

## Konvensjoner

- **Kode og database på engelsk**, uten æ/ø/å i navn (tabeller, kolonner, variabler).
- **All synlig brukertekst på norsk** (knapper, etiketter, meldinger).
- PC-først for ledere, mobilvennlig for sjåførens stempling.
- Dagsoversikt oppdateres ca. hvert minutt (polling – ikke websockets i MVP).
- Bilmerke/modell velges fra hardkodet liste (for god datakvalitet).

---

## Ordliste (norsk domene → engelsk i kode)

| Norsk | Kode/database |
|---|---|
| enhet | unit |
| region (= distrikt) | region |
| bil | vehicle |
| sjåfør | driver |
| sidemann | co_driver |
| kunde | customer |
| samlenavn (overordnet kunde) | parent_customer |
| rute | route |
| vakt/oppdrag | shift |
| stempling | time_entry |
| bilsjekk | vehicle_check |
| skadesak | damage_case |
| dagskontroll / lukke dag | day_closing |

---

## Tilgangsstyring (3 nivåer)

Styres i databasen med Row Level Security – en bruker ser aldri data utenfor sitt område.

| Nivå | Rolle | Ser data |
|---|---|---|
| 1 | Transportleder | egen enhet. Kan *foreslå* ruteendringer (godkjennes av nivå 2). |
| 2 | Regionsleder | alle enheter i egen region. *Godkjenner* endringer. |
| 3 | Executive Manager | alt + tilgangsstyring/admin. |

Forslag/godkjenning og lukking av dag skal logges (revisjonslogg).

---

## Datamodell

Hovedtabeller: region, unit, user, driver, vehicle, customer, route, shift,
time_entry, vehicle_check, photo, damage_case, day_closing.

Kjerneloop: `route → genererer shift (pr. dag) → driver stempler inn/ut + vehicle_check
→ dagsoversikt viser fargestatus → leder kontrollerer og lukker dagen (day_closing)`.

Full beskrivelse i `design-arkitektur.md` kapittel 5.

---

## MVP – bygg dette først (én enhet)

1. Innlogging + roller (enkelt)
2. Vehicle (opprette biler) + driver (sjåførregister)
3. Route (rutemaster) + generere shift, enkel ukesvisning
4. Stempling: inn/ut, **live kamera** (ikke opplasting fra galleri), bilsjekk, kommentar/avvik
5. Dagsoversikt med fargestatus
6. Kontroll: planlagt vs. faktisk, godkjenne og lukke dagen

**Fargestatus i dagsoversikt:**
grå = før start · grønn = stemplet innen 5 min · gul = 5–10 min uten stempling ·
rød + varseltrekant = >10 min uten stempling.

---

## IKKE med i MVP (bygges etterpå)

Økonomifilter + full Gantt med marginer · skadehåndtering (Kanban) · flere enheter/regioner ·
Executive-dashbord · sidemann, ekstraoppdrag, drag-and-drop · automatisk sletting av bilder (3 uker) ·
full GDPR-håndtering · lønnsintegrasjon.

---

## Viktige beslutninger

- Distrikt = region (samme begrep).
- Sjåfør stempler både **inn og ut**. Overtid = faktisk sluttid minus planlagt (fra ruten).
- Bilsjekk-bilder lagres i **3 uker**, deretter slettes de automatisk.
- Bilder tas kun med **live kamera**, ikke fra galleri.
- Lønn endres ikke – systemet skal kun *kontrollere* at sjåfør/tur ligger riktig i lønnssystemet (egen, senere fase).

---

## Status

- [x] Fase 1 – Kravspesifikasjon (ferdig)
- [x] Fase 2 – Design og arkitektur (ferdig)
- [x] M0 – Sette opp Next.js + Supabase + Vercel (ferdig: app deployet på Vercel, tilkoblet Supabase i EU-region)
- [x] M1 – Innlogging + masterdata (ferdig: Supabase Auth + RLS, enhet/biler/sjåfører)
- [x] M2 – Rutemaster + generere vakter (ferdig: kunde-/rute-/vakt-tabeller, kunder-, rute- og ukesvisning)
- [ ] M3 – Stempling + bilsjekk (mobil) (← neste)
- [ ] M4 – Dagsoversikt med fargestatus
- [ ] M5 – Kontroll + lukke dag → MVP ferdig

*Oppdater denne listen etter hvert som milepæler fullføres.*

---

## Kommandoer

- `npm install` – installer avhengigheter
- `npm run dev` – start utviklingsserver (http://localhost:3000)
- `npm run build` – produksjonsbygg (sjekker at alt kompilerer)
- `npm run lint` – kjør ESLint

Miljøvariabler ligger i `.env.local` (git-ignorert). Mal: `.env.local.example`.

---

## Kodestruktur og arbeidsmåte (oppdatert etter M1)

**Stack i praksis:** Next.js 16 (App Router, Turbopack), React 19, Tailwind v4,
Supabase via `@supabase/ssr`. Hosting: Vercel (auto-deploy ved push).

**Mappestruktur:**
- `app/login/` – innloggingsside (Supabase Auth, e-post/passord).
- `app/(app)/` – innlogget område med felles `layout.tsx` (sidemeny + topplinje).
  Rutegruppen `(app)` påvirker ikke URL-ene. Inneholder `Sidebar.tsx` og skjermene
  `dagsoversikt/`, `biler/`, `sjaforer/`.
- `app/auth/actions.ts` – `signOut`.
- `lib/supabase/` – `client.ts` (nettleser), `server.ts` (server), `update-session.ts`.
- `proxy.ts` – Next 16 sitt «middleware»: fornyer økt og sender uinnloggede til `/login`.
- `supabase/migrations/` – SQL-skjema (kjøres manuelt i Supabase, se under).
- `app/globals.css` – Bring-designtokens (farger som CSS-variabler), DM Sans-font.

**Mønster per skjerm (følg dette videre):**
- `page.tsx` = server-komponent som henter data med server-klienten.
- Skjema = klientkomponent (`"use client"`) som kaller en **server action** i
  `actions.ts`; action-en gjør insert/update og `revalidatePath(...)`.
- Hver rad knyttes til brukerens `unit_id` (hentet fra `profile`). RLS i databasen
  håndhever tilgang – aldri stol kun på UI.

**Statusverdier (enum i DB):** `vehicle.status` ∈ {`i_drift`,`ledig`,`pa_verksted`};
`driver.status` ∈ {`aktiv`,`inaktiv`}. Roller: `profile.role` ∈ {1,2,3}.

**Startdata:** én region «Oslo» + én enhet «Oslo Distribusjon» (`OSL-01`). Alle
auth-brukere kobles som rolle 1 (transportleder) til denne enheten (midlertidig –
ekte brukerstyring kommer senere).

## Viktig for utvikling (les før du jobber)

- **Eieren jobber kun i nettleseren** og kan ikke kjøre kommandoer/SQL lokalt.
  Forklar i klartekst, jobb i små steg, og si fra hva som må gjøres i Supabase/Vercel.
- **Databaseendringer:** lag en ny fil i `supabase/migrations/` OG gi eieren SQL-en
  til å lime inn i Supabase → SQL Editor. Agenten kan ikke kjøre SQL mot Supabase.
- **Nettverkssperre i agentmiljøet:** dette miljøet når ikke Supabase
  («Host not in allowlist»). Verifiser derfor med `npm run build` og `npm run lint`;
  faktisk datatest skjer på Vercel etter push.
- **Deploy:** push til arbeidsbranchen. Vercel sin produksjonsbranch må peke på den
  branchen for at nettsiden skal oppdatere seg (sjekk Vercel → Settings → Git).

---

## Referansedokumenter

- `kravspesifikasjon.md` – hva systemet skal gjøre
- `design-arkitektur.md` – hvordan det er bygget

---

## Next.js-spesifikke regler

Dette prosjektet bruker **Next.js 16 / React 19**. Se også `AGENTS.md` for viktige
advarsler om at API-er kan avvike fra eldre versjoner — les `node_modules/next/dist/docs/`
før du skriver Next.js-kode.
