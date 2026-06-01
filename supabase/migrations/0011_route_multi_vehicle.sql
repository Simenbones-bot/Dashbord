-- =============================================================
-- 0011_route_multi_vehicle.sql
-- Rutemodellen utvides: én rute kan ha FLERE biler, et antall biler som
-- trengs, samt type, farge og kjøretøykategori. Vaktgenereringen lager nå
-- én vakt PR. tildelt bil pr. dag (slik at 3 biler på samme rute = 3 vakter).
-- Bygger på 0002 (route), 0003 (shift) og 0004/0005 (generate_shifts_ahead).
-- Trygt å kjøre flere ganger.
-- =============================================================

-- ---------- 1. NYE KOLONNER PÅ RUTE ----------

alter table public.route
  add column if not exists route_type text not null default 'fast_rute',
  add column if not exists color text not null default '#5B5BD6',
  add column if not exists vehicle_category text,
  add column if not exists vehicles_needed int not null default 1,
  add column if not exists vehicle_ids uuid[] not null default '{}';

-- Flytt eksisterende enkelt-bil (vehicle_id) inn i den nye lista, så gamle
-- ruter beholder bilen sin. Kjøres bare når lista fortsatt er tom.
update public.route
  set vehicle_ids = array[vehicle_id]
  where vehicle_id is not null
    and coalesce(array_length(vehicle_ids, 1), 0) = 0;

-- ---------- 2. VAKT: UNIKHET PR. (RUTE, DATO, BIL) ----------
-- Tidligere var det maks én vakt pr. (rute, dato). Nå skal hver tildelt bil ha
-- sin egen vakt, så vi bytter til (rute, dato, bil). "nulls not distinct" gjør
-- at ruter uten bil fortsatt får nøyaktig én vakt (og at regenerering er trygg).
alter table public.shift drop constraint if exists shift_route_id_date_key;
create unique index if not exists shift_route_date_vehicle_key
  on public.shift (route_id, date, vehicle_id) nulls not distinct;

-- ---------- 3. OPPDATERT VAKTGENERERING ----------
-- Lager én vakt pr. tildelt bil. Har ruten ingen biler, lages én vakt uten bil.
create or replace function public.generate_shifts_ahead(days_ahead int default 7)
  returns int
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  i int;
  d date;
  today date := (now() at time zone 'Europe/Oslo')::date;
  ins int;
  totalt int := 0;
begin
  for i in 0..days_ahead loop
    d := today + i;
    insert into public.shift (
      unit_id, route_id, date, planned_start, planned_end,
      vehicle_id, has_co_driver
    )
    select
      r.unit_id, r.id, d,
      case when r.start_time is not null
        then ((d + r.start_time) at time zone 'Europe/Oslo') end,
      case when r.end_time is not null
        then ((d + r.end_time) at time zone 'Europe/Oslo') end,
      v.vehicle_id, r.has_co_driver
    from public.route r
    cross join lateral (
      select unnest(
        case when coalesce(array_length(r.vehicle_ids, 1), 0) = 0
          then array[null]::uuid[]
          else r.vehicle_ids
        end
      ) as vehicle_id
    ) v
    where r.active = true
      and extract(isodow from d)::smallint = any (r.weekdays)
    on conflict (route_id, date, vehicle_id) do nothing;

    get diagnostics ins = row_count;
    totalt := totalt + ins;
  end loop;
  return totalt;
end;
$$;

-- ---------- 4. FYLL VAKTER NÅ (for de nye bil-tildelingene) ----------
select public.generate_shifts_ahead(7);
