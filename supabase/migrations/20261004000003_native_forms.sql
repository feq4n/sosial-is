-- =====================================================================
-- Formlar / sorğular (portalın daxilində, ayrıca xidmət olmadan)
--
--   * public.forms            : form təyini (suallar jsonb), status, son tarix, auditoriya (ixtisas / qrup)
--   * public.form_responses   : cavablar. Tələbə identifikatoru BU CƏDVƏLDƏ YOXDUR (anonim).
--   * public.form_submissions : kim doldurub (bir tələbə = bir cavab). Cavabdan ayrıdır; admin paneli bunu göstərmir.
--   * public.submit_form()    : cavabı serverdə yoxlayıb yazan yeganə yol (müştəri cavab cədvəlinə birbaşa yaza bilmir)
--
-- 20261004000002_specialties.sql-dən SONRA bir dəfə işə salın (Supabase SQL Editor).
-- Mövcud cədvəllərə və məlumatlara toxunmur.
-- =====================================================================

-- ---------------------------------------------------------------------
-- forms
-- ---------------------------------------------------------------------
create table public.forms (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
              check (slug ~ '^[a-z0-9]{6,40}$'),
  title       text not null check (char_length(title) between 3 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  status      text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  closes_at   timestamptz,
  audience_mode        text   not null default 'all' check (audience_mode in ('all', 'restricted')),
  audience_specialties text[] not null default '{}',
  audience_groups      text[] not null default '{}',
  fields      jsonb not null default '[]'::jsonb,
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz,
  constraint forms_fields_array check (jsonb_typeof(fields) = 'array' and jsonb_array_length(fields) <= 60 and octet_length(fields::text) <= 100000),
  constraint forms_audience_size check (cardinality(audience_specialties) <= 20 and cardinality(audience_groups) <= 100),
  -- «məhdud» auditoriya boş ola bilməz (heç kim görməyən form səhvdir)
  constraint forms_audience_nonempty check (audience_mode = 'all' or cardinality(audience_specialties) + cardinality(audience_groups) > 0)
);
create index forms_created_idx on public.forms (created_at desc);
create index forms_status_idx on public.forms (status);

create trigger forms_set_updated_at
  before update on public.forms
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Sual və auditoriya yoxlaması (verilənlər bazası səviyyəsində; src/lib/forms.ts ilə eyni qaydalar)
--   sual: { id, type, label, required?, help?, options? }
--   id    : ^[a-z][a-z0-9_]{0,39}$ və unikal
--   type  : text | textarea | number | email | date | radio | select | checkbox | scale
--   options (radio/select/checkbox): 1-50 unikal, boş olmayan mətn (≤200 simvol)
-- ---------------------------------------------------------------------
create or replace function public.forms_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  f    jsonb;
  o    jsonb;
  opts jsonb;
  ids  text[] := '{}';
  fid  text;
  ft   text;
begin
  if exists (
    select 1 from unnest(new.audience_specialties) s
    where not exists (select 1 from public.specialties sp where sp.code = s)
  ) or exists (
    select 1 from unnest(new.audience_groups) g
    where not exists (select 1 from public.groups gr where gr.code = g)
  ) then
    raise exception 'invalid-audience';
  end if;

  for f in select value from jsonb_array_elements(new.fields) loop
    if jsonb_typeof(f) <> 'object' then raise exception 'invalid-form'; end if;

    fid := f ->> 'id';
    ft  := f ->> 'type';
    if coalesce(jsonb_typeof(f -> 'id'), '') <> 'string' or fid !~ '^[a-z][a-z0-9_]{0,39}$' or fid = any (ids) then
      raise exception 'invalid-form';
    end if;
    ids := ids || fid;

    if coalesce(jsonb_typeof(f -> 'type'), '') <> 'string'
       or ft not in ('text', 'textarea', 'number', 'email', 'date', 'radio', 'select', 'checkbox', 'scale') then
      raise exception 'invalid-form';
    end if;
    if coalesce(jsonb_typeof(f -> 'label'), '') <> 'string' or char_length(btrim(f ->> 'label')) not between 1 and 200 then
      raise exception 'invalid-form';
    end if;
    if (f ? 'required') and jsonb_typeof(f -> 'required') <> 'boolean' then raise exception 'invalid-form'; end if;
    if (f ? 'help') and (jsonb_typeof(f -> 'help') <> 'string' or char_length(f ->> 'help') > 500) then
      raise exception 'invalid-form';
    end if;

    if ft in ('radio', 'select', 'checkbox') then
      opts := f -> 'options';
      if coalesce(jsonb_typeof(opts), '') <> 'array' or jsonb_array_length(opts) not between 1 and 50 then
        raise exception 'invalid-form';
      end if;
      for o in select value from jsonb_array_elements(opts) loop
        if jsonb_typeof(o) <> 'string' or char_length(btrim(o #>> '{}')) not between 1 and 200 then
          raise exception 'invalid-form';
        end if;
      end loop;
      if (select count(distinct x) from jsonb_array_elements_text(opts) x) <> jsonb_array_length(opts) then
        raise exception 'invalid-form';
      end if;
    end if;
  end loop;

  return new;
end;
$$;

create trigger forms_validate_trg
  before insert or update on public.forms
  for each row execute function public.forms_validate();

-- ---------------------------------------------------------------------
-- Cavablar (anonim) və doldurma qeydi
-- Vaxt saata yuvarlaqlaşdırılır ki, iki cədvəl bir-biri ilə dəqiq saniyə üzrə uyğunlaşdırılmasın.
-- ---------------------------------------------------------------------
create table public.form_responses (
  id           uuid primary key default gen_random_uuid(),
  form_id      uuid not null references public.forms (id) on delete cascade,
  answers      jsonb not null check (jsonb_typeof(answers) = 'object'),
  submitted_at timestamptz not null default date_trunc('hour', now())
);
create index form_responses_form_idx on public.form_responses (form_id, submitted_at);

create table public.form_submissions (
  form_id      uuid not null references public.forms (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  submitted_at timestamptz not null default date_trunc('hour', now()),
  primary key (form_id, user_id)
);
create index form_submissions_user_idx on public.form_submissions (user_id);

-- ---------------------------------------------------------------------
-- Köməkçi: cari istifadəçi bu auditoriyadadırmı (RLS-də istifadə olunur)
-- ---------------------------------------------------------------------
create or replace function public.form_visible_to_me(p_mode text, p_specs text[], p_groups text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_mode = 'all' or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and (p.specialty = any (p_specs) or p.group_name = any (p_groups))
  );
$$;

revoke all on function public.form_visible_to_me(text, text[], text[]) from public, anon;
grant execute on function public.form_visible_to_me(text, text[], text[]) to authenticated;

-- ---------------------------------------------------------------------
-- Cavabı serverdə yoxlayıb yazır.
--   * giriş tələb olunur, form dərc olunmuş və vaxtı bitməmiş olmalıdır
--   * auditoriya tələbənin profilindən (profiles) yoxlanılır; müştərinin dediyinə güvənilmir
--   * hər cavab sualların təyininə görə yoxlanılır; təyində olmayan açarlar atılır
--   * bir tələbə bir dəfə doldura bilər (form_submissions primary key)
-- Xəta mesajları sabit kodlardır; interfeys onları Azərbaycan dilinə çevirir.
-- ---------------------------------------------------------------------
create or replace function public.submit_form(p_form_id uuid, p_answers jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid   uuid := (select auth.uid());
  f     public.forms%rowtype;
  me    record;
  fld   jsonb;
  item  jsonb;
  fid   text;
  ft    text;
  req   boolean;
  v     jsonb;
  vt    text;
  is_empty boolean;
  txt   text;
  num   numeric;
  d     date;
  clean jsonb := '{}'::jsonb;
begin
  if uid is null then
    raise exception 'not-authenticated' using errcode = '42501';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' or octet_length(p_answers::text) > 60000 then
    raise exception 'invalid-answers';
  end if;

  select * into f from public.forms where id = p_form_id and status = 'published';
  if not found then raise exception 'form-unavailable'; end if;
  if f.closes_at is not null and f.closes_at <= now() then raise exception 'form-closed'; end if;

  if f.audience_mode = 'restricted' then
    select p.specialty, p.group_name into me from public.profiles p where p.id = uid;
    if not found then raise exception 'form-not-allowed'; end if;
    -- NULL = any(...) NULL verir; coalesce olmasa ixtisassız istifadəçi keçərdi
    if not coalesce((me.specialty = any (f.audience_specialties)) or (me.group_name = any (f.audience_groups)), false) then
      raise exception 'form-not-allowed';
    end if;
  end if;

  for fld in select value from jsonb_array_elements(f.fields) loop
    fid := fld ->> 'id';
    ft  := fld ->> 'type';
    req := coalesce((fld ->> 'required')::boolean, false);
    v   := p_answers -> fid;
    vt  := jsonb_typeof(v);

    is_empty := case
      when v is null then true
      when vt = 'null' then true
      when vt = 'string' then btrim(v #>> '{}') = ''
      when vt = 'array' then jsonb_array_length(v) = 0
      else false
    end;
    if is_empty then
      if req then raise exception 'invalid-answers'; end if;
      continue;
    end if;

    case ft
      when 'text', 'textarea', 'email' then
        if vt <> 'string' then raise exception 'invalid-answers'; end if;
        txt := btrim(v #>> '{}');
        if char_length(txt) > (case when ft = 'textarea' then 4000 else 500 end) then
          raise exception 'invalid-answers';
        end if;
        if ft = 'email' and txt !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
          raise exception 'invalid-answers';
        end if;
        clean := clean || jsonb_build_object(fid, txt);

      when 'number' then
        if vt <> 'number' then raise exception 'invalid-answers'; end if;
        num := (v #>> '{}')::numeric;
        if abs(num) > 1000000000000 then raise exception 'invalid-answers'; end if;
        clean := clean || jsonb_build_object(fid, num);

      when 'scale' then
        if vt <> 'number' then raise exception 'invalid-answers'; end if;
        num := (v #>> '{}')::numeric;
        if num <> trunc(num) or num < 1 or num > 5 then raise exception 'invalid-answers'; end if;
        clean := clean || jsonb_build_object(fid, num);

      when 'date' then
        if vt <> 'string' or (v #>> '{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
          raise exception 'invalid-answers';
        end if;
        begin
          d := (v #>> '{}')::date;
        exception when others then
          raise exception 'invalid-answers';
        end;
        if d < date '1900-01-01' or d > date '2100-12-31' then raise exception 'invalid-answers'; end if;
        clean := clean || jsonb_build_object(fid, to_char(d, 'YYYY-MM-DD'));

      when 'radio', 'select' then
        if vt <> 'string' or not ((fld -> 'options') @> v) then raise exception 'invalid-answers'; end if;
        clean := clean || jsonb_build_object(fid, v);

      when 'checkbox' then
        if vt <> 'array' or jsonb_array_length(v) > 50 then raise exception 'invalid-answers'; end if;
        for item in select value from jsonb_array_elements(v) loop
          if jsonb_typeof(item) <> 'string' or not ((fld -> 'options') @> item) then
            raise exception 'invalid-answers';
          end if;
        end loop;
        if (select count(distinct x) from jsonb_array_elements_text(v) x) <> jsonb_array_length(v) then
          raise exception 'invalid-answers';
        end if;
        clean := clean || jsonb_build_object(fid, v);

      else
        raise exception 'invalid-answers';
    end case;
  end loop;

  begin
    insert into public.form_submissions (form_id, user_id) values (f.id, uid);
  exception when unique_violation then
    raise exception 'form-already-submitted';
  end;

  insert into public.form_responses (form_id, answers) values (f.id, clean);
end;
$$;

revoke all on function public.submit_form(uuid, jsonb) from public, anon;
grant execute on function public.submit_form(uuid, jsonb) to authenticated;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.forms            enable row level security;
alter table public.form_responses   enable row level security;
alter table public.form_submissions enable row level security;

revoke all on public.forms, public.form_responses, public.form_submissions from anon, authenticated;

-- ---- forms: admin hamısını idarə edir; tələbə yalnız dərc olunmuş və öz auditoriyasına aid formları oxuyur
grant select, delete on public.forms to authenticated;
grant insert (title, description, status, closes_at, audience_mode, audience_specialties, audience_groups, fields)
  on public.forms to authenticated;
grant update (title, description, status, closes_at, audience_mode, audience_specialties, audience_groups, fields)
  on public.forms to authenticated;
-- slug, created_by, created_at dəyişməzdir (sütun icazəsi yoxdur)

create policy forms_select on public.forms
  for select to authenticated
  using (
    public.is_admin()
    or (status = 'published' and public.form_visible_to_me(audience_mode, audience_specialties, audience_groups))
  );
create policy forms_insert on public.forms
  for insert to authenticated with check (public.is_admin());
create policy forms_update on public.forms
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy forms_delete on public.forms
  for delete to authenticated using (public.is_admin());

-- ---- form_responses: yalnız admin oxuyur; yazma yalnız submit_form() ilə (insert/update siyasəti yoxdur)
grant select on public.form_responses to authenticated;
create policy form_responses_select on public.form_responses
  for select to authenticated using (public.is_admin());

-- ---- form_submissions: tələbə yalnız özünün doldurma qeydini görür (formun «Doldurulub» nişanı üçün)
grant select on public.form_submissions to authenticated;
create policy form_submissions_select_own on public.form_submissions
  for select to authenticated using (user_id = (select auth.uid()));
