-- =============================================================
-- 0007_vehicle_stamp_token.sql
-- Hver bil får en hemmelig kode brukt i QR/stemplingslenken. Sjåføren åpner
-- /stemple/<kode> og ser kun denne bilens vakt i dag (ingen innlogging).
-- =============================================================

alter table public.vehicle
  add column if not exists stamp_token uuid not null default gen_random_uuid();

-- Koden må være unik (slås opp ved stempling).
create unique index if not exists vehicle_stamp_token_key
  on public.vehicle(stamp_token);
