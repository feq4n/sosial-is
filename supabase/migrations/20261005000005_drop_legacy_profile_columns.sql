-- =====================================================================
-- profiles.student_id və profiles.course sütunlarının silinməsi
--
--   !!! BU MİQRASİYANI YALNIZ yeni frontend yerləşdirildikdən SONRA işə salın. !!!
--   Köhnə frontend profil yeniləyərkən student_id göndərir; sütun silinibsə həmin sorğu uğursuz olar.
--
--   * Silinməzdən əvvəl dolu dəyərlər public._legacy_profile_columns_backup cədvəlinə köçürülür
--     (RLS açıqdır və heç bir müştəri rolunun icazəsi yoxdur: yalnız SQL Editor/service_role oxuya bilər).
--     Ehtiyac yoxdursa, cədvəli sonradan əl ilə silin:  drop table public._legacy_profile_columns_backup;
--   * Tələbə hesabları və digər məlumatlar silinmir. profiles.degree toxunulmazdır (kurs deyil).
--   * Miqrasiya təkrar işə salınsa zərərsizdir (if exists).
--
-- Bu fayl 20261005000004_materials_files.sql-dən SONRA işə salınır.
-- =====================================================================

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles' and column_name in ('student_id', 'course')) then
    create table if not exists public._legacy_profile_columns_backup (
      id         uuid primary key,
      student_id text,
      course     smallint,
      saved_at   timestamptz not null default now()
    );
    alter table public._legacy_profile_columns_backup enable row level security;
    revoke all on public._legacy_profile_columns_backup from anon, authenticated;

    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'profiles' and column_name = 'student_id')
       and exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'profiles' and column_name = 'course') then
      insert into public._legacy_profile_columns_backup (id, student_id, course)
      select id, student_id, course from public.profiles where student_id is not null or course is not null
      on conflict (id) do nothing;
    end if;
  end if;
end $$;

alter table public.profiles drop column if exists student_id;
alter table public.profiles drop column if exists course;
