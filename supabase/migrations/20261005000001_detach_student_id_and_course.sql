-- =====================================================================
-- Tələbə bileti nömrəsi və kurs: verilənlər bazası asılılıqlarının ayrılması
--
--   * Bu miqrasiya MƏLUMAT SİLMİR. Yalnız yeni qeydiyyatın və müştəri yazısının student_id-yə toxunmasını dayandırır.
--   * profiles.student_id və profiles.course sütunları burada qalır; onların silinməsi ayrıca,
--     sonuncu miqrasiyadadır (20261005000005_drop_legacy_profile_columns.sql) və yalnız yeni frontend
--     yerləşdirildikdən sonra işə salınmalıdır.
--   * profiles.degree silinmir: kurs deyil, təhsil pilləsi sütunudur (istifadə olunmur, müştəri dəyişə bilmir).
--   * Qrupların növbəsi verilənlər bazasında saxlanılmır (src/data/timetable.json-dadır); bu faylda toxunulmur.
--
-- Bu fayl 20261004000002_specialties.sql-dən SONRA işə salınır.
-- =====================================================================

-- Müştəri artıq bilet nömrəsini yaza bilməz (köhnə frontend yazmağa çalışsa, 42501 alır).
revoke update (student_id) on public.profiles from authenticated;

-- Yeni auth istifadəçisi -> profil. student_id metadata-dan artıq oxunmur; rol HƏMİŞƏ 'student'-dir.
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

  insert into public.profiles (id, email, first_name, last_name, role, specialty, group_name)
  values (
    new.id,
    new.email,
    btrim(coalesce(meta ->> 'first_name', '')),
    btrim(coalesce(meta ->> 'last_name', '')),
    'student',
    sp,
    gr
  );
  return new;
end;
$$;

-- profiles_guard: student_id və course artıq müqayisə olunmur (sütunlar sonra silinəcək).
-- Super Admin qoruması növbəti miqrasiyada bu funksiyanı yenidən təyin edir.
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
       or new.degree is distinct from old.degree then
      raise exception 'Bu sahələr dəyişdirilə bilməz' using errcode = '42501';
    end if;

    if new.role is distinct from old.role
       and not (public.is_admin() and old.id <> (select auth.uid())) then
      raise exception 'Rolu dəyişmək icazəsi yoxdur' using errcode = '42501';
    end if;

    if old.id <> (select auth.uid())
       and (new.first_name, new.last_name, new.specialty, new.group_name)
           is distinct from
           (old.first_name, old.last_name, old.specialty, old.group_name) then
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
