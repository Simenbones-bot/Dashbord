-- =============================================================
-- 0012_route_default_driver.sql
-- Fast sjåfør på ruten ("oppdraget"): ny kolonne default_driver_id på route.
-- Nye vakter som genereres får denne sjåføren automatisk. Eksisterende
-- fremtidige vakter (fra og med i morgen) oppdateres av appen når man trykker
-- "Fast" i dagsoversikten.
-- Bygger på 0011 (vehicle_ids + per-bil generering). Trygt å kjøre flere ganger.
-- =============================================================

-- ---------- 1. NY KOLONNE PÅ RUTE ----------
-- Fast sjåfør. Settes til null hvis sjåføren slettes (vakten mister bare faste­
-- tilknytningen, ikke selve raden).
alter table public.route
  add column if not exists default_driver_id uuid
    references public.driver(id) on delete set null;

-- ---------- 2. OPPDATERT VAKTGENERERING ----------
-- Som 0011, men kopierer nå rutens faste sjåfør (default_driver_id) inn på
-- driver_id for hver nye vakt. Eksisterende vakter røres ikke (on conflict).
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
      vehicle_id, driver_id, has_co_driver
    )
    select
      r.unit_id, r.id, d,
      case when r.start_time is not null
        then ((d + r.start_time) at time zone 'Europe/Oslo') end,
      case when r.end_time is not null
        then ((d + r.end_time) at time zone 'Europe/Oslo') end,
      v.vehicle_id, r.default_driver_id, r.has_co_driver
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

-- ---------- 3. FYLL EVT. MANGLENDE VAKTER ----------
select public.generate_shifts_ahead(7);
