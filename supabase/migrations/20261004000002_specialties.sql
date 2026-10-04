-- =====================================================================
-- ADPK ixtisasları: public.specialties (geriyə uyğun, əlavə miqrasiya)
--
--   * Mövcud cədvəllərə və məlumatlara toxunmur; 20261003000001 və 20261004000001 təkrar icra edilmir.
--   * Qrup siyahısı (public.groups) dəyişmir; yalnız groups.specialty -> specialties.code xarici açarı əlavə olunur.
--   * Oxu: hamı (aktiv ixtisaslar), redaktor/admin isə qeyri-aktivləri də görür.
--   * Yazma: yalnız admin (UPDATE). Yeni ixtisas əlavə etmək/silmək SQL redaktoru / service_role ilə.
--   * Qəbul balları rəsmi saytdan (adpk.edu.az/tedris/ixtisaslar) götürülüb. Rəsmi mənbədə
--     təsdiqlənməyən sahə NULL qalır; admission_confirmed=false isə qəbul blokunu gizlədir.
-- =====================================================================

create table public.specialties (
  code        text primary key check (char_length(code) between 1 and 40),
  name        text not null check (char_length(name) between 1 and 80),
  full_name   text not null check (char_length(full_name) between 1 and 160),
  program_code text check (program_code is null or program_code ~ '^[0-9]{4,10}$'),
  description text not null default '' check (char_length(description) <= 600),
  degree      text not null default 'Subbakalavr dərəcəsi' check (char_length(degree) <= 60),
  duration    text check (duration is null or char_length(duration) <= 30),
  semesters   text check (semesters is null or char_length(semesters) <= 30),
  credits     text check (credits is null or char_length(credits) <= 30),
  score_general_state      text check (score_general_state is null or score_general_state ~ '^[0-9]{1,3}([.,][0-9]{1,2})?$'),
  score_general_paid       text check (score_general_paid is null or score_general_paid ~ '^[0-9]{1,3}([.,][0-9]{1,2})?$'),
  score_complete_state     text check (score_complete_state is null or score_complete_state ~ '^[0-9]{1,3}([.,][0-9]{1,2})?$'),
  score_complete_paid      text check (score_complete_paid is null or score_complete_paid ~ '^[0-9]{1,3}([.,][0-9]{1,2})?$'),
  score_complete_paid_part text check (score_complete_paid_part is null or score_complete_paid_part ~ '^[0-9]{1,3}([.,][0-9]{1,2})?$'),
  admission_confirmed boolean not null default false,
  source_url  text check (source_url is null or (char_length(source_url) <= 500 and source_url ~ '^https://')),
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);
create index specialties_sort_idx on public.specialties (sort_order, code);

create trigger specialties_set_updated_at
  before update on public.specialties
  for each row execute function public.set_updated_at();

alter table public.specialties enable row level security;
revoke all on public.specialties from anon, authenticated;
grant select on public.specialties to anon, authenticated;
grant update (name, full_name, program_code, description, degree, duration, semesters, credits,
              score_general_state, score_general_paid, score_complete_state, score_complete_paid, score_complete_paid_part,
              admission_confirmed, source_url, active, sort_order)
  on public.specialties to authenticated;

create policy specialties_select on public.specialties
  for select to anon, authenticated
  using (active or public.is_editor());
create policy specialties_update on public.specialties
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- insert/delete siyasəti yoxdur: yalnız service_role / SQL redaktoru.

-- ---------------------------------------------------------------------
-- İlkin məlumat (src/data/specialties.ts ilə eyni; rəsmi mənbə: adpk.edu.az)
-- ---------------------------------------------------------------------
insert into public.specialties
  (code, name, full_name, program_code, description, degree, duration, semesters, credits,
   score_general_state, score_general_paid, score_complete_state, score_complete_paid, score_complete_paid_part,
   admission_confirmed, source_url, active, sort_order)
values
  ('Sİ', 'Sosial İş', 'Sosial İş', '040713',
   'Sosial xidmətlər, icma inkişafı və sosial müdaxilə metodları üzrə biliklər əldə edərək sosial sahədə fəaliyyət göstərən dövlət və qeyri-dövlət qurumlarında çalışmaq üçün hazırlanırsınız.',
   'Subbakalavr dərəcəsi', '2-3', '4-6', '120',
   '100,7', '89,3', '130', '90,8', '40,4',
   true, 'https://adpk.edu.az/tedris/ixtisaslar', true, 1),
  ('KŞATS', 'KŞATS', 'Kompüter Şəbəkəsi Avadanlıqlarının Təmiri və Servisi', '040533',
   'Kompüter və şəbəkə avadanlıqlarının texniki xidməti, diaqnostikası, təmiri və servis prosesləri üzrə praktiki bilik və bacarıqlar qazanırsınız.',
   'Subbakalavr dərəcəsi', '2-3', '4-6', '120',
   '115,6', '157,3', '110,1', '148,1', null,
   true, 'https://adpk.edu.az/tedris/ixtisaslar', true, 2),
  ('KŞŞİ', 'KŞŞİ', 'Kompüter Şəbəkəsi və Şəbəkə İnzibatçılığı', '040532',
   'Şəbəkə infrastrukturunun qurulması, idarə edilməsi, server sistemləri və kibertəhlükəsizliyin əsasları üzrə praktiki biliklər əldə edirsiniz.',
   'Subbakalavr dərəcəsi', '2-3', '4-6', '120',
   '133,4', '106,5', '150,6', '116,4', null,
   true, 'https://adpk.edu.az/tedris/ixtisaslar', true, 3);

-- groups.specialty yalnız mövcud ixtisaslara istinad edə bilər (mövcud 29 qrup 3 ixtisasa uyğundur).
alter table public.groups
  add constraint groups_specialty_fk foreign key (specialty)
  references public.specialties (code) on update cascade;
