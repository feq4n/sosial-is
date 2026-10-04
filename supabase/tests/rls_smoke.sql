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
select t.ok('metadata-dan ad/ixtisas/qrup/bilet götürülür; köhnə degree/course doldurulmur',
  (select first_name = 'Aysel' and specialty = 'Sİ' and group_name = 'Sİ26/01SB' and student_id = 'S-1' and degree is null and course is null from public.profiles where email = 'a@test.az'));
select t.ok('qrupsuz qeydiyyat (köçürülən köhnə hesablar) mümkündür',
  (select specialty is null and group_name is null from public.profiles where email = 'b@test.az'));
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
select t.throws('tələbə köhnə course sütununu dəyişə bilmir (sütun icazəsi)',
  $q$update public.profiles set course = 3 where id = '00000000-0000-0000-0000-00000000000a'$q$, '42501');
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

-- ---------- Cascade
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
select t.ok('istifadəçi silinəndə profil və şəxsi məlumatlar cascade ilə silinir',
  (select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 0
  and (select count(*) from public.personal_notes) = 0
  and (select count(*) from public.saved_materials) = 0
  and (select count(*) from public.event_registrations) = 0);

rollback;
\echo 'BÜTÜN RLS TESTLƏRİ KEÇDİ'
