-- =============================================================
-- 0006_time_entry_vehicle_check.sql
-- M3.1: Tabeller for stempling (time_entry), bilsjekk (vehicle_check) og
-- bilder (photo) + RLS. Bygger på 0001 (can_access_unit) og 0003 (shift).
-- =============================================================

-- ---------- 1. TABELLER ----------

-- Stempling: én rad pr. vakt. Sjåfør velges ved innstempling (ingen egen
-- sjåfør-innlogging i MVP). check_in/check_out fylles inn/ut.
create table if not exists public.time_entry (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.unit(id) on delete restrict,
  shift_id uuid not null references public.shift(id) on delete cascade,
  driver_id uuid references public.driver(id) on delete set null,
  check_in timestamptz,
  check_out timestamptz,
  comment text,
  created_at timestamptz not null default now(),
  unique (shift_id)
);

-- Bilsjekk: knyttet til vakt (og evt. stemplingen). status ok/avvik + kommentar.
create table if not exists public.vehicle_check (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.unit(id) on delete restrict,
  shift_id uuid not null references public.shift(id) on delete cascade,
  time_entry_id uuid references public.time_entry(id) on delete set null,
  driver_id uuid references public.driver(id) on delete set null,
  status text not null default 'ok' check (status in ('ok', 'avvik')),
  comment text,
  created_at timestamptz not null default now()
);

-- Bilde: hører til en bilsjekk. storage_path peker til fila i Supabase Storage.
create table if not exists public.photo (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.unit(id) on delete restrict,
  vehicle_check_id uuid not null references public.vehicle_check(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists time_entry_shift_idx    on public.time_entry(shift_id);
create index if not exists vehicle_check_shift_idx  on public.vehicle_check(shift_id);
create index if not exists photo_check_idx          on public.photo(vehicle_check_id);

-- ---------- 2. SKRU PÅ ROW LEVEL SECURITY ----------

alter table public.time_entry    enable row level security;
alter table public.vehicle_check enable row level security;
alter table public.photo         enable row level security;

-- ---------- 3. TILGANGSREGLER (POLICIES) ----------
-- Samme mønster som de andre tabellene: full tilgang innen egne enheter.

-- Stempling
drop policy if exists time_entry_select on public.time_entry;
create policy time_entry_select on public.time_entry
  for select using (public.can_access_unit(unit_id));
drop policy if exists time_entry_insert on public.time_entry;
create policy time_entry_insert on public.time_entry
  for insert with check (public.can_access_unit(unit_id));
drop policy if exists time_entry_update on public.time_entry;
create policy time_entry_update on public.time_entry
  for update using (public.can_access_unit(unit_id))
  with check (public.can_access_unit(unit_id));
drop policy if exists time_entry_delete on public.time_entry;
create policy time_entry_delete on public.time_entry
  for delete using (public.can_access_unit(unit_id));

-- Bilsjekk
drop policy if exists vehicle_check_select on public.vehicle_check;
create policy vehicle_check_select on public.vehicle_check
  for select using (public.can_access_unit(unit_id));
drop policy if exists vehicle_check_insert on public.vehicle_check;
create policy vehicle_check_insert on public.vehicle_check
  for insert with check (public.can_access_unit(unit_id));
drop policy if exists vehicle_check_update on public.vehicle_check;
create policy vehicle_check_update on public.vehicle_check
  for update using (public.can_access_unit(unit_id))
  with check (public.can_access_unit(unit_id));
drop policy if exists vehicle_check_delete on public.vehicle_check;
create policy vehicle_check_delete on public.vehicle_check
  for delete using (public.can_access_unit(unit_id));

-- Bilde
drop policy if exists photo_select on public.photo;
create policy photo_select on public.photo
  for select using (public.can_access_unit(unit_id));
drop policy if exists photo_insert on public.photo;
create policy photo_insert on public.photo
  for insert with check (public.can_access_unit(unit_id));
drop policy if exists photo_delete on public.photo;
create policy photo_delete on public.photo
  for delete using (public.can_access_unit(unit_id));
