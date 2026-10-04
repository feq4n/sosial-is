-- =====================================================================
-- Admin tərəfindən idarə olunan sayt məzmunu
--
--   site_settings : sayt adı, ana səhifə mətnləri, əlaqə məlumatları, footer mətni (açar-dəyər, yalnız icazəli açarlar)
--   faq_items     : tez-tez verilən suallar (sıralanan, aktiv/deaktiv)
--   footer_links  : footer naviqasiya keçidləri (daxili "/yol" və ya https://)
--   team_members  : "Komandamız" üzvləri (şəkil Storage bucket-dadır: team-photos)
--
--   * Oxu: hamı (aktivlər); admin qeyri-aktivləri də görür.
--   * Yazma: YALNIZ admin (RLS). Redaktor və tələbə yaza bilməz.
--   * İlkin məlumat "on conflict do nothing" ilə yazılır: təkrar işlətmək admin dəyişikliklərini əzmir.
--   * Developer qeydi ("Developed by Feqan Gəraylı" + https://feqan.dev) verilənlər bazasında DEYİL, kodda sabitdir
--     və admin paneli onu dəyişə və ya silə bilmir.
--
-- Bu fayl 20261005000002_super_admin.sql-dən SONRA işə salınır.
-- =====================================================================

-- ---------------------------------------------------------------------
-- site_settings
-- ---------------------------------------------------------------------
create table public.site_settings (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz,
  constraint site_settings_valid check (
    (key = 'site_name'       and char_length(btrim(value)) between 1 and 60)
    or (key = 'home_title'   and char_length(btrim(value)) between 1 and 160)
    or (key = 'home_text'    and char_length(value) <= 1000)
    or (key = 'about_title'  and char_length(btrim(value)) between 1 and 120)
    or (key = 'about_text'   and char_length(value) <= 1000)
    or (key = 'contact_email' and char_length(value) <= 160 and (value = '' or value ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'))
    or (key = 'contact_phone' and char_length(value) <= 40)
    or (key = 'contact_address' and char_length(value) <= 300)
    or (key = 'footer_text'  and char_length(value) <= 500)
  )
);

create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

alter table public.site_settings enable row level security;
revoke all on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;
grant insert (key, value), update (value) on public.site_settings to authenticated;

create policy site_settings_select on public.site_settings
  for select to anon, authenticated using (true);
create policy site_settings_insert on public.site_settings
  for insert to authenticated with check (public.is_admin());
create policy site_settings_update on public.site_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- delete siyasəti yoxdur.

insert into public.site_settings (key, value) values
  ('site_name',  'Sosial İş'),
  ('home_title', 'Kollec tələbəsinin gündəlik iş masası'),
  ('home_text',  'Elanlar, dərs materialları, cədvəl və tədbirlər bir səhifədə. Daxil olun, materialları yadda saxlayın, bildirişləri qaçırmayın.'),
  ('about_title', 'Platformanın məqsədi'),
  ('about_text', '“Sosial İş” platforması Sosial İş, KŞATS və KŞŞİ ixtisaslarının tələbələrinin tədris həyatı ilə bağlı bütün məlumatlara bir yerdən, sürətli və rahat çıxışını təmin edir. Məzmunu administratorlar idarə edir.'),
  ('contact_email', ''),
  ('contact_phone', ''),
  ('contact_address', ''),
  ('footer_text', 'Sosial İş, KŞATS və KŞŞİ ixtisaslarının tələbələri üçün elanlar, dərs materialları, cədvəl və tədbirlər bir yerdə.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- faq_items
-- ---------------------------------------------------------------------
create table public.faq_items (
  id         uuid primary key default gen_random_uuid(),
  question   text not null check (char_length(btrim(question)) between 3 and 200),
  answer     text not null check (char_length(btrim(answer)) between 3 and 2000),
  sort_order integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index faq_items_sort_idx on public.faq_items (sort_order, created_at);

create trigger faq_items_set_updated_at
  before update on public.faq_items
  for each row execute function public.set_updated_at();

alter table public.faq_items enable row level security;
revoke all on public.faq_items from anon, authenticated;
grant select on public.faq_items to anon, authenticated;
grant insert (question, answer, sort_order, active), update (question, answer, sort_order, active), delete on public.faq_items to authenticated;

create policy faq_items_select on public.faq_items
  for select to anon, authenticated using (active or public.is_admin());
create policy faq_items_insert on public.faq_items
  for insert to authenticated with check (public.is_admin());
create policy faq_items_update on public.faq_items
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy faq_items_delete on public.faq_items
  for delete to authenticated using (public.is_admin());

-- Real, saytın funksiyalarına uyğun suallar (olmayan funksiya vəd edilmir).
insert into public.faq_items (question, answer, sort_order)
select v.q, v.a, v.n
from (values
  ('Platformadan istifadə üçün qeydiyyat vacibdirmi?',
   'Elanlar, materiallar, dərs cədvəli, tədbirlər və ixtisaslar haqqında məlumat hər kəs üçün açıqdır. Materialları yadda saxlamaq, bildirişləri görmək, şəxsi qeydlər yazmaq və tədbirlərə qeydiyyatdan keçmək üçün hesab lazımdır.', 1),
  ('Qeydiyyat zamanı hansı məlumatlar tələb olunur?',
   'Ad, soyad, e-poçt ünvanı, ixtisas, qrup və şifrə. Hesab “Tələbə” rolu ilə açılır; redaktor və admin səlahiyyətini yalnız admin verə bilər. E-poçt təsdiqi tələb olunarsa, poçtunuza gələn keçidlə hesabı təsdiqləyib sonra daxil olun.', 2),
  ('İxtisas və qrupumu necə seçim və ya dəyişim?',
   'Qeydiyyatda əvvəlcə ixtisası, sonra həmin ixtisasa aid qrupu seçirsiniz. Sonradan dəyişmək üçün kabinetdə “Profil” səhifəsini açın, ixtisas və qrupu yenidən seçib dəyişiklikləri saxlayın.', 3),
  ('Növbələr (I və II növbə) necə müəyyən olunur?',
   'Növbə qrupun rəsmi dərs cədvəlindən götürülür, onu ayrıca seçmək lazım deyil. Qrupunuzu seçdikdən sonra növbəniz kabinetdə göstərilir. “Dərs cədvəli” səhifəsində filtrdən I və ya II növbəni seçib həmin növbənin qruplarına da baxa bilərsiniz.', 4),
  ('Dərs cədvəlimi harada görə bilərəm?',
   '“Dərs cədvəli” səhifəsində ixtisas, növbə, qrup və gün üzrə filtr edə bilərsiniz. Profilinizdə qrup seçilibsə, səhifə qrupunuzla açılır, ana səhifədəki “Bu gün” bölməsində isə bugünkü dərslər göstərilir. Kabinetdəki “Şəxsi cədvəl” bölməsində günlərə şəxsi qeydlər də əlavə edə bilərsiniz.', 5),
  ('Tədris materiallarını necə tapım və endirim?',
   '“Materiallar” səhifəsində axtarışdan, fənn, növ və ixtisas filtrlərindən istifadə edin. Fayl kimi yüklənmiş materialda “Endir”, xarici keçid kimi əlavə olunmuş materialda “Aç” düyməsi var. Daxil olduqdan sonra materialı yadda saxlayıb kabinetdəki “Saxlanılanlar” bölməsindən tez tapa bilərsiniz.', 6),
  ('Elanlardan və bildirişlərdən necə xəbərdar olum?',
   'Yeni elanlar ana səhifədə və “Elanlar” səhifəsində görünür. Daxil olduqdan sonra son elanlar və yaxınlaşan tədbirlər kabinetdəki “Bildirişlər” bölməsində oxunmamış kimi işarələnir. Bildirişlər yalnız saytın daxilində göstərilir, e-poçtla göndərilmir.', 7),
  ('Tədbirə necə qeydiyyatdan keçim?',
   '“Tədbirlər” səhifəsində tədbiri açın. Tədbir üçün qeydiyyat açıqdırsa, daxil olduqdan sonra “Tədbirə qeydiyyatdan keç” düyməsi görünür; qeydiyyatı eyni yerdən ləğv edə bilərsiniz.', 8),
  ('Profil məlumatlarımı və şifrəmi necə dəyişim?',
   'Kabinetdə “Profil” səhifəsində adınızı, soyadınızı, ixtisas və qrupunuzu yeniləyə bilərsiniz. E-poçt ünvanı və rol profildən dəyişdirilmir. Şifrəni dəyişmək üçün həmin səhifədəki düyməyə basın: e-poçtunuza yeniləmə keçidi göndəriləcək.', 9),
  ('Şifrəmi unutmuşam, nə etməliyəm?',
   '“Daxil ol” səhifəsində “Şifrəni unutmusunuz?” keçidinə basıb e-poçtunuzu yazın; şifrəni yeniləmək üçün keçid göndəriləcək. Mesaj gəlməsə, spam qovluğunu yoxlayın.', 10),
  ('Saytda texniki problem və ya səhv görsəm necə bildirim?',
   '“Əlaqə” səhifəsindəki formada problemi, hansı səhifədə baş verdiyini və varsa xəta mesajını yazın; mesajınız administratorlara çatır. Yanlış elan, material və ya cədvəl məlumatını da eyni yolla bildirə bilərsiniz.', 11)
) as v (q, a, n)
where not exists (select 1 from public.faq_items);

-- ---------------------------------------------------------------------
-- footer_links
-- url: "/yol" (daxili; "//" və "\" qadağandır) və ya https://...
-- ---------------------------------------------------------------------
create table public.footer_links (
  id         uuid primary key default gen_random_uuid(),
  label      text not null check (char_length(btrim(label)) between 2 and 60),
  url        text not null check (char_length(url) <= 500 and (url ~ '^/([^/\s\\][^\s\\]*)?$' or url ~ '^https://[^\s\\]+$')),
  sort_order integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index footer_links_sort_idx on public.footer_links (sort_order, created_at);

create trigger footer_links_set_updated_at
  before update on public.footer_links
  for each row execute function public.set_updated_at();

alter table public.footer_links enable row level security;
revoke all on public.footer_links from anon, authenticated;
grant select on public.footer_links to anon, authenticated;
grant insert (label, url, sort_order, active), update (label, url, sort_order, active), delete on public.footer_links to authenticated;

create policy footer_links_select on public.footer_links
  for select to anon, authenticated using (active or public.is_admin());
create policy footer_links_insert on public.footer_links
  for insert to authenticated with check (public.is_admin());
create policy footer_links_update on public.footer_links
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy footer_links_delete on public.footer_links
  for delete to authenticated using (public.is_admin());

insert into public.footer_links (label, url, sort_order)
select v.l, v.u, v.n
from (values
  ('Elanlar', '/announcements', 1),
  ('Materiallar', '/materials', 2),
  ('Dərs cədvəli', '/schedule', 3),
  ('Tədbirlər', '/events', 4),
  ('İxtisaslar', '/about', 5),
  ('Komandamız', '/team', 6),
  ('Əlaqə', '/contact', 7)
) as v (l, u, n)
where not exists (select 1 from public.footer_links);

-- ---------------------------------------------------------------------
-- Storage: team-photos (ictimai oxu; yükləmə/dəyişmə/silmə yalnız admin)
-- Server tərəfi: ölçü və MIME siyahısı Storage tərəfindən tətbiq olunur; ad şablonu və admin yoxlaması aşağıdakı siyasətlərdədir.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('team-photos', 'team-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy team_photos_select on storage.objects
  for select to anon, authenticated using (bucket_id = 'team-photos');
create policy team_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'team-photos' and public.is_admin()
              and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$');
create policy team_photos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'team-photos' and public.is_admin())
  with check (bucket_id = 'team-photos' and public.is_admin()
              and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$');
create policy team_photos_delete on storage.objects
  for delete to authenticated using (bucket_id = 'team-photos' and public.is_admin());

-- ---------------------------------------------------------------------
-- team_members
-- ---------------------------------------------------------------------
create table public.team_members (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null check (char_length(btrim(full_name)) between 2 and 100),
  job_title     text not null check (char_length(btrim(job_title)) between 2 and 100),
  bio           text not null default '' check (char_length(bio) <= 600),
  photo_path    text check (photo_path is null or photo_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'),
  website_url   text check (website_url   is null or (char_length(website_url)   <= 300 and website_url   ~ '^https://[^\s\\]+$')),
  linkedin_url  text check (linkedin_url  is null or (char_length(linkedin_url)  <= 300 and linkedin_url  ~ '^https://[^\s\\]+$')),
  instagram_url text check (instagram_url is null or (char_length(instagram_url) <= 300 and instagram_url ~ '^https://[^\s\\]+$')),
  github_url    text check (github_url    is null or (char_length(github_url)    <= 300 and github_url    ~ '^https://[^\s\\]+$')),
  telegram_url  text check (telegram_url  is null or (char_length(telegram_url)  <= 300 and telegram_url  ~ '^https://[^\s\\]+$')),
  sort_order    integer not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz
);
create index team_members_sort_idx on public.team_members (sort_order, created_at);

create trigger team_members_set_updated_at
  before update on public.team_members
  for each row execute function public.set_updated_at();

-- Şəkil faktiki olaraq Storage-də mövcud olmalıdır (yükləmə uğursuz olubsa sətir yazılmır).
create or replace function public.team_members_check_photo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.photo_path is not null
     and (tg_op = 'INSERT' or new.photo_path is distinct from old.photo_path)
     and not exists (select 1 from storage.objects o where o.bucket_id = 'team-photos' and o.name = new.photo_path) then
    raise exception 'file-missing' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.team_members_check_photo() from public;

create trigger team_members_check_photo_trg
  before insert or update on public.team_members
  for each row execute function public.team_members_check_photo();

alter table public.team_members enable row level security;
revoke all on public.team_members from anon, authenticated;
grant select on public.team_members to anon, authenticated;
grant insert (full_name, job_title, bio, photo_path, website_url, linkedin_url, instagram_url, github_url, telegram_url, sort_order, active),
      update (full_name, job_title, bio, photo_path, website_url, linkedin_url, instagram_url, github_url, telegram_url, sort_order, active),
      delete on public.team_members to authenticated;

create policy team_members_select on public.team_members
  for select to anon, authenticated using (active or public.is_admin());
create policy team_members_insert on public.team_members
  for insert to authenticated with check (public.is_admin());
create policy team_members_update on public.team_members
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy team_members_delete on public.team_members
  for delete to authenticated using (public.is_admin());
