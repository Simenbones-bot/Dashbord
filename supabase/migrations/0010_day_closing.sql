-- =============================================================
-- 0010_day_closing.sql
-- M5: Dagskontroll (lukke dag) + revisjonslogg.
-- Lederen kontrollerer planlagt vs. faktisk og "lukker" dagen for en enhet.
-- Hver lukking/gjenaapning logges (hvem/naar) i day_closing_log.
-- Bygger paa 0001 (can_access_unit, profile, unit).
-- Trygt aa kjore flere ganger (if not exists / drop policy if exists).
-- =============================================================

-- ---------- 1. TABELLER ----------

-- Dagskontroll: én rad pr. enhet pr. dato. Finnes raden, er dagen "lukket"
-- (med mindre status er satt tilbake til 'apen' ved gjenaapning).
create table if not exists public.day_closing (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.unit(id) on delete restrict,
  date date not null,
  status text not null default 'lukket'
    check (status in ('apen', 'lukket')),
  -- Hvem lukket og naar (vises i kontrollskjermen).
  closed_by uuid references public.profile(id) on delete set null,
  closed_by_name text,
  closed_at timestamptz,
  -- Valgfri kommentar fra lederen ved lukking.
  note text,
  created_at timestamptz not null default now(),
  -- Maks én kontroll-rad pr. enhet pr. dag (gjor lukking trygt aa kjore igjen).
  unique (unit_id, date)
);

-- Revisjonslogg: én rad pr. handling (lukket/gjenaapnet). Skrives aldri over
-- eller slettes (ingen update/delete-policy) -> ekte historikk.
create table if not exists public.day_closing_log (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.unit(id) on delete restrict,
  date date not null,
  action text not null check (action in ('lukket', 'gjenapnet')),
  actor_id uuid references public.profile(id) on delete set null,
  actor_name text,
  created_at timestamptz not null default now()
);

create index if not exists day_closing_unit_date_idx
  on public.day_closing(unit_id, date);
create index if not exists day_closing_log_unit_date_idx
  on public.day_closing_log(unit_id, date);

-- ---------- 2. SKRU PAA ROW LEVEL SECURITY ----------

alter table public.day_closing     enable row level security;
alter table public.day_closing_log enable row level security;

-- ---------- 3. TILGANGSREGLER (POLICIES) ----------
-- Samme moenster som de andre tabellene: full tilgang innen egne enheter.

-- Dagskontroll: les/opprett/endre innen egne enheter.
drop policy if exists day_closing_select on public.day_closing;
create policy day_closing_select on public.day_closing
  for select using (public.can_access_unit(unit_id));
drop policy if exists day_closing_insert on public.day_closing;
create policy day_closing_insert on public.day_closing
  for insert with check (public.can_access_unit(unit_id));
drop policy if exists day_closing_update on public.day_closing;
create policy day_closing_update on public.day_closing
  for update using (public.can_access_unit(unit_id))
  with check (public.can_access_unit(unit_id));

-- Revisjonslogg: kan leses og legges til, men ikke endres/slettes (audit).
drop policy if exists day_closing_log_select on public.day_closing_log;
create policy day_closing_log_select on public.day_closing_log
  for select using (public.can_access_unit(unit_id));
drop policy if exists day_closing_log_insert on public.day_closing_log;
create policy day_closing_log_insert on public.day_closing_log
  for insert with check (public.can_access_unit(unit_id));
