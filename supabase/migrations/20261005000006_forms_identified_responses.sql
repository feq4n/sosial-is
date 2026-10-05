-- =====================================================================
-- Formlar: girişli istifadəçinin cavabı kimliklə + qonaq (qeydiyyatsız) doldurma
--
--   * form_responses-a respondent_id / respondent_name / respondent_email əlavə olunur.
--       - Girişli istifadəçi: ad və e-poçt serverdə PROFİLDƏN götürülür (müştərinin dediyinə güvənilmir).
--       - Qonaq (anon): heç bir şəxsi məlumat soruşulmur və saxlanılmır, cavab ANONİM olur (üç sütun NULL).
--       - Köhnə (anonim) cavablar olduğu kimi qalır.
--   * Qonaq yalnız auditoriyası «hamı» olan dərc olunmuş formu görə və doldura bilər.
--     «Məhdud» auditoriya (ixtisas/qrup) profil tələb edir, ona görə giriş lazımdır.
--   * Təkrar doldurma: girişli istifadəçi üçün (form_id, user_id) əvvəlki kimi. Qonağı təkrardan qorumaq
--     mümkün deyil (kimliyi yoxdur), spam üçün CAPTCHA/rate-limit tövsiyə olunur.
--   * submit_form imzası eyni qalır, amma indi anon üçün də açıqdır.
--
-- 20261005000005_drop_legacy_profile_columns.sql-dən SONRA bir dəfə işə salın.
-- =====================================================================

alter table public.form_responses
  add column respondent_id    uuid references auth.users (id) on delete set null,
  add column respondent_name  text check (respondent_name  is null or char_length(respondent_name)  between 1 and 130),
  add column respondent_email text check (respondent_email is null or char_length(respondent_email) between 3 and 320);

-- Kimlik artıq saxlanıldığı üçün vaxtı saata yuvarlaqlaşdırmağa ehtiyac yoxdur.
alter table public.form_responses alter column submitted_at set default now();

-- ---------------------------------------------------------------------
-- Qonaq (anon) dərc olunmuş «hamı» formlarını oxuya bilər (created_by sütunu xaric)
-- ---------------------------------------------------------------------
grant select (id, slug, title, description, status, closes_at, audience_mode,
              audience_specialties, audience_groups, fields, created_at)
  on public.forms to anon;

create policy forms_select_anon on public.forms
  for select to anon
  using (status = 'published' and audience_mode = 'all');

-- ---------------------------------------------------------------------
-- submit_form: qeydiyyatlı və qonaq üçün
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
  r_name  text;
  r_email text;
begin
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' or octet_length(p_answers::text) > 60000 then
    raise exception 'invalid-answers';
  end if;

  select * into f from public.forms where id = p_form_id and status = 'published';
  if not found then raise exception 'form-unavailable'; end if;
  if f.closes_at is not null and f.closes_at <= now() then raise exception 'form-closed'; end if;

  if f.audience_mode = 'restricted' then
    if uid is null then raise exception 'login-required'; end if;
    select p.specialty, p.group_name into me from public.profiles p where p.id = uid;
    if not found then raise exception 'form-not-allowed'; end if;
    -- NULL = any(...) NULL verir; coalesce olmasa ixtisassız istifadəçi keçərdi
    if not coalesce((me.specialty = any (f.audience_specialties)) or (me.group_name = any (f.audience_groups)), false) then
      raise exception 'form-not-allowed';
    end if;
  end if;

  -- Cavab verənin kimliyi: yalnız girişli istifadəçi üçün (profildən); qonaq anonim qalır (r_name, r_email = NULL)
  if uid is not null then
    select btrim(p.first_name || ' ' || p.last_name), lower(p.email) into r_name, r_email
      from public.profiles p where p.id = uid;
    if r_email is null then
      select lower(u.email) into r_email from auth.users u where u.id = uid;
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

  if uid is not null then
    begin
      insert into public.form_submissions (form_id, user_id) values (f.id, uid);
    exception when unique_violation then
      raise exception 'form-already-submitted';
    end;
  end if;

  begin
    insert into public.form_responses (form_id, answers, respondent_id, respondent_name, respondent_email)
    values (f.id, clean, uid, r_name, r_email);
  exception when unique_violation then
    raise exception 'form-already-submitted';
  end;
end;
$$;

revoke all on function public.submit_form(uuid, jsonb) from public;
grant execute on function public.submit_form(uuid, jsonb) to anon, authenticated;
