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
- [ ] M2 – Rutemaster + generere vakter (← neste)
- [ ] M3 – Stempling + bilsjekk (mobil)
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
Prosjektstruktur: `app/` (sider), `lib/supabase/` (database-/innloggingsklienter).

---

## Referansedokumenter

- `kravspesifikasjon.md` – hva systemet skal gjøre
- `design-arkitektur.md` – hvordan det er bygget

---

## Next.js-spesifikke regler

Dette prosjektet bruker **Next.js 16 / React 19**. Se også `AGENTS.md` for viktige
advarsler om at API-er kan avvike fra eldre versjoner — les `node_modules/next/dist/docs/`
før du skriver Next.js-kode.
