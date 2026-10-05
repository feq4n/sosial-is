-- =====================================================================
-- Şöbə əməkdaşlarına mesaj göndərmə (Tələbə -> konkret əməkdaş)
--
-- Bu, chat deyil: sadə müraciət -> oxundu məntiqidir. Realtime, əlavə fayl, e-poçt yoxdur.
--
-- 1) team_members.profile_id: «Şöbə əməkdaşları» kartını (ictimai məzmun) həqiqi hesaba bağlayır.
--    Mesaj yalnız hesaba bağlı, aktiv və rolu admin/editor olan əməkdaşa göndərilə bilər.
--    Bağlantını yalnız admin təyin edir (mövcud team_members RLS-i).
-- 2) public.staff_messages: mesajlar ayrıca cədvəldədir (contact_messages ilə qarışmır).
--
-- Təhlükəsizlik (frontend-ə güvənilmir):
--   * sender_id müştəridən qəbul edilmir: DEFAULT auth.uid() və INSERT üçün sütun icazəsi yalnız
--     (recipient_id, subject, message). Başqasının adından mesaj göndərmək mümkün deyil.
--   * status / read_at / created_at / ad snapshot-ları tətik ilə serverdə təyin olunur.
--   * Alıcı yoxlanışı tətikdədir (hesaba bağlı aktiv əməkdaş, admin/editor rolu, özünə deyil).
--   * Sürət limiti: bir göndərən saatda ən çox 20 mesaj.
--   * Tələbə: yalnız öz mesajlarını görür, redaktə/silə bilmir (UPDATE/DELETE icazəsi yoxdur).
--   * Əməkdaş: yalnız ona göndəriləni görür; yeganə dəyişiklik 'sent' -> 'read' (read_at server vaxtıdır).
--   * Admin: bütün mesajları görə və silə bilər (moderasiya); başqasının adından oxundu işarələyə bilməz.
--
-- Gələcək e-poçt bildirişi: bu cədvəldə AFTER INSERT tətiki və ya Supabase Database Webhook ilə
-- (recipient_id -> profiles.email) əlavə edilə bilər; mövcud sxemi dəyişmək lazım deyil.
--
-- sender_name / recipient_name: göndərilmə anının snapshot-ıdır. Əməkdaşın tələbə profilini oxumaq
-- icazəsi olmadığı üçün (profiles RLS) ad serverdə mesajla birlikdə yazılır.
-- =====================================================================

-- ---------------------------------------------------------------------
-- team_members.profile_id
-- ---------------------------------------------------------------------
alter table public.team_members
  add column if not exists profile_id uuid references public.profiles (id) on delete set null;

-- Bir hesab yalnız bir əməkdaş kartına bağlana bilər.
create unique index if not exists team_members_profile_key
  on public.team_members (profile_id) where profile_id is not null;

grant insert (profile_id), update (profile_id) on public.team_members to authenticated;

-- Bağlanan hesab admin və ya editor olmalıdır (əməkdaş hesabları).
create or replace function public.team_members_check_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.profile_id is not null
     and (tg_op = 'INSERT' or new.profile_id is distinct from old.profile_id)
     and not exists (select 1 from public.profiles p where p.id = new.profile_id and p.role in ('admin', 'editor')) then
    raise exception 'invalid-staff-account' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.team_members_check_profile() from public;

drop trigger if exists team_members_check_profile_trg on public.team_members;
create trigger team_members_check_profile_trg
  before insert or update on public.team_members
  for each row execute function public.team_members_check_profile();

-- ---------------------------------------------------------------------
-- staff_messages
-- ---------------------------------------------------------------------
create table public.staff_messages (
  id             uuid primary key default gen_random_uuid(),
  sender_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipient_id   uuid not null references public.profiles (id) on delete cascade,
  subject        text not null check (char_length(subject) between 3 and 150),
  message        text not null check (char_length(message) between 5 and 3000),
  status         text not null default 'sent' check (status in ('sent', 'read')),
  created_at     timestamptz not null default now(),
  read_at        timestamptz,
  sender_name    text not null default '',
  recipient_name text not null default '',
  check ((status = 'sent' and read_at is null) or (status = 'read' and read_at is not null)),
  check (sender_id <> recipient_id)
);

create index staff_messages_sender_idx    on public.staff_messages (sender_id, created_at desc);
create index staff_messages_recipient_idx on public.staff_messages (recipient_id, status, created_at desc);

comment on table public.staff_messages is
  'Tələbə -> konkret əməkdaş müraciətləri (chat deyil). Status: sent | read. E-poçt bildirişi üçün AFTER INSERT tətiki əlavə edilə bilər.';

-- INSERT: serverdə təyin olunan sahələr + alıcı yoxlanışı + sürət limiti.
create or replace function public.staff_messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  s_name text;
  r_name text;
begin
  new.status := 'sent';
  new.read_at := null;
  new.created_at := now();
  new.subject := btrim(new.subject);
  new.message := btrim(new.message);

  if new.sender_id is null then
    raise exception 'login-required' using errcode = '42501';
  end if;
  if new.sender_id = new.recipient_id then
    raise exception 'message-self' using errcode = '23514';
  end if;

  select btrim(p.first_name || ' ' || p.last_name) into s_name from public.profiles p where p.id = new.sender_id;
  if s_name is null then
    raise exception 'login-required' using errcode = '42501';
  end if;

  select t.full_name into r_name
  from public.team_members t
  join public.profiles p on p.id = t.profile_id
  where t.profile_id = new.recipient_id and t.active and p.role in ('admin', 'editor');
  if r_name is null then
    raise exception 'invalid-recipient' using errcode = '23514';
  end if;

  if (select count(*) from public.staff_messages m
      where m.sender_id = new.sender_id and m.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'message-rate-limit' using errcode = '54000';
  end if;

  new.sender_name := s_name;
  new.recipient_name := r_name;
  return new;
end;
$$;
revoke all on function public.staff_messages_before_insert() from public;

create trigger staff_messages_before_insert_trg
  before insert on public.staff_messages
  for each row execute function public.staff_messages_before_insert();

-- UPDATE: müştəri üçün yeganə icazəli keçid 'sent' -> 'read' (read_at server vaxtı). Qalan hər şey dəyişməzdir.
-- service_role / SQL redaktoru (müştəri rolu olmayan) məhdudlaşdırılmır.
create or replace function public.staff_messages_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if (new.id, new.sender_id, new.recipient_id, new.subject, new.message, new.created_at, new.sender_name, new.recipient_name)
       is distinct from
       (old.id, old.sender_id, old.recipient_id, old.subject, old.message, old.created_at, old.sender_name, old.recipient_name) then
      raise exception 'message-immutable' using errcode = '42501';
    end if;

    if new.status is distinct from old.status then
      if old.status = 'sent' and new.status = 'read' then
        new.read_at := now();
      else
        raise exception 'message-immutable' using errcode = '42501';
      end if;
    else
      new.read_at := old.read_at;
    end if;
  end if;
  return new;
end;
$$;

create trigger staff_messages_before_update_trg
  before update on public.staff_messages
  for each row execute function public.staff_messages_before_update();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.staff_messages enable row level security;
revoke all on public.staff_messages from anon, authenticated;

grant select on public.staff_messages to authenticated;
grant insert (recipient_id, subject, message) on public.staff_messages to authenticated;
grant update (status) on public.staff_messages to authenticated;
grant delete on public.staff_messages to authenticated;

-- Göndərən öz mesajlarını, alıcı ona göndərilənləri, admin hamısını görür.
create policy staff_messages_select on public.staff_messages
  for select to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()) or public.is_admin());

-- Yalnız öz adından yaza bilər (sender_id DEFAULT auth.uid(); müştəri onu göndərə bilmir).
create policy staff_messages_insert on public.staff_messages
  for insert to authenticated
  with check (sender_id = (select auth.uid()));

-- Yalnız alıcı öz mesajını oxundu işarələyə bilər.
create policy staff_messages_update_recipient on public.staff_messages
  for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

-- Silmək yalnız admin üçündür (tələbə və əməkdaş silə bilmir).
create policy staff_messages_delete_admin on public.staff_messages
  for delete to authenticated
  using (public.is_admin());
