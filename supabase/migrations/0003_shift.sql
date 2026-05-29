-- =============================================================
-- 0003_shift.sql
-- M2.4: Tabell for vakt (shift) + RLS.
-- En vakt = én rute paa én bestemt dato. Genereres fra ruten (M2.4b).
-- Bygger paa 0001 (can_access_unit) og 0002 (route).
-- =============================================================

-- ---------- 1. TABELL ----------

create table if not exists public.shift (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.unit(id) on delete restrict,
  route_id uuid not null references public.route(id) on delete cascade,
  date date not null,
  -- Planlagt start/slutt = dato + rutens klokkeslett (brukes til fargestatus + overtid).
  planned_start timestamptz,
  planned_end timestamptz,
  -- Bil/sjafor kopieres fra ruten naar vakten lages (ruten kan endres senere).
  vehicle_id uuid references public.vehicle(id) on delete set null,
  driver_id uuid references public.driver(id) on delete set null,
  co_driver_id uuid references public.driver(id) on delete set null,
  status text not null default 'planlagt'
    check (status in ('planlagt', 'fullfort', 'avlyst')),
  created_at timestamptz not null default now(),
  -- Hindrer doble vakter for samme rute samme dag (gjor generering trygg aa
  -- kjore flere ganger).
  unique (route_id, date)
);

create index if not exists shift_unit_date_idx on public.shift(unit_id, date);
create index if not exists shift_route_idx      on public.shift(route_id);

-- ---------- 2. SKRU PAA ROW LEVEL SECURITY ----------

alter table public.shift enable row level security;

-- ---------- 3. TILGANGSREGLER (POLICIES) ----------
-- Samme moenster som bil/sjafor/rute: full tilgang innen egne enheter.

drop policy if exists shift_select on public.shift;
create policy shift_select on public.shift
  for select using (public.can_access_unit(unit_id));
drop policy if exists shift_insert on public.shift;
create policy shift_insert on public.shift
  for insert with check (public.can_access_unit(unit_id));
drop policy if exists shift_update on public.shift;
create policy shift_update on public.shift
  for update using (public.can_access_unit(unit_id))
  with check (public.can_access_unit(unit_id));
drop policy if exists shift_delete on public.shift;
create policy shift_delete on public.shift
  for delete using (public.can_access_unit(unit_id));
