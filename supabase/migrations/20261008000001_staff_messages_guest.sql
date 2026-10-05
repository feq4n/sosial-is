alter table public.staff_messages alter column sender_id drop not null;

do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.staff_messages'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%sender_id <> recipient_id%'
  loop
    execute format('alter table public.staff_messages drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.staff_messages
  add column if not exists sender_group text not null default '',
  add column if not exists sender_key text,
  add column if not exists client_key text;

alter table public.staff_messages
  add constraint staff_messages_not_self check (sender_id is null or sender_id <> recipient_id),
  add constraint staff_messages_sender_group_len check (char_length(sender_group) <= 50),
  add constraint staff_messages_sender_name_len check (char_length(sender_name) <= 100) not valid;

update public.staff_messages
set sender_key = sender_id::text
where sender_id is not null and sender_key is null;

update public.staff_messages m
set sender_group = coalesce(p.group_name, '')
from public.profiles p
where p.id = m.sender_id and m.sender_group = '';

create index if not exists staff_messages_sender_key_idx
  on public.staff_messages (sender_key, created_at desc);
create index if not exists staff_messages_guest_recipient_idx
  on public.staff_messages (recipient_id, created_at desc) where sender_id is null;
create index if not exists staff_messages_client_key_idx
  on public.staff_messages (client_key, created_at desc) where client_key is not null;

create or replace function public.staff_message_client_key()
returns text
language sql
stable
set search_path = ''
as $$ select null::text $$;
revoke all on function public.staff_message_client_key() from public;

create or replace function public.staff_messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  s_name text;
  s_group text;
  r_name text;
begin
  new.status := 'sent';
  new.read_at := null;
  new.created_at := now();
  new.subject := btrim(new.subject);
  new.message := btrim(new.message);

  if new.sender_id is not null then
    select btrim(p.first_name || ' ' || p.last_name), nullif(btrim(coalesce(p.group_name, '')), '')
      into s_name, s_group
    from public.profiles p
    where p.id = new.sender_id;
    if s_name is null then
      raise exception 'login-required' using errcode = '42501';
    end if;
    s_group := coalesce(s_group, new.sender_group);
  else
    s_name := new.sender_name;
    s_group := new.sender_group;
  end if;

  s_name := btrim(regexp_replace(coalesce(s_name, ''), '\s+', ' ', 'g'));
  s_group := btrim(regexp_replace(coalesce(s_group, ''), '\s+', ' ', 'g'));

  if s_name = '' or char_length(s_name) > 100 then
    raise exception 'invalid-sender-name' using errcode = '23514';
  end if;
  if s_group = '' or char_length(s_group) > 50 then
    raise exception 'invalid-sender-group' using errcode = '23514';
  end if;

  if new.sender_id is not null and new.sender_id = new.recipient_id then
    raise exception 'message-self' using errcode = '23514';
  end if;

  select t.full_name into r_name
  from public.team_members t
  join public.profiles p on p.id = t.profile_id
  where t.profile_id = new.recipient_id and t.active and p.role in ('admin', 'editor');
  if r_name is null then
    raise exception 'invalid-recipient' using errcode = '23514';
  end if;

  new.sender_key := coalesce(new.sender_id::text, 'guest:' || md5(lower(s_name) || '|' || lower(s_group)));
  new.client_key := case when new.sender_id is null then public.staff_message_client_key() else null end;

  if (select count(*) from public.staff_messages m
      where m.sender_key = new.sender_key and m.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'message-rate-limit' using errcode = '54000';
  end if;

  if new.sender_id is null then
    if new.client_key is not null
       and (select count(*) from public.staff_messages m
            where m.client_key = new.client_key and m.created_at > now() - interval '1 hour') >= 20 then
      raise exception 'message-rate-limit' using errcode = '54000';
    end if;
    if (select count(*) from public.staff_messages m
        where m.sender_id is null and m.recipient_id = new.recipient_id
          and m.created_at > now() - interval '1 hour') >= 30 then
      raise exception 'message-rate-limit' using errcode = '54000';
    end if;
  end if;

  new.sender_name := s_name;
  new.sender_group := s_group;
  new.recipient_name := r_name;
  return new;
end;
$$;
revoke all on function public.staff_messages_before_insert() from public;

create or replace function public.send_staff_message(
  p_recipient_id uuid,
  p_subject text,
  p_message text,
  p_sender_name text default null,
  p_sender_group text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if p_recipient_id is null then
    raise exception 'invalid-recipient' using errcode = '23514';
  end if;

  insert into public.staff_messages (sender_id, recipient_id, subject, message, sender_name, sender_group)
  values (
    (select auth.uid()),
    p_recipient_id,
    coalesce(p_subject, ''),
    coalesce(p_message, ''),
    coalesce(p_sender_name, ''),
    coalesce(p_sender_group, '')
  )
  returning id into new_id;

  return new_id;
end;
$$;
revoke all on function public.send_staff_message(uuid, text, text, text, text) from public;
grant execute on function public.send_staff_message(uuid, text, text, text, text) to anon, authenticated;

revoke insert on public.staff_messages from authenticated;
drop policy if exists staff_messages_insert on public.staff_messages;
