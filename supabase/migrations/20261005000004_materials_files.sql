-- =====================================================================
-- Tədris materiallarına fayl yükləmə
--
--   * Mövcud materiallar və keçidlər olduğu kimi qalır (url sütunu indi boş ola bilər, amma ya url, ya fayl olmalıdır).
--   * Fayllar Supabase Storage-də "materials" bucket-indədir (ictimai oxu, çünki materiallar da ictimai oxunur).
--     Yükləmə/dəyişmə/silmə YALNIZ redaktor və admin üçündür (storage.objects RLS siyasətləri).
--   * Server tərəfi yoxlama (frontend-dən asılı deyil):
--       - Storage bucket: file_size_limit (25 MB) və allowed_mime_types
--       - storage.objects siyasəti: icazəli ad şablonu "<uuid>.<uzantı>" + rol
--       - materials tətiyi: fayl Storage-də mövcud olmalıdır; ölçü və MIME Storage-in qeyd etdiyi dəyərlərdən
--         götürülür (müştərinin göndərdiyi file_size/mime_type əzilir) və uzantıya uyğun olmalıdır
--     Diqqət: Storage MIME-i sorğu başlığından götürür; faylın baytlarına (magic bytes) baxmır. Bayt yoxlaması frontend-də
--     aparılır. Tam server tərəfi bayt yoxlaması üçün Edge Function lazımdır (bax: README).
--   * İxtisas/qrup metadata: boşdursa material hamıya aiddir.
--
-- Bu fayl 20261005000003_site_content.sql-dən SONRA işə salınır.
-- =====================================================================

alter table public.materials alter column url drop not null;
alter table public.materials drop constraint if exists materials_url_check;
alter table public.materials add constraint materials_url_valid
  check (url is null or (char_length(url) between 8 and 1000 and url ~ '^https://'));

alter table public.materials drop constraint if exists materials_file_type_check;
alter table public.materials add constraint materials_file_type_check
  check (file_type in ('pdf', 'doc', 'ppt', 'video', 'link', 'xls', 'txt', 'zip'));

alter table public.materials
  add column file_path  text,
  add column file_name  text,
  add column file_size  bigint,
  add column mime_type  text,
  add column specialty  text,
  add column group_name text,
  add column updated_at timestamptz;

alter table public.materials add constraint materials_file_path_valid
  check (file_path is null or file_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt|zip)$');
alter table public.materials add constraint materials_file_name_valid
  check (file_name is null or (char_length(file_name) between 1 and 180 and file_name !~ '[/\\[:cntrl:]]'));
alter table public.materials add constraint materials_file_size_valid
  check (file_size is null or file_size between 1 and 26214400);
alter table public.materials add constraint materials_file_meta_together
  check ((file_path is null) = (file_name is null) and (file_path is null) = (file_size is null) and (file_path is null) = (mime_type is null));
alter table public.materials add constraint materials_single_source
  check ((url is not null) <> (file_path is not null));
alter table public.materials add constraint materials_group_needs_specialty
  check (group_name is null or specialty is not null);

alter table public.materials add constraint materials_specialty_fk
  foreign key (specialty) references public.specialties (code) on update cascade;
alter table public.materials add constraint materials_placement_fk
  foreign key (specialty, group_name) references public.groups (specialty, code) on update cascade;
create index materials_specialty_idx on public.materials (specialty) where specialty is not null;

create trigger materials_set_updated_at
  before update on public.materials
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Storage bucket + siyasətlər
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materials', 'materials', true, 26214400, array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed'
])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy materials_files_select on storage.objects
  for select to anon, authenticated using (bucket_id = 'materials');
create policy materials_files_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'materials' and public.is_editor()
              and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt|zip)$');
create policy materials_files_update on storage.objects
  for update to authenticated
  using (bucket_id = 'materials' and public.is_editor())
  with check (bucket_id = 'materials' and public.is_editor()
              and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt|zip)$');
create policy materials_files_delete on storage.objects
  for delete to authenticated using (bucket_id = 'materials' and public.is_editor());

-- ---------------------------------------------------------------------
-- Tətik: fayl mövcuddur, ölçü/MIME Storage-dən götürülür və uzantıya uyğundur
-- ---------------------------------------------------------------------
create or replace function public.materials_check_file()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  obj  record;
  ext  text;
  mime text;
  sz   bigint;
begin
  if new.file_path is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.file_path is not distinct from old.file_path then
    return new;
  end if;

  select o.metadata into obj from storage.objects o where o.bucket_id = 'materials' and o.name = new.file_path;
  if not found then
    raise exception 'file-missing' using errcode = '23514';
  end if;

  sz   := nullif(obj.metadata ->> 'size', '')::bigint;
  mime := lower(coalesce(obj.metadata ->> 'mimetype', ''));
  ext  := lower(substring(new.file_path from '\.([a-z0-9]+)$'));

  if sz is null or sz < 1 or sz > 26214400 then
    raise exception 'file-too-large' using errcode = '23514';
  end if;

  if not (case ext
      when 'pdf'  then mime = 'application/pdf'
      when 'doc'  then mime = 'application/msword'
      when 'docx' then mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      when 'ppt'  then mime = 'application/vnd.ms-powerpoint'
      when 'pptx' then mime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      when 'xls'  then mime = 'application/vnd.ms-excel'
      when 'xlsx' then mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      when 'txt'  then mime = 'text/plain'
      when 'zip'  then mime in ('application/zip', 'application/x-zip-compressed')
      else false end) then
    raise exception 'file-type-mismatch' using errcode = '23514';
  end if;

  new.file_size := sz;
  new.mime_type := mime;
  return new;
end;
$$;
revoke all on function public.materials_check_file() from public;

create trigger materials_check_file_trg
  before insert or update on public.materials
  for each row execute function public.materials_check_file();
