-- =============================================================
-- 0001_masterdata.sql
-- Grunntabeller for masterdata + tilgangsstyring (RLS).
-- Trygt aa kjore flere ganger (bruker "if not exists" / "or replace").
-- =============================================================

-- ---------- 1. TABELLER ----------

-- Region (= distrikt)
create table if not exists public.region (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Enhet (avdeling/depot)
create table if not exists public.unit (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  region_id uuid references public.region(id) on delete restrict,
  created_at timestamptz not null default now()
);

-- Brukerprofil: kobler innlogget bruker (auth.users) til rolle + omraade.
-- role: 1 = transportleder, 2 = regionsleder, 3 = executive manager.
create table if not exists public.profile (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role smallint not null default 1 check (role in (1, 2, 3)),
  unit_id uuid references public.unit(id),
  region_id uuid references public.region(id),
  created_at timestamptz not null default now()
);

-- Bil (vehicle)
create table if not exists public.vehicle (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.unit(id) on delete restrict,
  reg_number text not null,
  make text not null,
  model text not null,
  model_year int,
  status text not null default 'i_drift'
    check (status in ('i_drift', 'ledig', 'pa_verksted')),
  leasing_cost_monthly numeric,
  service_cost_yearly numeric,
  eu_control_date date,
  next_service_date date,
  created_at timestamptz not null default now()
);

-- Sjafor (driver)
create table if not exists public.driver (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.unit(id) on delete restrict,
  full_name text not null,
  phone text,
  email text,
  license_class text,
  employed_year int,
  status text not null default 'aktiv'
    check (status in ('aktiv', 'inaktiv')),
  created_at timestamptz not null default now()
);

-- ---------- 2. HJELPEFUNKSJONER FOR TILGANG ----------
-- Leser den innloggede brukerens rolle/enhet/region fra profilen.
-- "security definer" gjor at de kan lese profile uten aa trigge RLS (unngaar loop).

create or replace function public.my_role()
  returns smallint language sql stable security definer set search_path = public
  as $$ select role from public.profile where id = auth.uid() $$;

create or replace function public.my_unit()
  returns uuid language sql stable security definer set search_path = public
  as $$ select unit_id from public.profile where id = auth.uid() $$;

create or replace function public.my_region()
  returns uuid language sql stable security definer set search_path = public
  as $$ select region_id from public.profile where id = auth.uid() $$;

-- Har innlogget bruker tilgang til en gitt enhet?
-- Niva 3 = alt, niva 2 = enheter i egen region, niva 1 = egen enhet.
create or replace function public.can_access_unit(target_unit uuid)
  returns boolean language sql stable security definer set search_path = public
  as $$
    select case
      when public.my_role() = 3 then true
      when public.my_role() = 2 then exists (
        select 1 from public.unit u
        where u.id = target_unit and u.region_id = public.my_region()
      )
      when public.my_role() = 1 then target_unit = public.my_unit()
      else false
    end
  $$;

-- ---------- 3. SKRU PAA ROW LEVEL SECURITY ----------

alter table public.region  enable row level security;
alter table public.unit    enable row level security;
alter table public.profile enable row level security;
alter table public.vehicle enable row level security;
alter table public.driver  enable row level security;

-- ---------- 4. TILGANGSREGLER (POLICIES) ----------

-- Profil: en bruker kan lese sin egen profil.
drop policy if exists profile_self_select on public.profile;
create policy profile_self_select on public.profile
  for select using (id = auth.uid());

-- Region: niva 3 ser alle, andre ser sin egen region.
drop policy if exists region_select on public.region;
create policy region_select on public.region
  for select using (public.my_role() = 3 or id = public.my_region());

-- Enhet: ser enheter man har tilgang til.
drop policy if exists unit_select on public.unit;
create policy unit_select on public.unit
  for select using (public.can_access_unit(id));

-- Bil: full tilgang (les/opprett/endre/slett) innen egne enheter.
drop policy if exists vehicle_select on public.vehicle;
create policy vehicle_select on public.vehicle
  for select using (public.can_access_unit(unit_id));
drop policy if exists vehicle_insert on public.vehicle;
create policy vehicle_insert on public.vehicle
  for insert with check (public.can_access_unit(unit_id));
drop policy if exists vehicle_update on public.vehicle;
create policy vehicle_update on public.vehicle
  for update using (public.can_access_unit(unit_id))
  with check (public.can_access_unit(unit_id));
drop policy if exists vehicle_delete on public.vehicle;
create policy vehicle_delete on public.vehicle
  for delete using (public.can_access_unit(unit_id));

-- Sjafor: samme tilgangsregler som bil.
drop policy if exists driver_select on public.driver;
create policy driver_select on public.driver
  for select using (public.can_access_unit(unit_id));
drop policy if exists driver_insert on public.driver;
create policy driver_insert on public.driver
  for insert with check (public.can_access_unit(unit_id));
drop policy if exists driver_update on public.driver;
create policy driver_update on public.driver
  for update using (public.can_access_unit(unit_id))
  with check (public.can_access_unit(unit_id));
drop policy if exists driver_delete on public.driver;
create policy driver_delete on public.driver
  for delete using (public.can_access_unit(unit_id));

-- ---------- 5. STARTDATA (én region + én enhet for MVP) ----------

insert into public.region (name)
select 'Oslo'
where not exists (select 1 from public.region where name = 'Oslo');

insert into public.unit (name, code, region_id)
select 'Oslo Distribusjon', 'OSL-01',
       (select id from public.region where name = 'Oslo' limit 1)
where not exists (select 1 from public.unit where code = 'OSL-01');

-- Koble alle eksisterende innloggingsbrukere til Oslo-enheten som transportleder (niva 1).
-- (I MVP finnes bare test-brukeren din. Ekte brukerstyring kommer senere.)
insert into public.profile (id, full_name, role, unit_id, region_id)
select u.id,
       coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
       1,
       (select id from public.unit where code = 'OSL-01' limit 1),
       (select id from public.region where name = 'Oslo' limit 1)
from auth.users u
on conflict (id) do update
  set unit_id   = excluded.unit_id,
      region_id = excluded.region_id;
