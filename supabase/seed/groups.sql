-- Avtomatik yaradılıb: scripts/import-timetable.py. Əl ilə dəyişməyin.
-- Supabase SQL Editor-də işə salın; təkrar işlətmək təhlükəsizdir.
insert into public.groups (code, specialty, active) 
select v.code, v.specialty, true from (values
  ('KŞATS25/01SB', 'KŞATS'),
  ('KŞATS25/02SB', 'KŞATS'),
  ('KŞATS25/03SB', 'KŞATS'),
  ('KŞATS26/01SB', 'KŞATS'),
  ('KŞATS26/02SB', 'KŞATS'),
  ('KŞATS26/03SB', 'KŞATS'),
  ('KŞŞİ24/01SB', 'KŞŞİ'),
  ('KŞŞİ24/02SB', 'KŞŞİ'),
  ('KŞŞİ25/01SB', 'KŞŞİ'),
  ('KŞŞİ25/02SB', 'KŞŞİ'),
  ('KŞŞİ25/03SB', 'KŞŞİ'),
  ('KŞŞİ25/04SB', 'KŞŞİ'),
  ('KŞŞİ25/05SB', 'KŞŞİ'),
  ('KŞŞİ26/01SB', 'KŞŞİ'),
  ('KŞŞİ26/02SB', 'KŞŞİ'),
  ('KŞŞİ26/03SB', 'KŞŞİ'),
  ('KŞŞİ26/04SB', 'KŞŞİ'),
  ('Sİ24/01SB', 'Sİ'),
  ('Sİ24/02SB', 'Sİ'),
  ('Sİ25/01SB', 'Sİ'),
  ('Sİ25/02SB', 'Sİ'),
  ('Sİ25/03SB', 'Sİ'),
  ('Sİ25/04SB', 'Sİ'),
  ('Sİ25/05SB', 'Sİ'),
  ('Sİ26/01SB', 'Sİ'),
  ('Sİ26/02SB', 'Sİ'),
  ('Sİ26/03SB', 'Sİ'),
  ('Sİ26/04SB', 'Sİ'),
  ('Sİ26/05SB', 'Sİ')
) as v (code, specialty)
on conflict (code) do update set specialty = excluded.specialty, active = true;

update public.groups set active = false where code not in ('KŞATS25/01SB', 'KŞATS25/02SB', 'KŞATS25/03SB', 'KŞATS26/01SB', 'KŞATS26/02SB', 'KŞATS26/03SB', 'KŞŞİ24/01SB', 'KŞŞİ24/02SB', 'KŞŞİ25/01SB', 'KŞŞİ25/02SB', 'KŞŞİ25/03SB', 'KŞŞİ25/04SB', 'KŞŞİ25/05SB', 'KŞŞİ26/01SB', 'KŞŞİ26/02SB', 'KŞŞİ26/03SB', 'KŞŞİ26/04SB', 'Sİ24/01SB', 'Sİ24/02SB', 'Sİ25/01SB', 'Sİ25/02SB', 'Sİ25/03SB', 'Sİ25/04SB', 'Sİ25/05SB', 'Sİ26/01SB', 'Sİ26/02SB', 'Sİ26/03SB', 'Sİ26/04SB', 'Sİ26/05SB');
