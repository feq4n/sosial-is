-- =====================================================================
-- Dəyişdirilməz Super Admin
--
-- Hesab: feqangerayli@gmail.com (public.super_admin_email()).
--   * Hesab Supabase Auth-dakı HƏQİQİ UID ilə tanınır (profiles.is_super_admin = true). Müştərinin göndərdiyi
--     e-poçt, rol və ya user_metadata heç vaxt Super Admin təyin etmir; e-poçt yalnız bootstrap zamanı
--     auth.users-dən UID-ni tapmaq üçündür.
--   * Super Admin: silinə, rolu dəyişdirilə, tələbəyə çevrilə, deaktiv edilə (ban) və səlahiyyəti azaldıla bilməz.
--     Bunlar RLS siyasəti + tətiklərlə TƏTBİQ OLUNUR (frontend-dən asılı deyil), service_role üçün də.
--   * Heç bir müştəri (admin daxil) is_super_admin bayrağını yaza bilməz: sütun üzrə UPDATE icazəsi yoxdur,
--     tətik də rədd edir.
--   * Yeganə istisna: SQL Editor-də (layihə sahibi) əl ilə, eyni tranzaksiyada
--         set local app.allow_super_admin_changes = 'on';
--     təyin edildikdə. API müştəriləri bu parametri təyin edə bilmir.
--   * Hesab hələ yoxdursa: bu miqrasiya heç nə yaratmır və kimisə avtomatik yüksəltmir. Hesabı yaradıb təyin etmək üçün
--     scripts/bootstrap-super-admin.mjs işlədin (service_role açarı yalnız lokal mühit dəyişənində) və ya hesab
--     yarandıqdan sonra SQL Editor-də:  select public.bootstrap_super_admin();
--     Funksiya idempotentdir: Super Admin artıq varsa heç nə etmir.
--
-- Bu fayl 20261005000001_detach_student_id_and_course.sql-dən SONRA işə salınır.
-- =====================================================================

create or replace function public.super_admin_email()
returns text
language sql
immutable
set search_path = ''
as $$ select 'feqangerayli@gmail.com'::text $$;

alter table public.profiles add column if not exists is_super_admin boolean not null default false;

-- Yalnız bir Super Admin ola bilər.
create unique index if not exists profiles_one_super_admin on public.profiles ((true)) where is_super_admin;

-- Müştərilərin yazma icazəsi sütun siyahısı ilə verilib; is_super_admin orada YOXDUR (aşağıdakı revoke yalnız əminlik üçündür).
revoke update (is_super_admin) on public.profiles from anon, authenticated;

-- ---------------------------------------------------------------------
-- Köməkçilər
-- ---------------------------------------------------------------------
create or replace function public.super_admin_maintenance_on()
returns boolean
language sql
stable
set search_path = ''
as $$ select coalesce(current_setting('app.allow_super_admin_changes', true), '') = 'on' $$;

-- SECURITY DEFINER: RLS siyasətləri profiles-i özləri oxuduqda rekursiyanın qarşısı alınır.
create or replace function public.is_super_admin_id(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.profiles p where p.id = uid and p.is_super_admin) $$;

revoke all on function public.is_super_admin_id(uuid) from public;
grant execute on function public.is_super_admin_id(uuid) to authenticated, service_role;
revoke all on function public.super_admin_maintenance_on() from public;
grant execute on function public.super_admin_maintenance_on() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- profiles_guard: Super Admin qaydaları BÜTÜN çağıranlar üçün (service_role daxil); qalan qaydalar yalnız müştərilər üçün.
-- ---------------------------------------------------------------------
create or replace function public.profiles_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.super_admin_maintenance_on() then
    if new.is_super_admin is distinct from old.is_super_admin then
      raise exception 'super-admin-protected' using errcode = '42501';
    end if;
    if old.is_super_admin and (new.role is distinct from old.role or new.id is distinct from old.id) then
      raise exception 'super-admin-protected' using errcode = '42501';
    end if;
  end if;

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

-- Profil silinə bilməz (auth.users silinəndə cascade də bu tətikdən keçir, ona görə hesab da silinə bilmir).
create or replace function public.profiles_super_admin_delete_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_super_admin and not public.super_admin_maintenance_on() then
    raise exception 'super-admin-protected' using errcode = '42501';
  end if;
  return old;
end;
$$;

drop trigger if exists profiles_super_admin_delete_trg on public.profiles;
create trigger profiles_super_admin_delete_trg
  before delete on public.profiles
  for each row execute function public.profiles_super_admin_delete_guard();

-- Bayrağı olan yeni sətir (INSERT) yalnız saxlama rejimində yaradıla bilər.
create or replace function public.profiles_super_admin_insert_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_super_admin and not public.super_admin_maintenance_on() then
    raise exception 'super-admin-protected' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_super_admin_insert_trg on public.profiles;
create trigger profiles_super_admin_insert_trg
  before insert on public.profiles
  for each row execute function public.profiles_super_admin_insert_guard();

-- ---------------------------------------------------------------------
-- RLS: admin başqasının rolunu dəyişə bilər, lakin Super Admin-in yox.
-- ---------------------------------------------------------------------
drop policy if exists profiles_update_role_by_admin on public.profiles;
create policy profiles_update_role_by_admin on public.profiles
  for update to authenticated
  using (public.is_admin() and id <> (select auth.uid()) and not public.is_super_admin_id(id))
  with check (public.is_admin() and id <> (select auth.uid()) and not public.is_super_admin_id(id));

-- ---------------------------------------------------------------------
-- auth.users: Super Admin deaktiv (ban) və ya yumşaq silinmə ilə söndürülə bilməz.
-- (Sətrin tam silinməsi yuxarıdakı profiles tətiki ilə bloklanır.)
-- ---------------------------------------------------------------------
create or replace function public.protect_super_admin_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.banned_until is distinct from old.banned_until or new.deleted_at is distinct from old.deleted_at)
     and (new.banned_until is not null or new.deleted_at is not null)
     and not public.super_admin_maintenance_on()
     and public.is_super_admin_id(old.id) then
    raise exception 'super-admin-protected' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_super_admin_auth() from public;

drop trigger if exists protect_super_admin_auth_trg on auth.users;
create trigger protect_super_admin_auth_trg
  before update on auth.users
  for each row execute function public.protect_super_admin_auth();

-- ---------------------------------------------------------------------
-- Bootstrap: hesab varsa və e-poçtu təsdiqlənibsə Super Admin təyin edir. İdempotentdir; heç nə yaratmır.
-- Müştərilər üçün əlçatan DEYİL (yalnız service_role və SQL Editor).
-- ---------------------------------------------------------------------
create or replace function public.bootstrap_super_admin()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  confirmed timestamptz;
  n integer;
begin
  if exists (select 1 from public.profiles where is_super_admin) then
    return 'exists';
  end if;

  select u.id, u.email_confirmed_at into uid, confirmed
  from auth.users u
  where lower(u.email) = lower(public.super_admin_email())
  limit 1;

  if uid is null then return 'missing'; end if;
  if confirmed is null then return 'unconfirmed'; end if;

  perform set_config('app.allow_super_admin_changes', 'on', true);
  update public.profiles set role = 'admin', is_super_admin = true where id = uid;
  get diagnostics n = row_count;
  perform set_config('app.allow_super_admin_changes', 'off', true);

  if n = 0 then return 'no-profile'; end if;
  return 'promoted';
end;
$$;

revoke all on function public.bootstrap_super_admin() from public, anon, authenticated;
grant execute on function public.bootstrap_super_admin() to service_role;

do $$
declare r text := public.bootstrap_super_admin();
begin
  raise notice 'bootstrap_super_admin: %', r;
end $$;
