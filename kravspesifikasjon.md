# Kravspesifikasjon – Driftssystem for varebilselskap

**Versjon:** 1.0
**Fase:** 1 – Kravspesifikasjon
**Status:** Godkjent (fase 1 fullført)

---

## 1. Formål og omfang

Et samlet web- og mobilbasert system for å drifte et varebilselskap: planlegge og følge opp kjøring, styre bilparken, håndtere innstempling og bilsjekk, kontrollere arbeidstid mot lønn, og håndtere skader. Systemet skal gi ledere på tre nivåer oversikt og kontroll tilpasset deres ansvarsområde.

**Skala (dimensjonering):**
- Inntil 50 enheter
- Inntil 1 000 varebiler
- Inntil 1 500 sjåfører

**Plattform:**
- Web (PC) er hovedflate for all administrasjon, planlegging og kontroll.
- Mobil/web brukes av sjåfør til innstempling og bilsjekk.

---

## 2. Organisasjonshierarki og datamodell (overordnet)

Hierarkiet har tre nivåer. *Distrikt og region er det samme begrepet.*

```
Organisasjon
  └── Region (= Distrikt)
        └── Enhet (avdeling/depot)
              ├── Biler
              ├── Sjåfører
              ├── Ruter (rutemaster)
              └── Kunder
```

Sentrale entiteter som systemet bygger på:

| Entitet | Eier | Kort beskrivelse |
|---|---|---|
| Region | Organisasjon | Geografisk/administrativ inndeling |
| Enhet | Region | Avdeling/depot med egen bilpark og bemanning |
| Bil | Enhet | Kjøretøy med leasing-, service- og kontrolldata |
| Sjåfør | Enhet | Ansatt som kan settes på ruter |
| Rute | Enhet | Fast definert oppdrag (rutemaster) |
| Kunde | Enhet/Org | Oppdragsgiver knyttet til ruter |
| Vakt/Oppdrag | Genereres fra Rute | Daglig instans av en rute, med sjåfør og bil |
| Stempling | Vakt + Sjåfør + Bil | Innstempling med bilsjekk |
| Skadesak | Bil | Sak i Kanban-flyt |

---

## 3. Tilgangsstyring (roller)

Rollebasert tilgangsstyring (RBAC) med tre nivåer:

| Nivå | Rolle | Tilgang |
|---|---|---|
| 1 | Transportleder | Tildelt enhet. Daglig drift og oppfølging. Kan **foreslå** ruteendringer – må godkjennes av nivå 2. |
| 2 | Regionsleder | Alle enheter i sin region. **Godkjenner** ruteendringer. |
| 3 | Executive Manager | Tilgang til alt + tilgangsstyring + administrasjonspanel. |

**Krav:**
- Innlogging og autentisering.
- Brukere kan tilhøre flere enheter/regioner; mulighet for å **bytte enhet** i grensesnittet.
- **Revisjonslogg (audit-logg)** på endringer som krever godkjenning (forslag → godkjent/avvist, med hvem og når).

---

## 4. Funksjonelle moduler

### 4.1 Rutemaster (faste ruter + Gantt)

Masterdefinisjon av selskapets faste kjøring.

**Opprette/redigere rute – obligatoriske felter:**
- Valgt bil (hentes fra Bil Grandmaster)
- Rutenavn
- Rutenummer
- Tur (km)
- Tid (varighet)
- Intervall i uken (hvilke dager/hvor ofte)
- Inntekt pr. time
- Kunde
- Kundenummer
- Samlenavn (internt navn for **overordnet kunde** – grupperer ruter under samme overordnede kunde)
- Sidemann (valgfritt – mulighet for å legge til en ekstra person/sidemann på ruten)

**Gantt-visning:**
- Hele uken, mandag kl. 00 → søndag kl. 00.
- Viser ruter over tid pr. bil/enhet.

**Økonomifilter (på/av):**
- Faste kostnader pr. enhet kan legges inn.
- Viser driftskostnad pr. time med kjøring.
- Viser inntekt pr. time kjøring.
- Gir margin/lønnsomhet pr. rute når filteret er på.

**Tilgang:** Alle nivåer kan se. Nivå 1 kan foreslå endringer; nivå 2 godkjenner.

---

### 4.2 Dagsoversikt (daglig drift)

Dashbord for transportleder/koordinator. Mål: sikre at alle er på jobb til tiden og at driften går normalt. Genereres fra rutemaster og lages **1 uke frem i tid.**

**Visuell statusindikator pr. vakt:**

| Farge | Betingelse |
|---|---|
| ⬜ Grå | Før vaktstart |
| 🟩 Grønn | Stemplet innen 5 min av vaktstart |
| 🟨 Gul | 5–10 min etter vaktstart uten stempling |
| 🟥 Rød (med varseltrekant) | >10 min etter vaktstart uten stempling |

**Øvrige krav:**
- Viser inntekter og relevant ruteinformasjon.
- Legge til **ekstraoppdrag**.
- **Flytte visningsdato** frem i tid.
- **Flytte biler inn/ut** av oppdrag (drag-and-drop) når leder må bytte om.
- Biler **uten oppdrag** vises nederst og kan enkelt byttes inn.
- **Sjåførregister** og mulighet til å sette sjåfører (og evt. sidemann) **fast** på ruter.

---

### 4.3 Stemplingssystem (innstempling + bilsjekk)

Enkelt grensesnitt for sjåfør (mobil/web).

**Krav:**
- Sjåfør stempler inn i forbindelse med bilsjekk.
- Ta **bilder rundt bilen med live kamera** (kameraet aktiveres direkte i appen – opplasting fra galleri er **ikke** tillatt, slik at bildet bekrefter at sjåføren faktisk er ved bilen).
- Skrive **kommentar**.
- **Melde avvik**.
- Sjåfør stempler **ut** ved endt vakt (gir faktisk sluttid – nødvendig for kontroll/overtidsberegning).
- Tidsstempel knyttes til vakten og styrer fargestatus i dagsoversikt.
- Avvik og bilsjekk er lett synlig i dagsoversikten, og avvik kan generere skadesak.

---

### 4.4 Kontroll (lukke gårsdagen)

Daglig kontroll og godkjenning før dagen «lukkes».

**Omfang i denne fasen (MVP):**
- Leder ser planlagt vakt mot **faktisk stempling** (inn/ut) for gårsdagen.
- Leder ser spesielt om noen har **jobbet over tiden** (overtid) og sjåførens **kommentar/årsak**.
- Leder **godkjenner eller avviser** pr. vakt.
- En «lukket» dag utgjør et verifisert grunnlag.

**Lønnsintegrasjon (senere fase):**
- Lønnssystemet endres ikke.
- Formålet er å **kontrollere at sjåfør/tur ligger riktig i lønnssystemet**.
- Selve integrasjonen spesifiseres og bygges etter MVP.

---

### 4.5 Bil Grandmaster (bilpark)

Sentralt register for bilparken.

**Krav:**
- Opprette/redigere biler.
- **Bilmerke og modell hardkodes** (velges fra liste) for god datakvalitet.
- Registrere bl.a. leasingkostnad, servicekostnad, EU-kontroll, service-/kontrolldatoer.
- Bilens status/tilgjengelighet kobles til dagsoversikt og skadehåndtering.

---

### 4.6 Skadehåndtering (LEAN Kanban)

Oversikt over alle biler med utfordringer, og saksbehandling i Kanban-flyt.

**Kolonner (flyt):**
```
Nye saker → Bestilt time → På verksted → Utbedret
                                              │
                                        Saker på vent
```

**Krav:**
- Saker knyttes til en bil.
- Saker kan opprettes manuelt eller fra avvik meldt i stemplingen.
- Oversikt over biler med åpne saker.

---

### 4.7 Executive dashboard (totaloversikt)

Toppnivå-oversikt for nivå 3 (og filtrert for nivå 2).

**Krav:**
- Totaloversikt på tvers av organisasjonen.
- Filtrering på **distrikt/region** og ned til **enhet**.
- KPI-er: økonomi (inntekt/kostnad/margin), driftsstatus, bemanning, åpne skadesaker.

---

## 5. Ikke-funksjonelle krav

- **Sikkerhet:** RBAC, autentisering, audit-logg på godkjenningsflyt.
- **Skala:** Må håndtere 50 enheter / 1 000 biler / 1 500 sjåfører.
- **Sanntid:** Dagsoversiktens fargestatus oppdateres ca. **hvert minutt** (jevnlig polling er tilstrekkelig – ikke behov for sekundbasert sanntid/websockets).
- **Filhåndtering:** Bilder fra bilsjekk lagres i **3 uker**, deretter automatisk sletting. Bilder tas kun via live kamera.
- **Personvern (GDPR):** Bilder og stemplingsdata er personopplysninger – bør hensyntas i lagring og sletting.
- **Språk:** Norsk grensesnitt.
- **Responsivt:** PC-først for administrasjon, mobilvennlig for sjåførens stempling.

---

## 6. Besluttede avklaringer

| # | Tema | Beslutning |
|---|---|---|
| 1 | Samlenavn | Internt navn for **overordnet kunde** (grupperer ruter under samme overordnede kunde). |
| 2 | Bilsjekk-bilde | Bilde av bilen er indikator på oppmøte. **Live kamera** aktiveres; ikke opplasting fra galleri. |
| 3 | Bildelagring | Lagres **3 uker**, deretter automatisk sletting. |
| 4 | Bemanning pr. rute | Ingen sjåførbytte i ruten. Mulighet for **sidemann** legges inn som valg i rutemaster. |
| 5 | Sanntidskrav | Oppdatering på **minuttnivå** (polling holder). |
| 6 | Inn-/utstempling | **Besluttet:** sjåfør stempler både inn og ut. Planlagt sluttid hentes fra ruten; overtid = faktisk sluttid minus planlagt. Gir grunnlag for kontrollmodulens overtidsoppfølging. |
| 7 | Kundeeierskap | *Fortsatt åpent – avklares i designfasen.* |


---

## 7. Avgrensninger (ikke med i denne fasen)

- Selve lønnsintegrasjonen (kommer som egen fase).
- Fakturering mot kunde (avklares senere).
- Eventuell ruteoptimalisering/automatisk planlegging.
