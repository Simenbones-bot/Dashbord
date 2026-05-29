# Design og arkitektur – Driftssystem for varebilselskap

**Versjon:** 1.0
**Fase:** 2 – Design og arkitektur
**Bygger på:** kravspesifikasjon.md v1.0

---

## 1. Utgangspunkt

| Rammebetingelse | Valg |
|---|---|
| Hvem bygger | Du selv, med Claude som koder. Lite/ingen kodeerfaring. |
| Drift | Sky (skalerbart). |
| Prioritet | Fungerende MVP raskt, men som tåler å vokse. |
| Skala (mål) | 50 enheter, 1 000 biler, 1 500 sjåfører. |

Konsekvens for designet: vi velger en «batteri-inkludert» teknologi der innlogging, database, tilgangsstyring og fillagring følger med ferdig, slik at det blir minst mulig kode å skrive og vedlikeholde.

---

## 2. Anbefalt teknologi

| Lag | Teknologi | Hvorfor |
|---|---|---|
| Frontend + backend | **Next.js** (TypeScript) | Ett språk for hele systemet – mindre å lære. Responsiv web dekker både PC (leder) og mobil (sjåfør). |
| Database, innlogging, lagring | **Supabase** | Gir PostgreSQL-database, innlogging, tilgangsstyring og fillagring ferdig. Dekker veldig mye av kravene uten egen kode. |
| Drift/hosting | **Vercel** (app) + **Supabase Cloud** (data) | Skydrift med enkel utrulling. Velg **EU-region** (norsk selskap, personopplysninger). |

**Hvorfor denne kombinasjonen passer deg:**
- Claude Code er svært god på akkurat denne stacken.
- Sjåførens «live kamera»-bilsjekk løses i nettleseren – **ingen egen mobil-app** trengs for MVP.
- Skalerer langt forbi tallene dine uten at du må bygge infrastruktur selv.

---

## 3. Hvordan stacken dekker kravene

| Krav | Løses av |
|---|---|
| Innlogging, 3 rollenivåer | Supabase Auth |
| Tilgang pr. enhet/region | Supabase **Row Level Security** (regler i databasen) |
| Bilsjekk-bilder, 3 ukers lagring | Supabase Storage + planlagt sletting |
| Live kamera | Nettleserens kamera-API (web) |
| Dagsoversikt oppdatert pr. minutt | Jevnlig henting (polling) – enkelt og nok |
| Gantt, dashbord, Kanban | Next.js-grensesnitt med ferdige komponentbibliotek |
| Lønnsintegrasjon (senere) | Next.js kaller lønnssystemets API |

---

## 4. Overordnet arkitektur

```
   [ Sjåfør – mobil i nettleser ]        [ Leder – PC i nettleser ]
              │                                    │
              └─────────────────┬──────────────────┘
                                │  HTTPS
                       ┌────────▼────────┐
                       │   Next.js-app    │   (hostet på Vercel)
                       │  grensesnitt+API │
                       └────────┬────────┘
                                │
                       ┌────────▼─────────────────────────────┐
                       │              Supabase                 │
                       │  • PostgreSQL  – all data             │
                       │  • Auth        – innlogging + roller  │
                       │  • RLS         – tilgang pr. enhet/reg │
                       │  • Storage     – bilsjekk-bilder       │
                       └────────┬──────────────────────────────┘
                                │  (senere fase)
                       ┌────────▼────────┐
                       │  Lønnssystem-API │
                       └─────────────────┘
```

---

## 5. Datamodell (startpunkt)

Hovedtabeller og hvordan de henger sammen. Feltene under er representative – vi forfiner dem når vi bygger.

- **region** – navn
- **enhet** – navn, `region_id`, faste_kostnader, driftskostnad_pr_time
- **bruker** – navn, e-post, rolle (1/2/3), tilknyttet enhet/region
- **sjåfør** – navn, `enhet_id`, innloggingsinfo (for stempling)
- **bil** – `enhet_id`, merke, modell *(hardkodet liste)*, reg.nr, leasingkost, servicekost, eu_kontroll_dato, service_dato, status
- **kunde** – navn, kundenummer, samlenavn (overordnet kunde), `enhet_id`
- **rute** – `enhet_id`, rutenavn, rutenummer, `bil_id`, `sjåfør_id`, `sidemann_id` *(valgfri)*, tur_km, tid, intervall (dager), inntekt_pr_time, `kunde_id`
- **vakt** – `rute_id`, dato, planlagt_start, planlagt_slutt, `bil_id`, `sjåfør_id`, status *(genereres fra rute, 1 uke frem)*
- **stempling** – `vakt_id`, `sjåfør_id`, type (inn/ut), tidspunkt, kommentar
- **bilsjekk** – `vakt_id`, kommentar, avvik (ja/nei)
- **bilde** – `bilsjekk_id`, fil-referanse, opprettet, slettes_dato (+3 uker)
- **skadesak** – `bil_id`, status (Kanban-kolonne), beskrivelse, opprettet, oppdatert
- **dagskontroll** – `enhet_id`, dato, status (åpen/lukket), godkjent_av

**Kjernesammenhengen (den daglige loopen):**
```
rute  →  genererer  →  vakt (pr. dag)  →  sjåfør stempler inn/ut + bilsjekk
                                       →  dagsoversikt viser fargestatus
                                       →  leder kontrollerer og lukker dagen
```

---

## 6. Tilgangsstyring

Tilgangen legges i databasen med Row Level Security, slik at en bruker aldri kan se data utenfor sitt ansvarsområde – uansett hvor i systemet de er:

| Nivå | Ser data der |
|---|---|
| 1 – Transportleder | `enhet_id` = brukerens enhet |
| 2 – Regionsleder | enhetens `region_id` = brukerens region |
| 3 – Executive | alt |

Forslag/godkjenning (nivå 1 → nivå 2) og lukking av dag logges i en revisjonslogg.

---

## 7. MVP-avgrensning (den tynne skiven)

For å få noe som **funker raskt**, bygger vi først den daglige driftsloopen for **én enhet**:

**MVP inneholder:**
1. Innlogging + roller (enkelt)
2. Bil Grandmaster – opprette biler (grunnleggende)
3. Sjåførregister
4. Rutemaster – opprette ruter + enkel ukesvisning
5. Dagsoversikt – fargestatus (grå/grønn/gul/rød)
6. Stempling – inn/ut, live kamera, bilsjekk, kommentar/avvik
7. Kontroll – se planlagt vs. faktisk, godkjenne og lukke dagen

**Kommer etter MVP:**
- Økonomifilter + full Gantt med marginer
- Skadehåndtering (Kanban)
- Flere enheter, regioner og Executive-dashbord
- Sidemann, ekstraoppdrag, drag-and-drop av biler
- Automatisk sletting av bilder (3 uker), full GDPR-håndtering
- Lønnsintegrasjon

---

## 8. Anbefalt byggrekkefølge

| Milepæl | Innhold | Mål |
|---|---|---|
| M0 | Sette opp verktøy (Next.js, Supabase, Vercel) + tomt prosjekt som kjører | Få fundamentet på plass |
| M1 | Innlogging + master­data (enhet, biler, sjåfører) | Kunne legge inn grunndata |
| M2 | Rutemaster + generere vakter | Kunne planlegge kjøring |
| M3 | Stempling + bilsjekk (mobil) | Sjåfør kan stemple inn/ut |
| M4 | Dagsoversikt med fargestatus | Leder ser status live |
| M5 | Kontroll + lukke dag | Fullføre den daglige loopen → **MVP ferdig** |
| M6+ | Økonomi, skade, regioner, Executive, lønn | Bygge ut til full løsning |

---

## 9. Realistisk forventning

Dette er en marathon, ikke en sprint – men en overkommelig en. Med Claude som koder kan MVP-skiven nås selv uten kodebakgrunn, så lenge du tar én milepæl om gangen og tester underveis. De delene som krever ekstra omtanke senere er lønnsintegrasjonen, personvern (bilder/persondata) og oppførsel under full skala. Vi tar dem når MVP står.

---

## 10. Neste steg

Med design på plass er neste steg å lage **CLAUDE.md** – instruksjonsfilen som gjør at Claude husker prosjektets mål, stack, regler og status mellom økter. Deretter setter vi opp verktøyene (M0) og begynner å bygge.
