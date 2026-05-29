-- =============================================================
-- 0002_customer_route.sql
-- M2.1: Tabeller for kunde (customer) og rute (route) + RLS.
-- Trygt aa kjore flere ganger (bruker "if not exists" / drop+create policy).
-- Bygger videre paa 0001_masterdata.sql (bruker samme hjelpefunksjoner
-- my_role / my_unit / can_access_unit).
-- =============================================================

-- ---------- 1. TABELLER ----------

-- Kunde (customer)
-- parent_customer_id peker (valgfritt) paa en annen kunde som fungerer som
-- "samlenavn"/overordnet kunde. Selv-referanse = enkel maate aa gruppere paa.
create table if not exists public.customer (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.unit(id) on delete restrict,
  name text not null,
  customer_number text,
  parent_customer_id uuid references public.customer(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Rute (route)
-- Master for kjoring. Genererer senere vakter (shift) pr. dag (M2.2).
-- Bil/sjafor/sidemann/kunde er valgfrie (kan settes naar ruten planlegges).
-- start_time/end_time = planlagt tid paa dognet, brukes til aa lage vaktens
-- planlagt_start/planlagt_slutt og til overtidsberegning senere.
create table if not exists public.route (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.unit(id) on delete restrict,
  name text not null,
  route_number text,
  customer_id uuid references public.customer(id) on delete set null,
  vehicle_id uuid references public.vehicle(id) on delete set null,
  driver_id uuid references public.driver(id) on delete set null,
  co_driver_id uuid references public.driver(id) on delete set null,
  start_time time,
  end_time time,
  distance_km numeric,
  interval_days int not null default 1,   -- hvor ofte ruten kjores (1 = hver dag)
  revenue_per_hour numeric,
  active boolean not null default true,   -- false = ruten genererer ikke nye vakter
  created_at timestamptz not null default now()
);

-- Indekser paa fremmednokler (rask oppslag/filtrering).
create index if not exists customer_unit_idx   on public.customer(unit_id);
create index if not exists route_unit_idx       on public.route(unit_id);
create index if not exists route_customer_idx   on public.route(customer_id);

-- ---------- 2. SKRU PAA ROW LEVEL SECURITY ----------

alter table public.customer enable row level security;
alter table public.route    enable row level security;

-- ---------- 3. TILGANGSREGLER (POLICIES) ----------
-- Samme moenster som bil/sjafor: full tilgang innen egne enheter.

-- Kunde
drop policy if exists customer_select on public.customer;
create policy customer_select on public.customer
  for select using (public.can_access_unit(unit_id));
drop policy if exists customer_insert on public.customer;
create policy customer_insert on public.customer
  for insert with check (public.can_access_unit(unit_id));
drop policy if exists customer_update on public.customer;
create policy customer_update on public.customer
  for update using (public.can_access_unit(unit_id))
  with check (public.can_access_unit(unit_id));
drop policy if exists customer_delete on public.customer;
create policy customer_delete on public.customer
  for delete using (public.can_access_unit(unit_id));

-- Rute
drop policy if exists route_select on public.route;
create policy route_select on public.route
  for select using (public.can_access_unit(unit_id));
drop policy if exists route_insert on public.route;
create policy route_insert on public.route
  for insert with check (public.can_access_unit(unit_id));
drop policy if exists route_update on public.route;
create policy route_update on public.route
  for update using (public.can_access_unit(unit_id))
  with check (public.can_access_unit(unit_id));
drop policy if exists route_delete on public.route;
create policy route_delete on public.route
  for delete using (public.can_access_unit(unit_id));
