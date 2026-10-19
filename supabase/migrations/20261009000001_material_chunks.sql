-- =====================================================================
-- Sosial İş AI: RAG üçün material mətn parçaları (MVP: tam mətn axtarışı)
--
--   * public.material_chunks: materialların fayllarından çıxarılmış mətn parçaları (səhifə nömrəsi ilə).
--   * Oxu: materials ilə eyni qayda. Siyasət materials sətrinin görünməsindən asılıdır; materials RLS-i
--     gələcəkdə məhdudlaşdırılarsa, parçalar da avtomatik məhdudlaşır.
--   * Yazma: yalnız service_role (scripts/ingest-materials.mjs). anon/authenticated yaza bilməz.
--   * public.search_material_chunks(): AI endpoint-i bunu publishable (anon) açarla çağırır, RLS tətbiq olunur.
--
-- Niyə pgvector yox: Groq embedding modeli təqdim etmir; ayrıca embedding provayderi və açarı lazım olardı.
-- MVP üçün tam mətn axtarışı kifayətdir; axtarış funksiyasının imzası dəyişmədən sonradan vektor axtarışı ilə əvəz edilə bilər.
--
-- Bu fayl 20261008000001_staff_messages_guest.sql-dən SONRA işə salınır.
-- =====================================================================

-- Azərbaycan hərflərini ASCII-yə endirir ki, "işçi" və "isci" eyni axtarılsın.
create or replace function public.az_fold(t text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select translate(
    lower(translate(coalesce(t, ''), 'İƏÖÜŞÇĞ', 'ieouscg')),
    'əıöüşçğâîêû', 'eiouscgaieu'
  )
$$;

create table public.material_chunks (
  id          uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials (id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  page        integer check (page is null or page > 0),
  content     text not null check (char_length(content) between 1 and 4000),
  tsv         tsvector generated always as (to_tsvector('simple', public.az_fold(content))) stored,
  created_at  timestamptz not null default now(),
  unique (material_id, chunk_index)
);
create index material_chunks_tsv_idx on public.material_chunks using gin (tsv);

alter table public.material_chunks enable row level security;
revoke all on public.material_chunks from anon, authenticated;
grant select on public.material_chunks to anon, authenticated;

create policy material_chunks_select on public.material_chunks
  for select to anon, authenticated
  using (exists (select 1 from public.materials m where m.id = material_id));

-- ---------------------------------------------------------------------
-- Axtarış: sualdakı sözlərin 4 hərflik kökləri (Azərbaycan dili suffiksli olduğu üçün) OR ilə axtarılır, rank ilə sıralanır.
--   * Mətni çıxarılmış materiallar üçün parçalar, mətni olmayan (keçid) materiallar üçün ad/fənn/təsvir qaytarılır.
--   * security invoker: çağıranın RLS qaydaları tətbiq olunur.
-- ---------------------------------------------------------------------
create or replace function public.search_material_chunks(query_text text, match_count integer default 6)
returns table (
  material_id uuid,
  title       text,
  subject     text,
  chunk_index integer,
  page        integer,
  content     text,
  score       real
)
language sql
stable
security invoker
set search_path = ''
as $$
  with stems as (
    select distinct case when char_length(w) >= 5 then left(w, 4) else w end as stem
    from regexp_split_to_table(public.az_fold(left(coalesce(query_text, ''), 300)), '[^a-z0-9]+') as w
    where char_length(w) >= 3
      and w <> all (array['nedir','hansi','hansilar','hansilardir','nece','neye','neden','niye','kimdir',
                          'haqqinda','barede','ucun','ile','izah','edin','ver','mene','sade','dilde'])
    limit 12
  ),
  q as (
    select to_tsquery('simple', string_agg(stem || ':*', ' | ')) as tsq from stems
  ),
  chunk_hits as (
    select c.material_id, m.title, m.subject, c.chunk_index, c.page, c.content,
           ts_rank_cd(c.tsv, q.tsq) as score
    from public.material_chunks c
    join public.materials m on m.id = c.material_id
    cross join q
    where c.tsv @@ q.tsq
  ),
  meta_hits as (
    select m.id, m.title, m.subject, 0, null::integer,
           left(concat_ws('. ', m.title, m.subject, nullif(m.description, '')), 600),
           (ts_rank_cd(l.v, q.tsq) * 0.8)::real
    from public.materials m
    cross join q
    cross join lateral (
      select to_tsvector('simple', public.az_fold(concat_ws(' ', m.title, m.subject, m.description))) as v
    ) l
    where l.v @@ q.tsq
      and not exists (select 1 from public.material_chunks c where c.material_id = m.id)
  )
  select * from (select * from chunk_hits union all select * from meta_hits) r
  order by score desc
  limit least(greatest(coalesce(match_count, 6), 1), 10)
$$;

revoke all on function public.search_material_chunks(text, integer) from public;
grant execute on function public.search_material_chunks(text, integer) to anon, authenticated;
