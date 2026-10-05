-- RLS / rol / məhdudiyyət testləri (sadə SQL, pgTAP tələb etmir).
-- İşə salmaq: supabase/tests/run-local-pg.sh
\set ON_ERROR_STOP on
create schema if not exists t;
grant usage on schema t to public;

create or replace function t.as_user(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), true);
  if u is null then set local role anon; else set local role authenticated; end if;
end $$;

create or replace function t.back() returns void language plpgsql as $$
begin reset role; perform set_config('request.jwt.claim.sub', '', true); end $$;

create or replace function t.ok(label text, cond boolean) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;

-- sql icra olunur, gözlənilən SQLSTATE ilə uğursuz olmalıdır
create or replace function t.throws(label text, q text, expected text) returns void language plpgsql as $$
declare st text;
begin
  begin
    execute q;
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    if st <> expected then raise exception 'FAIL: % (gözlənilən %, alınan %)', label, expected, st; end if;
    raise notice 'PASS: %', label;
    return;
  end;
  raise exception 'FAIL: % (xəta gözlənilirdi, amma icra olundu)', label;
end $$;

-- sql neçə sətrə təsir etdi
create or replace function t.affected(q text) returns int language plpgsql as $$
declare n int;
begin execute q; get diagnostics n = row_count; return n; end $$;

create or replace function t.cnt(q text) returns int language plpgsql as $$
declare n int;
begin execute 'select count(*) from (' || q || ') s' into n; return n; end $$;

-- sql icra olunur, gözlənilən xəta MESAJI ilə uğursuz olmalıdır (submit_form sabit mesajlar qaytarır)
create or replace function t.throws_msg(label text, q text, expected text) returns void language plpgsql as $$
declare m text;
begin
  begin
    execute q;
  exception when others then
    get stacked diagnostics m = message_text;
    if m <> expected then raise exception 'FAIL: % (gözlənilən mesaj %, alınan %)', label, expected, m; end if;
    raise notice 'PASS: %', label;
    return;
  end;
  raise exception 'FAIL: % (xəta gözlənilirdi, amma icra olundu)', label;
end $$;

grant execute on all functions in schema t to public;

begin;


-- ---------- Qeydiyyat tətiyi (GoTrue auth.users-ə yazır)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.az', '{"first_name":"Aysel","last_name":"Əliyeva","specialty":"Sİ","group":"Sİ26/01SB","student_id":"S-1"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.az', '{"first_name":"Bəhruz","last_name":"Quliyev"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.az', '{"first_name":"Cavid","last_name":"Həsənov","role":"admin"}'),
  ('00000000-0000-0000-0000-00000000000e', 'e@test.az', '{"first_name":"Elnur","last_name":"Rzayev"}');

select t.ok('user_metadata-dakı role=admin YOXLANMIR, profil student yaranır',
  (select role from public.profiles where email = 'c@test.az') = 'student');
select t.ok('metadata-dan ad/ixtisas/qrup götürülür; köhnə metadata-dakı student_id sakitcə nəzərə alınmır',
  (select first_name = 'Aysel' and specialty = 'Sİ' and group_name = 'Sİ26/01SB' and degree is null from public.profiles where email = 'a@test.az'));
select t.ok('profiles-də student_id və course sütunları artıq yoxdur (degree saxlanılıb)',
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name in ('student_id', 'course')) = 0
  and (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'degree') = 1);
select t.throws('qrup ixtisasa aid deyilsə qeydiyyat rədd edilir',
  $q$insert into auth.users (email, raw_user_meta_data) values ('p1@test.az', '{"first_name":"P","last_name":"P","specialty":"KŞATS","group":"Sİ26/01SB"}')$q$, 'P0001');
select t.throws('mövcud olmayan qrup ilə qeydiyyat rədd edilir',
  $q$insert into auth.users (email, raw_user_meta_data) values ('p2@test.az', '{"first_name":"P","last_name":"P","specialty":"Sİ","group":"uydurma"}')$q$, 'P0001');
select t.throws('yalnız ixtisas verilib, qrup yoxdur: qeydiyyat rədd edilir',
  $q$insert into auth.users (email, raw_user_meta_data) values ('p3@test.az', '{"first_name":"P","last_name":"P","specialty":"Sİ"}')$q$, 'P0001');
select t.throws('boş ad ilə qeydiyyat rədd edilir',
  $q$insert into auth.users (email, raw_user_meta_data) values ('x@test.az', '{"first_name":"","last_name":"X"}')$q$, '23514');
select t.throws('eyni e-poçt (böyük/kiçik hərf fərqi ilə) ikinci profil yarada bilmir',
  $q$insert into auth.users (email, raw_user_meta_data) values ('A@TEST.AZ', '{"first_name":"Z","last_name":"Z"}')$q$, '23505');

-- İlk admin / redaktor: SQL redaktorundan (müştəri rolu olmayan) təyin edilir
update public.profiles set role = 'admin'  where email = 'c@test.az';
update public.profiles set role = 'editor' where email = 'e@test.az';
select t.ok('SQL redaktorundan rol təyini işləyir',
  (select count(*) from public.profiles where role in ('admin','editor')) = 2);

-- ---------- Nümunə məzmun
insert into public.announcements (id, title, body, published) values
  ('10000000-0000-0000-0000-000000000001', 'Dərc olunmuş elan', 'mətn', true),
  ('10000000-0000-0000-0000-000000000002', 'Qaralama elan', 'mətn', false);
insert into public.materials (id, title, subject, url) values
  ('20000000-0000-0000-0000-000000000001', 'Material 1', 'Fənn', 'https://example.com/m1');
insert into public.events (id, title, location, starts_at, registration_open) values
  ('30000000-0000-0000-0000-000000000001', 'Açıq tədbir', 'Zal 1', now() + interval '2 days', true),
  ('30000000-0000-0000-0000-000000000002', 'Bağlı tədbir', 'Zal 2', now() + interval '3 days', false);
insert into public.schedule_entries (day, start_time, end_time, subject) values (1, '09:00', '10:30', 'Sosial iş');

-- ---------- anon (giriş etməmiş)
select t.as_user(null);
select t.ok('anon yalnız dərc olunmuş elanı görür', t.cnt('select 1 from public.announcements') = 1);
select t.ok('anon materialları, tədbirləri, cədvəli oxuya bilir',
  t.cnt('select 1 from public.materials') = 1 and t.cnt('select 1 from public.events') = 2 and t.cnt('select 1 from public.schedule_entries') = 1);
select t.throws('anon profilləri oxuya bilmir', 'select * from public.profiles', '42501');
select t.throws('anon elan yarada bilmir', $q$insert into public.announcements (title, body) values ('Hack', 'x')$q$, '42501');
select t.throws('anon material silə bilmir', 'delete from public.materials', '42501');
select t.throws('anon qeydiyyat yarada bilmir',
  $q$insert into public.event_registrations (event_id, user_id, name, email) values ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','x','x@x.az')$q$, '42501');
insert into public.contact_messages (name, email, subject, message) values ('Qonaq', 'q@test.az', 'Mövzu', 'Bu bir sınaq mesajıdır.');
select t.ok('anon əlaqə mesajı göndərə bilir', true);
select t.throws('anon mesajın statusunu özü təyin edə bilmir (sütun icazəsi)',
  $q$insert into public.contact_messages (name, email, subject, message, status) values ('Q2', 'q@test.az', 'Mövzu', 'Bu bir sınaq mesajıdır.', 'read')$q$, '42501');
select t.throws('anon mesajları oxuya bilmir', 'select * from public.contact_messages', '42501');
select t.throws('pis e-poçtlu mesaj rədd edilir',
  $q$insert into public.contact_messages (name, email, subject, message) values ('Qonaq', 'yanlis', 'Mövzu', 'Bu bir sınaq mesajıdır.')$q$, '23514');
select t.back();

-- ---------- Tələbə A
select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.ok('tələbə yalnız öz profilini görür', t.cnt('select 1 from public.profiles') = 1);
select t.ok('tələbə qaralama elanı görmür', t.cnt('select 1 from public.announcements') = 1);
select t.ok('tələbə öz adını dəyişə bilir',
  t.affected($q$update public.profiles set first_name = 'Aysel2' where id = '00000000-0000-0000-0000-00000000000a'$q$) = 1);
select t.ok('tələbə ixtisas və qrupunu düzgün cütlə dəyişə bilir',
  t.affected($q$update public.profiles set specialty = 'KŞATS', group_name = 'KŞATS25/01SB' where id = '00000000-0000-0000-0000-00000000000a'$q$) = 1);
select t.throws('tələbə qrupu başqa ixtisasa aid cütlə təyin edə bilmir',
  $q$update public.profiles set specialty = 'Sİ', group_name = 'KŞATS25/01SB' where id = '00000000-0000-0000-0000-00000000000a'$q$, 'P0001');
select t.throws('tələbə mövcud olmayan qrup təyin edə bilmir',
  $q$update public.profiles set specialty = 'Sİ', group_name = 'uydurma' where id = '00000000-0000-0000-0000-00000000000a'$q$, 'P0001');
select t.throws('tələbə yalnız ixtisası (qrupsuz) saxlaya bilmir',
  $q$update public.profiles set group_name = null where id = '00000000-0000-0000-0000-00000000000a'$q$, '23514');
select t.throws('tələbə köhnə degree sütununu dəyişə bilmir (sütun icazəsi)',
  $q$update public.profiles set degree = 'magistr' where id = '00000000-0000-0000-0000-00000000000a'$q$, '42501');
select t.throws('tələbə öz rolunu admin edə bilmir',
  $q$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a'$q$, '42501');
select t.throws('tələbə e-poçtunu profildə dəyişə bilmir',
  $q$update public.profiles set email = 'yeni@test.az' where id = '00000000-0000-0000-0000-00000000000a'$q$, '42501');
select t.ok('tələbə başqasının profilini dəyişə bilmir (0 sətir)',
  t.affected($q$update public.profiles set first_name = 'Hack' where id = '00000000-0000-0000-0000-00000000000b'$q$) = 0);
select t.throws('tələbə elan yarada bilmir', $q$insert into public.announcements (title, body, published) values ('Saxta', 'x', true)$q$, '42501');
select t.ok('tələbə elanı silə bilmir (0 sətir)', t.affected('delete from public.announcements') = 0);
select t.ok('tələbə mesajları görmür', t.cnt('select 1 from public.contact_messages') = 0);

-- tədbir qeydiyyatı
insert into public.event_registrations (event_id, user_id, name, email)
  values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Aysel Əliyeva', 'a@test.az');
select t.ok('tələbə açıq tədbirə qeydiyyatdan keçir', true);
select t.throws('qeydiyyatı bağlı tədbirə yazmaq olmur',
  $q$insert into public.event_registrations (event_id, user_id, name, email) values ('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000a','x','a@test.az')$q$, '42501');
select t.throws('başqasının adından qeydiyyat olmur',
  $q$insert into public.event_registrations (event_id, user_id, name, email) values ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','x','b@test.az')$q$, '42501');
select t.throws('təkrar qeydiyyat olmur',
  $q$insert into public.event_registrations (event_id, user_id, name, email) values ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','x','a@test.az')$q$, '23505');

-- şəxsi məlumatlar
insert into public.saved_materials (user_id, material_id) values ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000001');
insert into public.personal_notes (user_id, text, day) values ('00000000-0000-0000-0000-00000000000a', 'Kitabxanaya get', 3);
insert into public.notification_reads (user_id, key) values ('00000000-0000-0000-0000-00000000000a', 'a-1');
select t.ok('tələbə öz şəxsi məlumatlarını yaza bilir', t.cnt('select 1 from public.personal_notes') = 1);
-- supabase-js upsert(..., { ignoreDuplicates: true }) = INSERT ... ON CONFLICT DO NOTHING (yalnız INSERT icazəsi ilə işləməlidir)
insert into public.saved_materials (user_id, material_id) values ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000001') on conflict (user_id, material_id) do nothing;
insert into public.notification_reads (user_id, key) values ('00000000-0000-0000-0000-00000000000a', 'a-1') on conflict (user_id, key) do nothing;
insert into public.event_registrations (event_id, user_id, name, email) values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Aysel Əliyeva', 'a@test.az') on conflict (event_id, user_id) do nothing;
select t.ok('təkrar saxla / oxunmuş işarələ / qeydiyyat (ON CONFLICT DO NOTHING) xəta vermir və dublikat yaratmır',
  t.cnt('select 1 from public.saved_materials') = 1 and t.cnt('select 1 from public.notification_reads') = 1 and t.cnt('select 1 from public.event_registrations') = 1);
select t.throws('ON CONFLICT ilə başqası adından yazmaq yenə olmur',
  $q$insert into public.saved_materials (user_id, material_id) values ('00000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-000000000001') on conflict (user_id, material_id) do nothing$q$, '42501');
select t.throws('tələbə başqası üçün qeyd yarada bilmir',
  $q$insert into public.personal_notes (user_id, text, day) values ('00000000-0000-0000-0000-00000000000b', 'x', 1)$q$, '42501');
select t.throws('qeyd günü 1-7 aralığında olmalıdır',
  $q$insert into public.personal_notes (user_id, text, day) values ('00000000-0000-0000-0000-00000000000a', 'x', 9)$q$, '23514');
select t.throws('boş qeyd rədd edilir',
  $q$insert into public.personal_notes (user_id, text, day) values ('00000000-0000-0000-0000-00000000000a', '', 1)$q$, '23514');
select t.back();

-- ---------- Tələbə B (A-nın məlumatlarını görməməlidir)
select t.as_user('00000000-0000-0000-0000-00000000000b');
select t.ok('B A-nın qeydlərini görmür', t.cnt('select 1 from public.personal_notes') = 0);
select t.ok('B A-nın saxlanılmışlarını görmür', t.cnt('select 1 from public.saved_materials') = 0);
select t.ok('B A-nın oxunma vəziyyətini görmür', t.cnt('select 1 from public.notification_reads') = 0);
select t.ok('B A-nın tədbir qeydiyyatını görmür', t.cnt('select 1 from public.event_registrations') = 0);
select t.ok('B A-nın qeydiyyatını silə bilmir (0 sətir)', t.affected('delete from public.event_registrations') = 0);
select t.back();

-- ---------- Redaktor E
select t.as_user('00000000-0000-0000-0000-00000000000e');
select t.ok('redaktor qaralamaları görür', t.cnt('select 1 from public.announcements') = 2);
insert into public.announcements (title, body, published) values ('Redaktor elanı', 'mətn', true);
select t.ok('redaktor elan yarada bilir', t.cnt('select 1 from public.announcements') = 3);
select t.ok('redaktor elanı redaktə edir',
  t.affected($q$update public.announcements set important = true where title = 'Redaktor elanı'$q$) = 1);
select t.ok('redaktor elanı silir', t.affected($q$delete from public.announcements where title = 'Redaktor elanı'$q$) = 1);
select t.ok('redaktor tədbir qeydiyyatlarını görür', t.cnt('select 1 from public.event_registrations') = 1);
select t.ok('redaktor yalnız öz profilini görür', t.cnt('select 1 from public.profiles') = 1);
select t.ok('redaktor başqasına rol verə bilmir (profili görmür, 0 sətir)',
  t.affected($q$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a'$q$) = 0);
select t.throws('redaktor öz rolunu admin edə bilmir',
  $q$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000e'$q$, '42501');
select t.ok('redaktor mesajları oxuya bilmir', t.cnt('select 1 from public.contact_messages') = 0);
select t.back();

-- ---------- Admin C
select t.as_user('00000000-0000-0000-0000-00000000000c');
select t.ok('admin bütün profilləri görür', t.cnt('select 1 from public.profiles') = 4);
select t.ok('admin başqasına rol verir',
  t.affected($q$update public.profiles set role = 'editor' where id = '00000000-0000-0000-0000-00000000000b'$q$) = 1);
select t.throws('admin öz rolunu dəyişə bilmir',
  $q$update public.profiles set role = 'student' where id = '00000000-0000-0000-0000-00000000000c'$q$, '42501');
select t.ok('admin öz rolunu dəyişərkən 0 sətir (siyasət) və ya xəta; rol dəyişməyib', (select role from public.profiles where id = '00000000-0000-0000-0000-00000000000c') = 'admin');
select t.throws('admin başqasının adını dəyişə bilmir (yalnız rol)',
  $q$update public.profiles set first_name = 'Hack' where id = '00000000-0000-0000-0000-00000000000a'$q$, '42501');
select t.ok('admin əlaqə mesajlarını oxuyur', t.cnt('select 1 from public.contact_messages') = 1);
select t.ok('admin mesajı oxunmuş edir',
  t.affected($q$update public.contact_messages set status = 'read'$q$) = 1);
select t.throws('admin mesajın mətnini dəyişə bilmir (sütun icazəsi)',
  $q$update public.contact_messages set message = 'dəyişdi dəyişdi dəyişdi'$q$, '42501');
select t.ok('admin mesajı silir', t.affected('delete from public.contact_messages') = 1);
select t.back();

-- ---------- Məhdudiyyətlər (service_role / SQL redaktoru)
select t.throws('http:// material keçidi rədd edilir',
  $q$insert into public.materials (title, subject, url) values ('Material', 'Fənn', 'http://example.com/x')$q$, '23514');
select t.throws('çox qısa elan başlığı rədd edilir',
  $q$insert into public.announcements (title, body) values ('ab', 'x')$q$, '23514');
select t.throws('yanlış kateqoriya rədd edilir',
  $q$insert into public.announcements (title, body, category) values ('Başlıq', 'x', 'yoxdur')$q$, '23514');
select t.throws('cədvəldə yanlış vaxt formatı rədd edilir',
  $q$insert into public.schedule_entries (day, start_time, end_time, subject) values (1, '9am', '10:00', 'Fənn')$q$, '23514');
select t.throws('cədvəldə gün 8 ola bilmir',
  $q$insert into public.schedule_entries (day, start_time, end_time, subject) values (8, '09:00', '10:00', 'Fənn')$q$, '23514');
select t.throws('firebase_id təkrarı rədd edilir',
  $q$insert into public.materials (firebase_id, title, subject, url) values ('fb1','Material A','Fənn','https://e.com/1'), ('fb1','Material B','Fənn','https://e.com/2')$q$, '23505');

-- ---------- Qrup siyahısı yenilənəndə (seed ilə) : köhnə qrup silinmir, aktiv olmur
select t.throws('service_role belə cüt FK ilə qorunur (trigger olmadan da)',
  $q$update public.profiles set specialty = 'Sİ', group_name = 'KŞATS25/01SB' where email = 'a@test.az'$q$, '23503');
update public.groups set active = false where code = 'Sİ25/01SB';
select t.as_user('00000000-0000-0000-0000-00000000000b');
select t.throws('qeyri-aktiv (köhnə) qrupa keçmək olmur',
  $q$update public.profiles set specialty = 'Sİ', group_name = 'Sİ25/01SB' where id = '00000000-0000-0000-0000-00000000000b'$q$, 'P0001');
select t.back();
select t.throws('qeyri-aktiv qrupla yeni qeydiyyat rədd edilir',
  $q$insert into auth.users (email, raw_user_meta_data) values ('p4@test.az', '{"first_name":"P","last_name":"P","specialty":"Sİ","group":"Sİ25/01SB"}')$q$, 'P0001');
select t.ok('groups cədvəli anon üçün oxunaqlıdır, yazıla bilməz',
  (select count(*) from public.groups) = 29);
select t.as_user(null);
select t.ok('anon qrup siyahısını oxuya bilir', t.cnt('select 1 from public.groups') = 29);
select t.throws('anon qrup əlavə edə bilmir', $q$insert into public.groups (code, specialty) values ('X1', 'Sİ')$q$, '42501');
select t.back();
select t.as_user('00000000-0000-0000-0000-00000000000c');
select t.throws('admin də groups cədvəlinə müştəri kimi yaza bilmir', $q$update public.groups set active = true$q$, '42501');
select t.back();

-- ---------- İxtisaslar (specialties)
select t.ok('3 ixtisas və düzgün kodlar seed olunub',
  (select string_agg(program_code, ',' order by sort_order) from public.specialties) = '040713,040533,040532');
select t.ok('hər qrup mövcud ixtisasa bağlıdır (12/6/11)',
  (select count(*) from public.groups g join public.specialties s on s.code = g.specialty where g.specialty = 'Sİ') = 12
  and (select count(*) from public.groups where specialty = 'KŞATS') = 6
  and (select count(*) from public.groups where specialty = 'KŞŞİ') = 11);
select t.throws('mövcud olmayan ixtisasa qrup əlavə etmək olmur (FK)',
  $q$insert into public.groups (code, specialty) values ('YOX25/01SB', 'YOX')$q$, '23503');
select t.throws('qəbul balı rəqəm olmalıdır',
  $q$update public.specialties set score_general_state = 'abc' where code = 'KŞŞİ'$q$, '23514');
select t.as_user(null);
select t.ok('anon aktiv ixtisasları oxuya bilir', t.cnt('select 1 from public.specialties') = 3);
select t.throws('anon ixtisası dəyişə bilmir', $q$update public.specialties set description = 'Hack'$q$, '42501');
select t.throws('anon ixtisas əlavə edə bilmir', $q$insert into public.specialties (code, name, full_name) values ('X', 'X', 'X')$q$, '42501');
select t.back();
select t.as_user('00000000-0000-0000-0000-00000000000b');
select t.ok('tələbə ixtisası dəyişə bilmir (RLS: 0 sətir)',
  t.affected($q$update public.specialties set description = 'Hack'$q$) = 0);
select t.throws('tələbə ixtisası silə bilmir', 'delete from public.specialties', '42501');
select t.back();
select t.as_user('00000000-0000-0000-0000-00000000000e');
select t.ok('redaktor ixtisası dəyişə bilmir (yalnız admin)',
  t.affected($q$update public.specialties set description = 'Hack'$q$) = 0);
select t.back();
select t.as_user('00000000-0000-0000-0000-00000000000c');
select t.ok('admin ixtisasın təsvirini və aktivliyini dəyişə bilir',
  t.affected($q$update public.specialties set description = 'Yeni təsvir', active = false where code = 'KŞŞİ'$q$) = 1);
select t.throws('admin ixtisas açarını dəyişə bilmir (sütun icazəsi)',
  $q$update public.specialties set code = 'YENI' where code = 'KŞŞİ'$q$, '42501');
select t.throws('admin ixtisası silə bilmir', 'delete from public.specialties', '42501');
select t.ok('admin qeyri-aktiv ixtisası da görür', t.cnt('select 1 from public.specialties') = 3);
select t.back();
select t.as_user(null);
select t.ok('anon qeyri-aktiv ixtisasları görmür', t.cnt('select 1 from public.specialties') = 2);
select t.back();
select t.ok('updated_at yenilənib', (select updated_at is not null from public.specialties where code = 'KŞŞİ'));
update public.specialties set active = true where code = 'KŞŞİ';

-- ---------- Super Admin (feqangerayli@gmail.com)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f0', 'Feqangerayli@Gmail.com', '{"first_name":"Feqan","last_name":"Gəraylı","role":"admin"}');
select t.ok('bootstrap: e-poçt təsdiqlənməyibsə yüksəltmir', public.bootstrap_super_admin() = 'unconfirmed');
select t.ok('bootstrap hələ heç kimi Super Admin etməyib', (select count(*) from public.profiles where is_super_admin) = 0);
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-0000000000f0';
select t.ok('bootstrap təsdiqlənmiş hesabı (UID ilə) Super Admin edir', public.bootstrap_super_admin() = 'promoted');
select t.ok('Super Admin: rol admin, bayraq true', (select role = 'admin' and is_super_admin from public.profiles where id = '00000000-0000-0000-0000-0000000000f0'));
select t.ok('bootstrap təkrar işləyəndə heç nə etmir (idempotent)', public.bootstrap_super_admin() = 'exists');
select t.throws('SQL/service_role: Super Admin-in rolunu dəyişmək olmur',
  $q$update public.profiles set role = 'student' where is_super_admin$q$, '42501');
select t.throws('SQL/service_role: Super Admin bayrağını götürmək olmur',
  $q$update public.profiles set is_super_admin = false where is_super_admin$q$, '42501');
select t.throws('SQL/service_role: Super Admin profilini silmək olmur',
  $q$delete from public.profiles where is_super_admin$q$, '42501');
select t.throws('Super Admin hesabını (auth.users) silmək olmur (cascade bloklanır)',
  $q$delete from auth.users where id = '00000000-0000-0000-0000-0000000000f0'$q$, '42501');
select t.throws('Super Admin hesabını ban etmək (deaktiv) olmur',
  $q$update auth.users set banned_until = now() + interval '10 years' where id = '00000000-0000-0000-0000-0000000000f0'$q$, '42501');
select t.throws('Super Admin hesabını yumşaq silmək olmur',
  $q$update auth.users set deleted_at = now() where id = '00000000-0000-0000-0000-0000000000f0'$q$, '42501');
select t.throws('başqa istifadəçiyə Super Admin bayrağı yazmaq olmur',
  $q$update public.profiles set is_super_admin = true where email = 'e@test.az'$q$, '42501');
select t.throws('ikinci Super Admin yaratmaq olmur (insert)',
  $q$insert into public.profiles (id, email, first_name, last_name, is_super_admin) values (gen_random_uuid(), 'x2@test.az', 'X', 'X', true)$q$, '42501');

select t.as_user('00000000-0000-0000-0000-00000000000c');
select t.ok('admin Super Admin-in rolunu dəyişə bilmir (RLS: 0 sətir)',
  t.affected($q$update public.profiles set role = 'student' where id = '00000000-0000-0000-0000-0000000000f0'$q$) = 0);
select t.throws('admin Super Admin bayrağını dəyişə bilmir (sütun icazəsi)',
  $q$update public.profiles set is_super_admin = true where id = '00000000-0000-0000-0000-00000000000c'$q$, '42501');
select t.throws('admin profil silə bilmir', $q$delete from public.profiles where id = '00000000-0000-0000-0000-0000000000f0'$q$, '42501');
select t.ok('admin Super Admin-i görür, rol dəyişməyib',
  (select role = 'admin' and is_super_admin from public.profiles where id = '00000000-0000-0000-0000-0000000000f0'));
select t.back();

select t.as_user('00000000-0000-0000-0000-0000000000f0');
select t.throws('Super Admin öz rolunu da azalda bilmir',
  $q$update public.profiles set role = 'student' where id = '00000000-0000-0000-0000-0000000000f0'$q$, '42501');
select t.ok('Super Admin başqasının rolunu dəyişə bilir',
  t.affected($q$update public.profiles set role = 'student' where id = '00000000-0000-0000-0000-00000000000e'$q$) = 1);
select t.back();
update public.profiles set role = 'editor' where id = '00000000-0000-0000-0000-00000000000e';

select set_config('app.allow_super_admin_changes', 'on', true);
update public.profiles set role = 'admin' where is_super_admin;
select set_config('app.allow_super_admin_changes', 'off', true);
select t.ok('saxlama rejimi yalnız SQL sessiyasında işləyir və söndürüləndə qoruma qayıdır',
  t.affected($q$update public.profiles set first_name = 'Feqan' where is_super_admin$q$) = 1);
select t.throws('qoruma saxlama rejimindən sonra yenidən aktivdir',
  $q$update public.profiles set role = 'student' where is_super_admin$q$, '42501');

-- ---------- Sayt məzmunu (site_settings, faq_items, footer_links, team_members)
select t.as_user(null);
select t.ok('anon sayt parametrlərini oxuyur', t.cnt('select 1 from public.site_settings') = 9);
select t.ok('anon aktiv FAQ və footer keçidlərini oxuyur', t.cnt('select 1 from public.faq_items') = 11 and t.cnt('select 1 from public.footer_links') = 7);
select t.throws('anon FAQ əlavə edə bilmir', $q$insert into public.faq_items (question, answer) values ('Sual?', 'Cavab')$q$, '42501');
select t.throws('anon parametr dəyişə bilmir', $q$update public.site_settings set value = 'Hack' where key = 'site_name'$q$, '42501');
select t.back();

select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.throws('tələbə FAQ əlavə edə bilmir', $q$insert into public.faq_items (question, answer) values ('Sual?', 'Cavab')$q$, '42501');
select t.ok('tələbə sayt parametrini dəyişə bilmir (0 sətir)', t.affected($q$update public.site_settings set value = 'Hack' where key = 'site_name'$q$) = 0);
select t.throws('tələbə komanda üzvü əlavə edə bilmir', $q$insert into public.team_members (full_name, job_title) values ('Ad Soyad', 'Vəzifə')$q$, '42501');
select t.back();

select t.as_user('00000000-0000-0000-0000-00000000000e');
select t.throws('redaktor FAQ əlavə edə bilmir (yalnız admin)', $q$insert into public.faq_items (question, answer) values ('Sual?', 'Cavab')$q$, '42501');
select t.ok('redaktor footer keçidini dəyişə bilmir (0 sətir)', t.affected($q$update public.footer_links set label = 'Hack'$q$) = 0);
select t.back();

select t.as_user('00000000-0000-0000-0000-00000000000c');
insert into public.faq_items (question, answer, sort_order, active) values ('Yeni sual?', 'Yeni cavab', 99, false);
select t.ok('admin FAQ əlavə edir və qeyri-aktivi görür', t.cnt('select 1 from public.faq_items') = 12);
select t.ok('admin FAQ-nı redaktə və sil', t.affected($q$update public.faq_items set answer = 'Dəyişdi' where question = 'Yeni sual?'$q$) = 1
  and t.affected($q$delete from public.faq_items where question = 'Yeni sual?'$q$) = 1);
select t.ok('admin sayt adını dəyişir', t.affected($q$update public.site_settings set value = 'Sosial İş+' where key = 'site_name'$q$) = 1);
select t.throws('PostgREST upsert forması (ON CONFLICT DO UPDATE SET key=...) sütun icazəsi səbəbilə rədd edilir: frontend upsert işlətməməlidir',
  $q$insert into public.site_settings (key, value) values ('site_name', 'X') on conflict (key) do update set key = excluded.key, value = excluded.value$q$, '42501');
select t.ok('update (yalnız value) admin üçün işləyir', t.affected($q$update public.site_settings set value = 'Sosial İş' where key = 'site_name'$q$) = 1);
select t.ok('mövcud olmayan açar üçün update 0 sətir qaytarır (insert yoluna keçid üçün)', t.affected($q$update public.site_settings set value = 'x' where key = 'contact_phone_nope'$q$) = 0);
select t.throws('boş sayt adı rədd edilir', $q$update public.site_settings set value = '  ' where key = 'site_name'$q$, '23514');
select t.throws('naməlum parametr açarı rədd edilir', $q$insert into public.site_settings (key, value) values ('evil_key', 'x')$q$, '23514');
select t.throws('düzgün olmayan əlaqə e-poçtu rədd edilir', $q$update public.site_settings set value = 'abc' where key = 'contact_email'$q$, '23514');
select t.throws('parametri silmək olmur', $q$delete from public.site_settings where key = 'site_name'$q$, '42501');
select t.throws('footer keçidi: // ilə başlayan xarici ünvan rədd edilir', $q$insert into public.footer_links (label, url) values ('Pis', '//evil.com')$q$, '23514');
select t.throws('footer keçidi: javascript: rədd edilir', $q$insert into public.footer_links (label, url) values ('Pis', 'javascript:alert(1)')$q$, '23514');
select t.throws('footer keçidi: http:// rədd edilir', $q$insert into public.footer_links (label, url) values ('Pis', 'http://example.com')$q$, '23514');
insert into public.footer_links (label, url, sort_order) values ('Rəsmi sayt', 'https://adpk.edu.az', 20);
select t.ok('footer: https:// keçidi qəbul edilir', t.cnt('select 1 from public.footer_links') = 8);
select t.throws('komanda: yüklənməmiş şəkil yolu rədd edilir',
  $q$insert into public.team_members (full_name, job_title, photo_path) values ('Ad Soyad', 'Vəzifə', '40000000-0000-0000-0000-0000000000aa.jpg')$q$, '23514');
select t.throws('komanda: javascript: şəxsi sayt linki rədd edilir',
  $q$insert into public.team_members (full_name, job_title, website_url) values ('Ad Soyad', 'Vəzifə', 'javascript:alert(1)')$q$, '23514');
insert into storage.objects (bucket_id, name, metadata) values ('team-photos', '40000000-0000-0000-0000-0000000000aa.jpg', '{"size":1000,"mimetype":"image/jpeg"}');
select t.ok('admin team-photos bucket-ə düzgün adla yükləyir', true);
select t.throws('admin team-photos-a pis adla (path traversal) yükləyə bilmir',
  $q$insert into storage.objects (bucket_id, name, metadata) values ('team-photos', '../x.jpg', '{"size":1,"mimetype":"image/jpeg"}')$q$, '42501');
select t.throws('admin team-photos-a icazəsiz uzantı (.svg) yükləyə bilmir',
  $q$insert into storage.objects (bucket_id, name, metadata) values ('team-photos', '40000000-0000-0000-0000-0000000000ab.svg', '{"size":1,"mimetype":"image/svg+xml"}')$q$, '42501');
insert into public.team_members (full_name, job_title, bio, photo_path, website_url, sort_order)
  values ('Feqan Gəraylı', 'Developer', 'Qısa bio', '40000000-0000-0000-0000-0000000000aa.jpg', 'https://feqan.dev', 1);
select t.ok('admin komanda üzvü əlavə edir (şəkil və sayt linki ilə)', t.cnt('select 1 from public.team_members') = 1);
select t.back();

select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.throws('tələbə team-photos-a şəkil yükləyə bilmir',
  $q$insert into storage.objects (bucket_id, name, metadata) values ('team-photos', '40000000-0000-0000-0000-0000000000ac.jpg', '{"size":1,"mimetype":"image/jpeg"}')$q$, '42501');
select t.ok('tələbə komanda üzvlərini oxuyur', t.cnt('select 1 from public.team_members') = 1);
select t.back();
select t.as_user('00000000-0000-0000-0000-00000000000e');
select t.throws('redaktor team-photos-a şəkil yükləyə bilmir (yalnız admin)',
  $q$insert into storage.objects (bucket_id, name, metadata) values ('team-photos', '40000000-0000-0000-0000-0000000000ad.jpg', '{"size":1,"mimetype":"image/jpeg"}')$q$, '42501');
select t.back();
update public.team_members set active = false;
select t.as_user(null);
select t.ok('anon qeyri-aktiv komanda üzvünü görmür', t.cnt('select 1 from public.team_members') = 0);
select t.back();
update public.team_members set active = true;

-- ---------- Material faylları
select t.as_user('00000000-0000-0000-0000-00000000000e');
select t.throws('fayl Storage-də yoxdursa material yazılmır',
  $q$insert into public.materials (title, subject, url, file_path, file_name, file_size, mime_type, file_type)
     values ('Fayl', 'Fənn', null, '40000000-0000-0000-0000-0000000000b1.pdf', 'a.pdf', 10, 'application/pdf', 'pdf')$q$, '23514');
insert into storage.objects (bucket_id, name, metadata) values
  ('materials', '40000000-0000-0000-0000-0000000000b1.pdf', '{"size":1000,"mimetype":"application/pdf"}'),
  ('materials', '40000000-0000-0000-0000-0000000000b2.docx', '{"size":2000,"mimetype":"application/pdf"}'),
  ('materials', '40000000-0000-0000-0000-0000000000b3.zip', '{"size":30000000,"mimetype":"application/zip"}'),
  ('materials', '40000000-0000-0000-0000-0000000000b4.zip', '{"size":4000,"mimetype":"application/x-zip-compressed"}');
select t.ok('redaktor materials bucket-ə düzgün adla yükləyir', true);
select t.throws('redaktor materials bucket-ə .exe yükləyə bilmir',
  $q$insert into storage.objects (bucket_id, name, metadata) values ('materials', '40000000-0000-0000-0000-0000000000b5.exe', '{"size":1,"mimetype":"application/octet-stream"}')$q$, '42501');
insert into public.materials (title, subject, url, file_path, file_name, file_size, mime_type, file_type, specialty, group_name)
  values ('PDF fayl', 'Fənn', null, '40000000-0000-0000-0000-0000000000b1.pdf', 'konspekt.pdf', 5, 'text/plain', 'pdf', 'Sİ', 'Sİ26/01SB');
select t.ok('server fayl ölçüsünü və MIME-i Storage-dən götürür (müştərinin dəyəri əzilir)',
  (select file_size = 1000 and mime_type = 'application/pdf' from public.materials where title = 'PDF fayl'));
select t.throws('uzantı ilə MIME uyğun gəlmirsə (docx ↔ pdf) material yazılmır',
  $q$insert into public.materials (title, subject, url, file_path, file_name, file_size, mime_type, file_type)
     values ('Saxta docx', 'Fənn', null, '40000000-0000-0000-0000-0000000000b2.docx', 'a.docx', 1, 'x', 'doc')$q$, '23514');
select t.throws('25 MB-dan böyük fayl ölçü yoxlamasından keçmir',
  $q$insert into public.materials (title, subject, url, file_path, file_name, file_size, mime_type, file_type)
     values ('Böyük zip', 'Fənn', null, '40000000-0000-0000-0000-0000000000b3.zip', 'a.zip', 1, 'x', 'zip')$q$, '23514');
insert into public.materials (title, subject, url, file_path, file_name, file_size, mime_type, file_type)
  values ('ZIP fayl', 'Fənn', null, '40000000-0000-0000-0000-0000000000b4.zip', 'a.zip', 1, 'x', 'zip');
select t.ok('zip (x-zip-compressed) qəbul edilir', t.cnt('select 1 from public.materials where file_type = $$zip$$') = 1);
select t.throws('material həm keçid, həm fayl ola bilməz',
  $q$insert into public.materials (title, subject, url, file_path, file_name, file_size, mime_type, file_type)
     values ('İkili', 'Fənn', 'https://e.com/x', '40000000-0000-0000-0000-0000000000b1.pdf', 'a.pdf', 1, 'x', 'pdf')$q$, '23514');
select t.throws('material nə keçid, nə fayl olmadan yazılmır',
  $q$insert into public.materials (title, subject) values ('Boş', 'Fənn')$q$, '23514');
select t.throws('qrup ixtisassız göstərilə bilməz',
  $q$insert into public.materials (title, subject, url, group_name) values ('Qrup', 'Fənn', 'https://e.com/x', 'Sİ26/01SB')$q$, '23514');
select t.throws('qrup başqa ixtisasa aiddirsə material yazılmır',
  $q$insert into public.materials (title, subject, url, specialty, group_name) values ('Qrup', 'Fənn', 'https://e.com/x', 'KŞATS', 'Sİ26/01SB')$q$, '23503');
select t.back();

select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.throws('tələbə materials bucket-ə fayl yükləyə bilmir',
  $q$insert into storage.objects (bucket_id, name, metadata) values ('materials', '40000000-0000-0000-0000-0000000000b6.pdf', '{"size":1,"mimetype":"application/pdf"}')$q$, '42501');
select t.ok('tələbə material fayl obyektini silə bilmir (0 sətir)', t.affected($q$delete from storage.objects where bucket_id = 'materials'$q$) = 0);
select t.ok('tələbə fayllı materialı görür', t.cnt($q$select 1 from public.materials where file_path is not null$q$) = 2);
select t.back();
select t.as_user(null);
select t.ok('anon fayl obyektlərini oxuya bilir (ictimai bucket)', t.cnt($q$select 1 from storage.objects where bucket_id = 'materials'$q$) = 4);
select t.back();

-- ---------- Formlar (20261004000003_native_forms.sql)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000f', 'f@test.az', '{"first_name":"Fidan","last_name":"Nəsirova","specialty":"KŞŞİ","group":"KŞŞİ25/01SB"}');

-- Fixture-lər superuser ilə yazılır (id sütunu müştəriyə açıq deyil)
insert into public.forms (id, title, status, audience_mode, audience_specialties, audience_groups, fields, closes_at) values
  ('f0000000-0000-0000-0000-000000000001', 'Hamı üçün sorğu', 'published', 'all', '{}', '{}',
   '[{"id":"q1","type":"text","label":"Ad","required":true},{"id":"q2","type":"radio","label":"Seçim","required":true,"options":["Bəli","Xeyr"]},{"id":"q3","type":"checkbox","label":"Çoxlu","options":["A","B","C"]},{"id":"q4","type":"scale","label":"Qiymət"},{"id":"q5","type":"number","label":"Say"},{"id":"q6","type":"date","label":"Gün"},{"id":"q7","type":"email","label":"Poçt"}]', null),
  ('f0000000-0000-0000-0000-000000000002', 'Yalnız Sİ', 'published', 'restricted', '{"Sİ"}', '{}',
   '[{"id":"q1","type":"text","label":"Ad","required":true}]', null),
  ('f0000000-0000-0000-0000-000000000003', 'Yalnız KŞŞİ25/01SB', 'published', 'restricted', '{}', '{"KŞŞİ25/01SB"}',
   '[{"id":"q1","type":"text","label":"Ad","required":true}]', null),
  ('f0000000-0000-0000-0000-000000000004', 'Qaralama', 'draft', 'all', '{}', '{}',
   '[{"id":"q1","type":"text","label":"Ad"}]', null),
  ('f0000000-0000-0000-0000-000000000005', 'Vaxtı bitib', 'published', 'all', '{}', '{}',
   '[{"id":"q1","type":"text","label":"Ad"}]', now() - interval '1 day');

select t.throws_msg('naməlum sual növü rədd edilir',
  $q$insert into public.forms (title, fields) values ('X1X', '[{"id":"q1","type":"zzz","label":"A"}]')$q$, 'invalid-form');
select t.throws_msg('təkrar sual açarı rədd edilir',
  $q$insert into public.forms (title, fields) values ('X2X', '[{"id":"q1","type":"text","label":"A"},{"id":"q1","type":"text","label":"B"}]')$q$, 'invalid-form');
select t.throws_msg('seçim sualında variantlar təkrarlana bilməz',
  $q$insert into public.forms (title, fields) values ('X3X', '[{"id":"q1","type":"radio","label":"A","options":["a","a"]}]')$q$, 'invalid-form');
select t.throws_msg('boş sual mətni rədd edilir',
  $q$insert into public.forms (title, fields) values ('X4X', '[{"id":"q1","type":"text","label":"  "}]')$q$, 'invalid-form');
select t.throws_msg('mövcud olmayan ixtisas auditoriyada rədd edilir',
  $q$insert into public.forms (title, audience_mode, audience_specialties) values ('X5X', 'restricted', '{"YOXDUR"}')$q$, 'invalid-audience');
select t.throws('boş «məhdud» auditoriya rədd edilir',
  $q$insert into public.forms (title, audience_mode) values ('X6X', 'restricted')$q$, '23514');

-- Əvvəlki testlər tələbə «a»-nı KŞATS-a köçürüb; form testləri onun Sİ olduğunu fərz edir
update public.profiles set specialty = 'Sİ', group_name = 'Sİ26/01SB' where id = '00000000-0000-0000-0000-00000000000a';

-- ---- görünürlük (RLS)
select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.ok('Sİ tələbəsi: «hamı» + «Sİ» + vaxtı bitmiş dərc olunmuş formu görür (qaralama və KŞŞİ formu yox)',
  t.cnt('select 1 from public.forms') = 3
  and t.cnt($q$select 1 from public.forms where title in ('Hamı üçün sorğu', 'Yalnız Sİ', 'Vaxtı bitib')$q$) = 3);
select t.back();
select t.as_user('00000000-0000-0000-0000-00000000000b');
select t.ok('qrupsuz tələbə yalnız «hamı» formlarını görür', t.cnt('select 1 from public.forms') = 2);
select t.back();
select t.as_user('00000000-0000-0000-0000-00000000000f');
select t.ok('KŞŞİ25/01SB tələbəsi qrup formunu görür, Sİ formunu görmür',
  t.cnt($q$select 1 from public.forms where title = 'Yalnız KŞŞİ25/01SB'$q$) = 1
  and t.cnt($q$select 1 from public.forms where title = 'Yalnız Sİ'$q$) = 0);
select t.throws('tələbə form yarada bilmir', $q$insert into public.forms (title) values ('Hack')$q$, '42501');
select t.ok('tələbə formu dəyişə bilmir (RLS: 0 sətir)', t.affected($q$update public.forms set title = 'Hack'$q$) = 0);
select t.ok('tələbə formu silə bilmir (RLS: 0 sətir)', t.affected('delete from public.forms') = 0);
select t.back();
select t.as_user('00000000-0000-0000-0000-00000000000e');
select t.throws('redaktor form yarada bilmir (yalnız admin)', $q$insert into public.forms (title) values ('Hack')$q$, '42501');
select t.back();
select t.as_user(null);
select t.ok('anon yalnız dərc olunmuş «hamı» formlarını görür', t.cnt('select 1 from public.forms') = 2 and t.cnt($q$select 1 from public.forms where status <> 'published' or audience_mode <> 'all'$q$) = 0);
select t.throws('anon forms.created_by oxuya bilmir', 'select created_by from public.forms', '42501');
select t.throws('anon forma yaza bilmir', $q$insert into public.forms (title) values ('Hack')$q$, '42501');
select t.throws('anon cavab cədvəlini oxuya bilmir', 'select 1 from public.form_responses', '42501');
select t.throws_msg('qonaq «məhdud» formu doldura bilmir',
  $q$select public.submit_form('f0000000-0000-0000-0000-000000000002', '{"q1":"X"}'::jsonb)$q$, 'login-required');
select t.throws_msg('qonaq üçün də cavab sualların təyininə görə yoxlanılır',
  $q$select public.submit_form('f0000000-0000-0000-0000-000000000001', '{"q2":"Bəli"}'::jsonb)$q$, 'invalid-answers');
select public.submit_form('f0000000-0000-0000-0000-000000000001', '{"q1":"Qonaq","q2":"Bəli"}'::jsonb);
select t.back();
select t.as_user('00000000-0000-0000-0000-00000000000c');
select t.ok('admin bütün formları görür (qaralama daxil)', t.cnt('select 1 from public.forms') = 5);
select t.ok('admin form yarada bilir', t.affected($q$insert into public.forms (title, status, fields) values ('Admin yaratdı', 'draft', '[]')$q$) = 1);
select t.ok('slug avtomatik yaranır', (select slug ~ '^[a-z0-9]{12}$' and created_by = '00000000-0000-0000-0000-00000000000c' from public.forms where title = 'Admin yaratdı'));
select t.throws('admin slug-ı dəyişə bilmir (sütun icazəsi)', $q$update public.forms set slug = 'abcdef123456' where title = 'Admin yaratdı'$q$, '42501');
select t.ok('admin formu dəyişə bilir', t.affected($q$update public.forms set status = 'published', fields = '[{"id":"q1","type":"text","label":"Ad"}]' where title = 'Admin yaratdı'$q$) = 1);
select t.ok('updated_at yenilənib', (select updated_at is not null from public.forms where title = 'Admin yaratdı'));
select t.back();

-- ---- cavab göndərmə (submit_form)
select t.as_user('00000000-0000-0000-0000-00000000000a');
select public.submit_form('f0000000-0000-0000-0000-000000000001',
  '{"q1":"Aysel","q2":"Bəli","q3":["A","C"],"q4":4,"q5":12.5,"q6":"2026-10-04","q7":"a@b.az"}'::jsonb);
select t.throws_msg('eyni tələbə formu ikinci dəfə doldura bilməz',
  $q$select public.submit_form('f0000000-0000-0000-0000-000000000001', '{"q1":"Yenə","q2":"Xeyr"}'::jsonb)$q$, 'form-already-submitted');
select t.throws_msg('Sİ tələbəsi KŞŞİ qrup formunu doldura bilməz',
  $q$select public.submit_form('f0000000-0000-0000-0000-000000000003', '{"q1":"X"}'::jsonb)$q$, 'form-not-allowed');
select t.ok('tələbə yalnız öz doldurma qeydini görür', t.cnt('select 1 from public.form_submissions') = 1);
select t.ok('tələbə cavabları oxuya bilmir (RLS)', t.cnt('select 1 from public.form_responses') = 0);
select t.throws('cavab cədvəlinə birbaşa yazmaq olmaz (INSERT icazəsi yoxdur)',
  $q$insert into public.form_responses (form_id, answers) values ('f0000000-0000-0000-0000-000000000001', '{}')$q$, '42501');
select t.throws('doldurma qeydini birbaşa yazmaq olmaz',
  $q$insert into public.form_submissions (form_id, user_id) values ('f0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000a')$q$, '42501');
select t.back();

select t.as_user('00000000-0000-0000-0000-00000000000b');
select t.throws_msg('ixtisassız (NULL) tələbə məhdud formu doldura bilməz',
  $q$select public.submit_form('f0000000-0000-0000-0000-000000000002', '{"q1":"X"}'::jsonb)$q$, 'form-not-allowed');
select t.throws_msg('qaralama formu doldurmaq olmaz',
  $q$select public.submit_form('f0000000-0000-0000-0000-000000000004', '{"q1":"X"}'::jsonb)$q$, 'form-unavailable');
select t.throws_msg('vaxtı bitmiş formu doldurmaq olmaz',
  $q$select public.submit_form('f0000000-0000-0000-0000-000000000005', '{"q1":"X"}'::jsonb)$q$, 'form-closed');
select t.throws_msg('mövcud olmayan formu doldurmaq olmaz',
  $q$select public.submit_form('f0000000-0000-0000-0000-0000000000ff', '{"q1":"X"}'::jsonb)$q$, 'form-unavailable');
select t.back();

select t.as_user('00000000-0000-0000-0000-00000000000f');
select t.throws_msg('məcburi sual boşdursa rədd edilir',
  $q$select public.submit_form('f0000000-0000-0000-0000-000000000001', '{"q2":"Bəli"}'::jsonb)$q$, 'invalid-answers');
select t.throws_msg('variantlarda olmayan seçim rədd edilir',
  $q$select public.submit_form('f0000000-0000-0000-0000-000000000001', '{"q1":"A","q2":"Ola bilər"}'::jsonb)$q$, 'invalid-answers');
select t.throws_msg('qiymət 1-5 aralığından kənardırsa rədd edilir',
  $q$select public.submit_form('f0000000-0000-0000-0000-000000000001', '{"q1":"A","q2":"Bəli","q4":9}'::jsonb)$q$, 'invalid-answers');
select t.throws_msg('yanlış tarix rədd edilir',
  $q$select public.submit_form('f0000000-0000-0000-0000-000000000001', '{"q1":"A","q2":"Bəli","q6":"2026-13-45"}'::jsonb)$q$, 'invalid-answers');
select t.throws_msg('yanlış e-poçt rədd edilir',
  $q$select public.submit_form('f0000000-0000-0000-0000-000000000001', '{"q1":"A","q2":"Bəli","q7":"abc"}'::jsonb)$q$, 'invalid-answers');
select t.throws_msg('çox seçimdə variantlarda olmayan dəyər rədd edilir',
  $q$select public.submit_form('f0000000-0000-0000-0000-000000000001', '{"q1":"A","q2":"Bəli","q3":["Z"]}'::jsonb)$q$, 'invalid-answers');
select t.throws_msg('mətn sahəsinə ədəd göndərmək olmaz',
  $q$select public.submit_form('f0000000-0000-0000-0000-000000000001', '{"q1":5,"q2":"Bəli"}'::jsonb)$q$, 'invalid-answers');
select t.throws_msg('cavab obyekt deyilsə rədd edilir',
  $q$select public.submit_form('f0000000-0000-0000-0000-000000000001', '[]'::jsonb)$q$, 'invalid-answers');
select t.ok('uğursuz cəhdlər doldurma qeydi yaratmır', t.cnt('select 1 from public.form_submissions') = 0);
select public.submit_form('f0000000-0000-0000-0000-000000000001', '{"q1":"  Fidan  ","q2":"Xeyr","zzz":"atılmalıdır"}'::jsonb);
select public.submit_form('f0000000-0000-0000-0000-000000000003', '{"q1":"Qrup cavabı"}'::jsonb);
select t.back();

select t.ok('cavablar yazılıb, mətn kəsilib, təyində olmayan açar atılıb',
  (select count(*) from public.form_responses where form_id = 'f0000000-0000-0000-0000-000000000001') = 3
  and (select count(*) from public.form_responses where answers ? 'zzz') = 0
  and exists (select 1 from public.form_responses where answers ->> 'q1' = 'Fidan' and answers ->> 'q2' = 'Xeyr'));
select t.ok('qeydiyyatlının cavabında ad və e-poçt serverdə profildən yazılır',
  exists (select 1 from public.form_responses where respondent_id = '00000000-0000-0000-0000-00000000000a' and respondent_name is not null and respondent_email is not null));
select t.ok('qonaq cavabı anonimdir: ad, e-poçt və respondent_id boşdur',
  exists (select 1 from public.form_responses where answers ->> 'q1' = 'Qonaq' and respondent_id is null and respondent_name is null and respondent_email is null));

select t.as_user('00000000-0000-0000-0000-00000000000c');
select t.ok('admin cavabları oxuya bilir', t.cnt('select 1 from public.form_responses') = 4);
select t.ok('admin girişli istifadəçilərin ad və e-poçtunu görür, qonaq cavabı anonimdir', t.cnt('select 1 from public.form_responses where respondent_email is not null') = 3 and t.cnt('select 1 from public.form_responses where respondent_email is null') = 1);
select t.ok('admin doldurma qeydlərini görmür (tələbə ilə cavab əlaqələndirilmir)', t.cnt('select 1 from public.form_submissions') = 0);
select t.ok('admin cavab sayını form siyahısında ala bilir',
  (select count(*) from public.form_responses where form_id = 'f0000000-0000-0000-0000-000000000001') = 3);
select t.ok('admin formu silə bilir', t.affected($q$delete from public.forms where title = 'Admin yaratdı'$q$) = 1);
select t.back();

delete from public.forms where id = 'f0000000-0000-0000-0000-000000000001';
select t.ok('form silinəndə cavablar və doldurma qeydləri cascade ilə silinir',
  (select count(*) from public.form_responses where form_id = 'f0000000-0000-0000-0000-000000000001') = 0
  and (select count(*) from public.form_submissions where form_id = 'f0000000-0000-0000-0000-000000000001') = 0);

-- ---------- Şöbə əməkdaşlarına mesajlar (staff_messages)
-- Əməkdaş kartını hesaba bağlamaq: yalnız admin; hesab admin/editor olmalıdır; bir hesab bir karta.
update public.profiles set role = 'student' where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');
update public.profiles set role = 'editor' where id = '00000000-0000-0000-0000-00000000000e';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000c';
select t.as_user('00000000-0000-0000-0000-00000000000b');
select t.throws('tələbə əməkdaş kartı yarada bilmir',
  $q$insert into public.team_members (full_name, job_title, profile_id) values ('Test Əməkdaş', 'Müəllim', '00000000-0000-0000-0000-00000000000e')$q$, '42501');
select t.back();

select t.throws('tələbə hesabı əməkdaş kartına bağlanmır',
  $q$insert into public.team_members (full_name, job_title, profile_id) values ('Bəhruz Quliyev', 'Müəllim', '00000000-0000-0000-0000-00000000000b')$q$, '23514');
insert into public.team_members (id, full_name, job_title, profile_id)
  values ('50000000-0000-0000-0000-000000000001', 'Elnur Rzayev', 'Müəllim', '00000000-0000-0000-0000-00000000000e');
select t.throws('eyni hesab ikinci karta bağlanmır',
  $q$insert into public.team_members (full_name, job_title, profile_id) values ('Təkrar Kart', 'Müəllim', '00000000-0000-0000-0000-00000000000e')$q$, '23505');
insert into public.team_members (id, full_name, job_title, active, profile_id)
  values ('50000000-0000-0000-0000-000000000002', 'Cavid Həsənov', 'Müdir', false, '00000000-0000-0000-0000-00000000000c');

-- Göndərmə
select t.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.staff_messages (recipient_id, subject, message)
  values ('00000000-0000-0000-0000-00000000000e', '  Mövzu  ', '  Mesaj mətni burada  ');
select t.ok('tələbə əməkdaşa mesaj göndərə bilir; sender_id, status, ad snapshot-ları və kəsilmiş mətn serverdə yazılır',
  exists (select 1 from public.staff_messages
          where sender_id = '00000000-0000-0000-0000-00000000000a' and recipient_id = '00000000-0000-0000-0000-00000000000e'
            and status = 'sent' and read_at is null and subject = 'Mövzu' and message = 'Mesaj mətni burada'
            and sender_name = (select btrim(first_name || ' ' || last_name) from public.profiles where id = '00000000-0000-0000-0000-00000000000a')
            and recipient_name = 'Elnur Rzayev'));
select t.throws('sender_id müştəridən qəbul edilmir (başqasının adından göndərmək olmaz)',
  $q$insert into public.staff_messages (sender_id, recipient_id, subject, message) values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000e', 'Mövzu', 'Mesaj mətni')$q$, '42501');
select t.throws('status müştəri tərəfindən təyin oluna bilmir',
  $q$insert into public.staff_messages (recipient_id, subject, message, status) values ('00000000-0000-0000-0000-00000000000e', 'Mövzu', 'Mesaj mətni', 'read')$q$, '42501');
select t.throws('alıcı əməkdaş (karta bağlı admin/editor) deyilsə rədd edilir',
  $q$insert into public.staff_messages (recipient_id, subject, message) values ('00000000-0000-0000-0000-00000000000b', 'Mövzu', 'Mesaj mətni')$q$, '23514');
select t.throws('gizli (aktiv olmayan) kartın sahibinə göndərmək olmaz',
  $q$insert into public.staff_messages (recipient_id, subject, message) values ('00000000-0000-0000-0000-00000000000c', 'Mövzu', 'Mesaj mətni')$q$, '23514');
select t.throws('boş mövzu rədd edilir',
  $q$insert into public.staff_messages (recipient_id, subject, message) values ('00000000-0000-0000-0000-00000000000e', '   ', 'Mesaj mətni')$q$, '23514');
select t.throws('boş mesaj rədd edilir',
  $q$insert into public.staff_messages (recipient_id, subject, message) values ('00000000-0000-0000-0000-00000000000e', 'Mövzu', '   ')$q$, '23514');
select t.throws('çox uzun mesaj rədd edilir',
  $q$insert into public.staff_messages (recipient_id, subject, message) values ('00000000-0000-0000-0000-00000000000e', 'Mövzu', repeat('a', 3001))$q$, '23514');
select t.throws('çox uzun mövzu rədd edilir',
  $q$insert into public.staff_messages (recipient_id, subject, message) values ('00000000-0000-0000-0000-00000000000e', repeat('a', 151), 'Mesaj mətni')$q$, '23514');

-- Tələbə: yalnız öz mesajı, dəyişdirmək/silmək/yönləndirmək yoxdur
select t.ok('tələbə öz göndərdiyi mesajı görür', t.cnt('select 1 from public.staff_messages') = 1);
select t.throws('tələbə mövzunu redaktə edə bilmir', $q$update public.staff_messages set subject = 'Dəyişdi'$q$, '42501');
select t.throws('tələbə mesajı redaktə edə bilmir', $q$update public.staff_messages set message = 'Dəyişdi dəyişdi'$q$, '42501');
select t.throws('tələbə mesajı başqa əməkdaşa yönləndirə bilmir (recipient_id dəyişmir)',
  $q$update public.staff_messages set recipient_id = '00000000-0000-0000-0000-00000000000c'$q$, '42501');
select t.throws('tələbə read_at-i dəyişə bilmir', $q$update public.staff_messages set read_at = now()$q$, '42501');
select t.ok('tələbə status-u dəyişə bilmir (alıcı deyil)', t.affected($q$update public.staff_messages set status = 'read'$q$) = 0);
select t.ok('tələbə mesajı silə bilmir', t.affected('delete from public.staff_messages') = 0);
select t.back();

-- Başqa tələbə heç nə görmür, dəyişə/silə bilmir
select t.as_user('00000000-0000-0000-0000-00000000000b');
select t.ok('başqa tələbə mesajları görmür', t.cnt('select 1 from public.staff_messages') = 0);
select t.ok('başqa tələbə mesajı oxundu işarələyə bilmir', t.affected($q$update public.staff_messages set status = 'read'$q$) = 0);
select t.ok('başqa tələbə mesajı silə bilmir', t.affected('delete from public.staff_messages') = 0);
select t.back();

-- Qonaq (giriş etməyib)
select t.as_user(null);
select t.throws('qonaq mesajları oxuya bilmir', 'select 1 from public.staff_messages', '42501');
select t.throws('qonaq mesaj göndərə bilmir',
  $q$insert into public.staff_messages (recipient_id, subject, message) values ('00000000-0000-0000-0000-00000000000e', 'Mövzu', 'Mesaj mətni')$q$, '42501');
select t.back();

-- Əməkdaş (alıcı)
select t.as_user('00000000-0000-0000-0000-00000000000e');
select t.ok('əməkdaş ona göndərilən mesajı görür', t.cnt('select 1 from public.staff_messages') = 1);
select t.throws('əməkdaş özünə mesaj göndərə bilmir',
  $q$insert into public.staff_messages (recipient_id, subject, message) values ('00000000-0000-0000-0000-00000000000e', 'Mövzu', 'Mesaj mətni')$q$, '23514');
select t.throws('əməkdaş mesaj mətnini dəyişə bilmir', $q$update public.staff_messages set message = 'Dəyişdi dəyişdi'$q$, '42501');
select t.throws('əməkdaş read_at-i əl ilə yaza bilmir', $q$update public.staff_messages set read_at = now() - interval '5 days'$q$, '42501');
select t.ok('əməkdaş mesajı silə bilmir', t.affected('delete from public.staff_messages') = 0);
select t.ok('əməkdaş mesajı oxundu işarələyir', t.affected($q$update public.staff_messages set status = 'read'$q$) = 1);
select t.ok('oxundu: status = read və read_at server vaxtıdır',
  exists (select 1 from public.staff_messages where status = 'read' and read_at is not null and read_at <= now()));
select t.ok('təkrar oxundu işarələmək xəta vermir və read_at dəyişmir',
  t.affected($q$update public.staff_messages set status = 'read'$q$) = 1
  and (select read_at from public.staff_messages) is not null);
select t.throws('oxunmuşu yenidən göndərildi vəziyyətinə qaytarmaq olmaz', $q$update public.staff_messages set status = 'sent'$q$, '42501');
select t.back();

-- Tələbə cavabdan sonra statusu görür
select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.ok('tələbə mesajın oxunduğunu görür', exists (select 1 from public.staff_messages where status = 'read' and read_at is not null));
select t.back();

-- Başqa əməkdaş (admin, kartı gizli) ona göndərilməyən mesajı alıcı kimi görmür, amma admin olduğu üçün moderasiya imkanı var
select t.as_user('00000000-0000-0000-0000-00000000000c');
select t.ok('admin bütün mesajları görür', t.cnt('select 1 from public.staff_messages') = 1);
select t.ok('admin başqasının adından oxundu işarələyə bilmir', t.affected($q$update public.staff_messages set status = 'sent'$q$) = 0);
select t.back();

-- Sürət limiti: saatda ən çox 20 mesaj
select t.as_user('00000000-0000-0000-0000-00000000000a');
do $$
begin
  for i in 1..19 loop
    insert into public.staff_messages (recipient_id, subject, message)
      values ('00000000-0000-0000-0000-00000000000e', 'Sürət ' || i, 'Sürət limiti testi');
  end loop;
end $$;
select t.throws('saatda 20-dən çox mesaj göndərmək olmaz',
  $q$insert into public.staff_messages (recipient_id, subject, message) values ('00000000-0000-0000-0000-00000000000e', 'Artıq', 'Sürət limiti testi')$q$, '54000');
select t.back();

-- Admin moderasiya: silə bilir
select t.as_user('00000000-0000-0000-0000-00000000000c');
select t.ok('admin mesajları silə bilir', t.affected('delete from public.staff_messages') = 20);
select t.back();

-- Əməkdaşın hesabı downgrade olunarsa yeni mesaj qəbul etmir
update public.profiles set role = 'student' where id = '00000000-0000-0000-0000-00000000000e';
select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.throws('rolu artıq admin/editor olmayan hesaba mesaj göndərmək olmaz',
  $q$insert into public.staff_messages (recipient_id, subject, message) values ('00000000-0000-0000-0000-00000000000e', 'Mövzu', 'Mesaj mətni')$q$, '23514');
select t.back();
update public.profiles set role = 'editor' where id = '00000000-0000-0000-0000-00000000000e';

-- ---------- Cascade
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
select t.ok('istifadəçi silinəndə profil və şəxsi məlumatlar cascade ilə silinir',
  (select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 0
  and (select count(*) from public.personal_notes) = 0
  and (select count(*) from public.saved_materials) = 0
  and (select count(*) from public.event_registrations) = 0);

rollback;
\echo 'BÜTÜN RLS TESTLƏRİ KEÇDİ'
