-- =============================================================
-- 0008_bilsjekk_storage.sql
-- M3.3: Privat lagringsbotte for bilsjekk-bilder.
--
-- Bildene tas med live kamera ved innstempling og lastes opp server-side
-- via admin-klienten (service role), som gar UTENOM Row Level Security.
-- Botta er derfor PRIVAT (public = false): ingen kan lese bildene uten en
-- signert lenke laget pa serveren. Ledere far visning i en senere milepael.
--
-- Denne SQL-en kan kjores i Supabase -> SQL Editor. Du kan ogsa opprette
-- botta manuelt i Supabase -> Storage (se oppskrift i svaret fra agenten);
-- resultatet blir det samme.
-- =============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bilsjekk-bilder',
  'bilsjekk-bilder',
  false,                                   -- privat botte
  10485760,                                -- maks 10 MB pr. fil
  array['image/jpeg', 'image/webp', 'image/png']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Ingen storage-policies trengs: opplasting skjer kun med service role
-- (admin-klienten) fra serveren, som ikke er underlagt RLS.
