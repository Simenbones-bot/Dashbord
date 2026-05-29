-- =============================================================
-- 0004_route_weekdays_autogen.sql
-- Rutemaster blir en ukesmal: ruten får ukedager (man–søn) i stedet for
-- "intervall". En nattlig jobb (pg_cron) lager datostemplede vakter 7 dager
-- frem automatisk, basert på rutene.
-- =============================================================

-- ---------- 1. UKEDAGER PÅ RUTE ----------
-- weekdays = ISO-ukedager ruten kjøres: 1 = mandag … 7 = søndag.
-- Eksisterende ruter settes til man–fre som standard.
alter table public.route
  add column if not exists weekdays smallint[] not null default '{1,2,3,4,5}';

-- ---------- 2. FUNKSJON SOM LAGER VAKTER ----------
-- Lager vakter for i dag + de neste `days_ahead` dagene, for alle aktive ruter
-- som kjøres på den ukedagen. Hopper over vakter som finnes fra før
-- (unik rute+dato). Returnerer antall nye vakter.
-- Planlagt start/slutt regnes i norsk tid (Europe/Oslo).
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
      vehicle_id, driver_id, co_driver_id
    )
    select
      r.unit_id, r.id, d,
      case when r.start_time is not null
        then ((d + r.start_time) at time zone 'Europe/Oslo') end,
      case when r.end_time is not null
        then ((d + r.end_time) at time zone 'Europe/Oslo') end,
      r.vehicle_id, r.driver_id, r.co_driver_id
    from public.route r
    where r.active = true
      and extract(isodow from d)::smallint = any (r.weekdays)
    on conflict (route_id, date) do nothing;

    get diagnostics ins = row_count;
    totalt := totalt + ins;
  end loop;
  return totalt;
end;
$$;

-- ---------- 3. PLANLAGT NATTLIG JOBB (pg_cron) ----------
-- Krever utvidelsen pg_cron (slå på under Database → Extensions hvis nødvendig).
create extension if not exists pg_cron;

-- Kjør hver natt kl. 02:00 og fyll vakter 7 dager frem.
-- (Samme jobbnavn => trygt å kjøre på nytt; den oppdateres i stedet for å dobles.)
select cron.schedule(
  'generate-shifts-daily',
  '0 2 * * *',
  $cron$ select public.generate_shifts_ahead(7); $cron$
);

-- ---------- 4. FYLL VAKTER NÅ (første gang) ----------
select public.generate_shifts_ahead(7);
