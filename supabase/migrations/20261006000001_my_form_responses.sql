-- =====================================================================
-- Tələbənin öz form cavablarını (READ-ONLY) görməsi
--
--   * my_form_responses(): yalnız çağıran istifadəçinin (respondent_id = auth.uid()) cavablarını
--     formun başlığı və suallarıyla birlikdə qaytarır. Başqa tələbənin cavabına çıxış yoxdur.
--   * Form sonradan bağlansa və ya qaralamaya qaytarılsa belə, tələbə öz cavabına baxa bilir
--     (forms cədvəlinin RLS-i dəyişmir, ona görə funksiya security definer-dir).
--   * Cədvəllərə yazma icazəsi VERİLMİR: redaktə / silmə / yenidən göndərmə yoxdur.
--   * Mövcud cədvəllər və məlumatlar dəyişmir. 20261005000006-dan əvvəl göndərilmiş cavablarda
--     respondent_id yoxdur (anonim qalıb), ona görə onlar bu siyahıda görünmür.
-- =====================================================================

create or replace function public.my_form_responses()
returns table (
  response_id  uuid,
  form_id      uuid,
  slug         text,
  title        text,
  description  text,
  fields       jsonb,
  answers      jsonb,
  submitted_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.form_id, f.slug, f.title, f.description, f.fields, r.answers, r.submitted_at
    from public.form_responses r
    join public.forms f on f.id = r.form_id
   where r.respondent_id = (select auth.uid())
   order by r.submitted_at desc, r.id desc;
$$;

revoke all on function public.my_form_responses() from public, anon;
grant execute on function public.my_form_responses() to authenticated;
