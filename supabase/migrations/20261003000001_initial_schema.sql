-- =====================================================================
-- Firebase (Firestore) -> Supabase (PostgreSQL) miqrasiyası: sxem
--
-- Firestore kolleksiyalarının qarşılığı:
--   users/{uid}                          -> public.profiles
--   users/{uid}/saved/{materialId}       -> public.saved_materials
--   users/{uid}/notes/{id}               -> public.personal_notes
--   users/{uid}/notificationReads/{key}  -> public.notification_reads
--   announcements, materials, schedule   -> public.announcements, materials, schedule_entries
--   events, events/{id}/registrations    -> public.events, public.event_registrations
--   contact_messages                     -> public.contact_messages
--
-- Sahə adları snake_case-ə çevrilib (firstName -> first_name). Tətbiqdəki TypeScript
-- tipləri dəyişməyib; çevirmə src/services/ qatında aparılır.
-- Miqrasiya təkrar işə salına bilməz (idempotent deyil); dəyişikliklər üçün yeni fayl əlavə edin.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Köməkçi: yenilənmə vaxtı
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles  (Firestore: users/{uid})
-- id = auth.users.id. Firebase UID-ləri UUID deyil, ona görə köhnə identifikator
-- firebase_uid sütununda saxlanılır (miqrasiya və izlənilmə üçün).
-- ---------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  firebase_uid text unique,
  first_name   text not null check (char_length(first_name) between 1 and 60),
  last_name    text not null check (char_length(last_name) between 1 and 60),
  email        text not null check (char_length(email) between 3 and 320),
  role         text not null default 'student' check (role in ('student', 'editor', 'admin')),
  student_id   text check (student_id is null or char_length(student_id) <= 30),
  degree       text check (degree is null or degree in ('bakalavr', 'magistr', 'doktorantura')),
  course       smallint check (course is null or course between 1 and 6),
  group_name   text check (group_name is null or char_length(group_name) <= 20),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz
);

create unique index profiles_email_lower_key on public.profiles (lower(email));
create index profiles_role_idx on public.profiles (role) where role <> 'student';
create index profiles_created_at_idx on public.profiles (created_at desc);

-- ---------------------------------------------------------------------
-- Rol köməkçiləri. SECURITY DEFINER: RLS siyasətləri profiles cədvəlini özləri
-- oxuduqda sonsuz rekursiyanın qarşısını alır. Rol yalnız profiles.role-dan oxunur
-- (istifadəçinin dəyişə bildiyi user_metadata-dan DEYİL).
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

create or replace function public.is_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'editor')
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_editor() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.is_editor() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- Yeni auth istifadəçisi -> profil (rol HƏMİŞƏ 'student').
-- Yalnız ad/soyad/pillə/kurs/bilet nömrəsi user_metadata-dan götürülür; rol götürülmür.
-- Profil yaradıla bilmirsə qeydiyyat geri qaytarılır (əvvəlki deleteUser davranışı).
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, email, first_name, last_name, role, student_id, degree, course)
  values (
    new.id,
    new.email,
    btrim(coalesce(meta ->> 'first_name', '')),
    btrim(coalesce(meta ->> 'last_name', '')),
    'student',
    nullif(btrim(coalesce(meta ->> 'student_id', '')), ''),
    nullif(meta ->> 'degree', ''),
    nullif(meta ->> 'course', '')::smallint
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- profiles üzərində qoruma: rolu və dəyişməz sahələri müştəri dəyişə bilməz.
--  * sahibi: yalnız ad, soyad, bilet nömrəsi, pillə, kurs, qrup
--  * admin (başqasının profili): yalnız rol
--  * admin öz rolunu dəyişə bilməz
--  * service_role / SQL redaktoru (müştəri rolu olmayan) məhdudlaşdırılmır (ilk admin üçün)
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
       or new.created_at is distinct from old.created_at then
      raise exception 'Bu sahələr dəyişdirilə bilməz' using errcode = '42501';
    end if;

    if new.role is distinct from old.role
       and not (public.is_admin() and old.id <> (select auth.uid())) then
      raise exception 'Rolu dəyişmək icazəsi yoxdur' using errcode = '42501';
    end if;

    if old.id <> (select auth.uid())
       and (new.first_name, new.last_name, new.student_id, new.degree, new.course, new.group_name)
           is distinct from
           (old.first_name, old.last_name, old.student_id, old.degree, old.course, old.group_name) then
      raise exception 'Başqasının profilini dəyişmək icazəsi yoxdur' using errcode = '42501';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_guard_trg
  before update on public.profiles
  for each row execute function public.profiles_guard();

-- ---------------------------------------------------------------------
-- announcements
-- ---------------------------------------------------------------------
create table public.announcements (
  id          uuid primary key default gen_random_uuid(),
  firebase_id text unique,
  title       text not null check (char_length(title) between 3 and 160),
  summary     text not null default '',
  body        text not null check (char_length(body) between 1 and 8000),
  category    text not null default 'umumi'
              check (category in ('umumi', 'tedris', 'imtahan', 'telebe-heyati', 'praktika')),
  important   boolean not null default false,
  published   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index announcements_published_created_idx on public.announcements (published, created_at desc);

-- ---------------------------------------------------------------------
-- materials
-- ---------------------------------------------------------------------
create table public.materials (
  id          uuid primary key default gen_random_uuid(),
  firebase_id text unique,
  title       text not null check (char_length(title) between 3 and 160),
  subject     text not null check (char_length(subject) between 2 and 120),
  author      text not null default '',
  description text not null default '',
  url         text not null check (char_length(url) between 8 and 1000 and url ~ '^https://'),
  file_type   text not null default 'link' check (file_type in ('pdf', 'doc', 'ppt', 'video', 'link')),
  created_at  timestamptz not null default now()
);
create index materials_created_idx on public.materials (created_at desc);

-- ---------------------------------------------------------------------
-- events + event_registrations
-- ---------------------------------------------------------------------
create table public.events (
  id                uuid primary key default gen_random_uuid(),
  firebase_id       text unique,
  title             text not null check (char_length(title) between 3 and 160),
  description       text not null default '',
  category          text not null default 'seminar'
                    check (category in ('seminar', 'konfrans', 'goenullu', 'tedris-xarici', 'praktika')),
  location          text not null check (char_length(location) between 2 and 200),
  starts_at         timestamptz not null,
  ends_at           timestamptz,
  registration_open boolean not null default false,
  created_at        timestamptz not null default now()
);
create index events_starts_at_idx on public.events (starts_at);

create table public.event_registrations (
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) <= 200),
  email      text not null check (char_length(email) <= 320),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_registrations_user_idx on public.event_registrations (user_id);

-- ---------------------------------------------------------------------
-- schedule_entries  (Firestore: schedule)
-- start_time / end_time əvvəlki kimi "HH:MM" mətnidir (tətbiq onları mətn kimi müqayisə edir).
-- ---------------------------------------------------------------------
create table public.schedule_entries (
  id          uuid primary key default gen_random_uuid(),
  firebase_id text unique,
  day         smallint not null check (day between 1 and 7),
  start_time  text not null check (start_time ~ '^[0-9]{1,2}:[0-9]{2}$'),
  end_time    text not null check (end_time ~ '^[0-9]{1,2}:[0-9]{2}$'),
  subject     text not null check (char_length(subject) between 2 and 120),
  teacher     text not null default '',
  room        text not null default '',
  lesson_type text not null default 'muhazire' check (lesson_type in ('muhazire', 'seminar', 'praktika'))
);
create index schedule_entries_day_time_idx on public.schedule_entries (day, start_time);

-- ---------------------------------------------------------------------
-- contact_messages
-- ---------------------------------------------------------------------
create table public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  firebase_id text unique,
  name        text not null check (char_length(name) between 2 and 100),
  email       text not null check (char_length(email) between 5 and 160 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  subject     text not null check (char_length(subject) between 3 and 150),
  message     text not null check (char_length(message) between 10 and 3000),
  status      text not null default 'new' check (status in ('new', 'read')),
  created_at  timestamptz not null default now()
);
create index contact_messages_created_idx on public.contact_messages (created_at desc);

-- ---------------------------------------------------------------------
-- Şəxsi məlumatlar
-- ---------------------------------------------------------------------
create table public.saved_materials (
  user_id     uuid not null references auth.users (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, material_id)
);
create index saved_materials_material_idx on public.saved_materials (material_id);

create table public.personal_notes (
  id          uuid primary key default gen_random_uuid(),
  firebase_id text unique,
  user_id     uuid not null references auth.users (id) on delete cascade,
  text        text not null check (char_length(text) between 1 and 500),
  day         smallint not null check (day between 1 and 7),
  created_at  timestamptz not null default now()
);
create index personal_notes_user_idx on public.personal_notes (user_id, created_at desc);

-- key: "a-<elan id>" / "e-<tədbir id>" (bildiriş açarı)
create table public.notification_reads (
  user_id uuid not null references auth.users (id) on delete cascade,
  key     text not null check (char_length(key) between 1 and 100),
  read_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles            enable row level security;
alter table public.announcements       enable row level security;
alter table public.materials           enable row level security;
alter table public.events              enable row level security;
alter table public.event_registrations enable row level security;
alter table public.schedule_entries    enable row level security;
alter table public.contact_messages    enable row level security;
alter table public.saved_materials     enable row level security;
alter table public.personal_notes      enable row level security;
alter table public.notification_reads  enable row level security;

-- Cədvəl səviyyəsində icazələr: əvvəlcə hamısını geri al, sonra yalnız lazım olanı ver.
revoke all on all tables in schema public from anon, authenticated;

-- ---- profiles
grant select on public.profiles to authenticated;
grant update (first_name, last_name, student_id, degree, course, group_name, role) on public.profiles to authenticated;

create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy profiles_update_role_by_admin on public.profiles
  for update to authenticated
  using (public.is_admin() and id <> (select auth.uid()))
  with check (public.is_admin() and id <> (select auth.uid()));
-- insert/delete siyasəti yoxdur: profil yalnız handle_new_user() ilə yaranır, auth.users silinəndə cascade ilə silinir.

-- ---- announcements (dərc olunmuşları hamı, qaralamaları redaktor/admin görür)
grant select on public.announcements to anon, authenticated;
grant insert, update, delete on public.announcements to authenticated;

create policy announcements_select on public.announcements
  for select to anon, authenticated
  using (published or public.is_editor());
create policy announcements_insert on public.announcements
  for insert to authenticated with check (public.is_editor());
create policy announcements_update on public.announcements
  for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy announcements_delete on public.announcements
  for delete to authenticated using (public.is_editor());

-- ---- materials
grant select on public.materials to anon, authenticated;
grant insert, update, delete on public.materials to authenticated;

create policy materials_select on public.materials
  for select to anon, authenticated using (true);
create policy materials_insert on public.materials
  for insert to authenticated with check (public.is_editor());
create policy materials_update on public.materials
  for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy materials_delete on public.materials
  for delete to authenticated using (public.is_editor());

-- ---- events
grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;

create policy events_select on public.events
  for select to anon, authenticated using (true);
create policy events_insert on public.events
  for insert to authenticated with check (public.is_editor());
create policy events_update on public.events
  for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy events_delete on public.events
  for delete to authenticated using (public.is_editor());

-- ---- event_registrations (yalnız qeydiyyat açıq tədbirə, yalnız öz adından)
grant select, insert, delete on public.event_registrations to authenticated;

create policy event_registrations_select on public.event_registrations
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_editor());
create policy event_registrations_insert on public.event_registrations
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.events e where e.id = event_id and e.registration_open)
  );
create policy event_registrations_delete on public.event_registrations
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_editor());

-- ---- schedule_entries
grant select on public.schedule_entries to anon, authenticated;
grant insert, update, delete on public.schedule_entries to authenticated;

create policy schedule_select on public.schedule_entries
  for select to anon, authenticated using (true);
create policy schedule_insert on public.schedule_entries
  for insert to authenticated with check (public.is_editor());
create policy schedule_update on public.schedule_entries
  for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy schedule_delete on public.schedule_entries
  for delete to authenticated using (public.is_editor());

-- ---- contact_messages (hamı göndərə bilər; oxumaq/idarə etmək yalnız admin)
-- Müştəri yalnız 4 sahəni yaza bilər; status/created_at server tərəfindən təyin olunur.
grant insert (name, email, subject, message) on public.contact_messages to anon, authenticated;
grant select, delete on public.contact_messages to authenticated;
grant update (status) on public.contact_messages to authenticated;

create policy contact_messages_insert on public.contact_messages
  for insert to anon, authenticated with check (true);
create policy contact_messages_select on public.contact_messages
  for select to authenticated using (public.is_admin());
create policy contact_messages_update on public.contact_messages
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy contact_messages_delete on public.contact_messages
  for delete to authenticated using (public.is_admin());

-- ---- saved_materials / personal_notes / notification_reads (yalnız sahibi)
grant select, insert, delete on public.saved_materials to authenticated;
grant select, insert, update, delete on public.personal_notes to authenticated;
grant select, insert, delete on public.notification_reads to authenticated;

create policy saved_materials_owner_select on public.saved_materials
  for select to authenticated using (user_id = (select auth.uid()));
create policy saved_materials_owner_insert on public.saved_materials
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy saved_materials_owner_delete on public.saved_materials
  for delete to authenticated using (user_id = (select auth.uid()));

create policy personal_notes_owner_select on public.personal_notes
  for select to authenticated using (user_id = (select auth.uid()));
create policy personal_notes_owner_insert on public.personal_notes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy personal_notes_owner_update on public.personal_notes
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy personal_notes_owner_delete on public.personal_notes
  for delete to authenticated using (user_id = (select auth.uid()));

create policy notification_reads_owner_select on public.notification_reads
  for select to authenticated using (user_id = (select auth.uid()));
create policy notification_reads_owner_insert on public.notification_reads
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy notification_reads_owner_delete on public.notification_reads
  for delete to authenticated using (user_id = (select auth.uid()));
