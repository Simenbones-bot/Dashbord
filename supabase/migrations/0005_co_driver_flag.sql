-- =============================================================
-- 0005_co_driver_flag.sql
-- Ruten lagrer ikke lenger sjåfør/sidemann som navn, men bare OM den krever
-- sidemann (ja/nei). Vaktene arver dette flagget. Sjåfør tildeles senere.
-- =============================================================

-- 1) Ja/nei på rute og vakt.
alter table public.route
  add column if not exists has_co_driver boolean not null default false;
alter table public.shift
  add column if not exists has_co_driver boolean not null default false;

-- 2) Oppdater genereringsfunksjonen:
--    - kopier has_co_driver fra ruten
--    - ikke lenger tildel sjåfør/sidemann automatisk (settes null)
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
      r.vehicle_id, r.has_co_driver
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
