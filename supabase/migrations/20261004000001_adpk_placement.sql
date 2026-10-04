-- =====================================================================
-- ADPK mərhələsi: ixtisas + qrup (rəsmi dərs cədvəlindən)
--
-- Firebase versiyasındakı `groupMap()` qaydasının (qrup → ixtisas) Postgres qarşılığı:
--   * public.groups  : qrup kodu → ixtisas xəritəsi (src/data/timetable.json ilə eyni siyahı)
--   * profiles.specialty + profiles.group_name cütü groups cədvəlinə bağlıdır (composite FK)
--   * köhnə profiles.degree / profiles.course SİLİNMİR (məlumat itkisi olmasın), sadəcə istifadə olunmur
--     və müştəri onları artıq dəyişə bilməz
--   * schedule_entries cədvəli yeni tətbiqdə istifadə olunmur; məlumat itməsin deyə saxlanılır
--     (lazım olduqda əl ilə: drop table public.schedule_entries;)
--
-- Bu fayl 20261003000001_initial_schema.sql-dən SONRA işə salınır.
-- Qrup siyahısı yenilənəndə yalnız supabase/seed/groups.sql işlədilir (skript onu özü yaradır).
-- =====================================================================

-- ---------------------------------------------------------------------
-- groups
-- ---------------------------------------------------------------------
create table public.groups (
  code      text primary key check (char_length(code) between 1 and 20),
  specialty text not null check (char_length(specialty) between 1 and 40),
  active    boolean not null default true,
  unique (specialty, code)
);
create index groups_specialty_idx on public.groups (specialty);

alter table public.groups enable row level security;
revoke all on public.groups from anon, authenticated;
grant select on public.groups to anon, authenticated;
create policy groups_select on public.groups for select to anon, authenticated using (true);
-- yazma siyasəti yoxdur: qrupları yalnız service_role / SQL redaktoru dəyişir.

-- ---------------------------------------------------------------------
-- Qrup siyahısı (supabase/seed/groups.sql ilə eyni)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- profiles: specialty əlavə et, mövcud sətirləri uyğunlaşdır, məhdudiyyətləri qur
-- ---------------------------------------------------------------------
alter table public.profiles add column specialty text check (specialty is null or char_length(specialty) <= 40);

-- Köhnə sxemdə qrup sərbəst mətn idi. Rəsmi qrup kodu ilə üst-üstə düşənlər saxlanılır (ixtisas qrupdan götürülür),
-- qalanları təmizlənir: istifadəçi profildə ixtisas və qrupu yenidən seçməlidir (Firebase versiyası ilə eyni davranış).
update public.profiles p set specialty = g.specialty from public.groups g where p.group_name = g.code;
update public.profiles set group_name = null where group_name is not null and specialty is null;

alter table public.profiles
  add constraint profiles_placement_pair check ((specialty is null) = (group_name is null));
alter table public.profiles
  add constraint profiles_placement_fk foreign key (specialty, group_name)
  references public.groups (specialty, code) on update cascade;
create index profiles_group_idx on public.profiles (group_name) where group_name is not null;

-- Müştəri artıq degree/course dəyişə bilməz; specialty dəyişə bilər (trigger cütün düzgünlüyünü yoxlayır).
revoke update (degree, course) on public.profiles from authenticated;
grant update (specialty) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- Yeni auth istifadəçisi -> profil. İxtisas/qrup metadata-dan götürülür və groups ilə yoxlanılır.
-- Yalnız ikisi birlikdə verilə bilər; ikisi də yoxdursa profil qrupsuz yaranır (köçürülən köhnə hesablar üçün).
-- Qeydiyyat formu qrup seçməyi tətbiq tərəfində məcburi edir. Rol HƏMİŞƏ 'student'-dir.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  sp   text  := nullif(btrim(coalesce(meta ->> 'specialty', '')), '');
  gr   text  := nullif(btrim(coalesce(meta ->> 'group', '')), '');
begin
  if (sp is null) <> (gr is null)
     or (gr is not null and not exists (
          select 1 from public.groups g where g.code = gr and g.specialty = sp and g.active)) then
    raise exception 'invalid-placement';
  end if;

  insert into public.profiles (id, email, first_name, last_name, role, student_id, specialty, group_name)
  values (
    new.id,
    new.email,
    btrim(coalesce(meta ->> 'first_name', '')),
    btrim(coalesce(meta ->> 'last_name', '')),
    'student',
    nullif(btrim(coalesce(meta ->> 'student_id', '')), ''),
    sp,
    gr
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles qoruması (yenilənmiş):
--  * sahibi: yalnız ad, soyad, bilet nömrəsi, ixtisas+qrup
--  * admin (başqasının profili): yalnız rol
--  * admin öz rolunu dəyişə bilməz; degree/course dəyişməzdir
--  * ixtisas/qrup dəyişəndə cüt groups cədvəlində aktiv olmalıdır
--  * service_role / SQL redaktoru məhdudlaşdırılmır
-- ---------------------------------------------------------------------
create or replace function public.profiles_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.id is distinct from old.id
       or new.email is distinct from old.email
       or new.firebase_uid is distinct from old.firebase_uid
       or new.created_at is distinct from old.created_at
       or new.degree is distinct from old.degree
       or new.course is distinct from old.course then
      raise exception 'Bu sahələr dəyişdirilə bilməz' using errcode = '42501';
    end if;

    if new.role is distinct from old.role
       and not (public.is_admin() and old.id <> (select auth.uid())) then
      raise exception 'Rolu dəyişmək icazəsi yoxdur' using errcode = '42501';
    end if;

    if old.id <> (select auth.uid())
       and (new.first_name, new.last_name, new.student_id, new.specialty, new.group_name)
           is distinct from
           (old.first_name, old.last_name, old.student_id, old.specialty, old.group_name) then
      raise exception 'Başqasının profilini dəyişmək icazəsi yoxdur' using errcode = '42501';
    end if;

    if (new.specialty, new.group_name) is distinct from (old.specialty, old.group_name)
       and new.group_name is not null
       and not exists (
         select 1 from public.groups g
         where g.code = new.group_name and g.specialty = new.specialty and g.active) then
      raise exception 'invalid-placement';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;
