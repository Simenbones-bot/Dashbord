-- =============================================================
-- 0010_day_closing.sql
-- M5: Kontroll av dagen. Lederen godkjenner eller avviser HVER vakt
-- (planlagt vs. faktisk). Hver vurdering lagrer hvem/naar = revisjonslogg.
-- Bygger paa 0001 (can_access_unit, profile, unit) og 0003 (shift).
-- Trygt aa kjore flere ganger (if not exists / drop policy if exists).
-- =============================================================

-- ---------- 1. TABELL ----------

-- Vurdering pr. vakt: én rad pr. shift. status godkjent/avvist, med valgfri
-- begrunnelse. reviewed_by/reviewed_at + reviewed_by_name er revisjonsloggen
-- (hvem gjorde hva og naar). Navnet lagres som tekst slik at loggen bestaar
-- selv om en bruker senere fjernes.
create table if not exists public.shift_review (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.unit(id) on delete restrict,
  shift_id uuid not null references public.shift(id) on delete cascade,
  status text not null check (status in ('godkjent', 'avvist')),
  note text,
  reviewed_by uuid references public.profile(id) on delete set null,
  reviewed_by_name text,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- Maks én vurdering pr. vakt (gjor lagring/oppdatering trygt aa kjore igjen).
  unique (shift_id)
);

create index if not exists shift_review_unit_idx  on public.shift_review(unit_id);
create index if not exists shift_review_shift_idx on public.shift_review(shift_id);

-- ---------- 2. SKRU PAA ROW LEVEL SECURITY ----------

alter table public.shift_review enable row level security;

-- ---------- 3. TILGANGSREGLER (POLICIES) ----------
-- Samme moenster som de andre tabellene: full tilgang innen egne enheter.

drop policy if exists shift_review_select on public.shift_review;
create policy shift_review_select on public.shift_review
  for select using (public.can_access_unit(unit_id));
drop policy if exists shift_review_insert on public.shift_review;
create policy shift_review_insert on public.shift_review
  for insert with check (public.can_access_unit(unit_id));
drop policy if exists shift_review_update on public.shift_review;
create policy shift_review_update on public.shift_review
  for update using (public.can_access_unit(unit_id))
  with check (public.can_access_unit(unit_id));
drop policy if exists shift_review_delete on public.shift_review;
create policy shift_review_delete on public.shift_review
  for delete using (public.can_access_unit(unit_id));
