import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Search, Star } from 'lucide-react';
import { useAsync } from '@/hooks/useAsync';
import { useSeo } from '@/hooks/useSeo';
import { announcementsApi, isSampleMode } from '@/services/content';
import { AnnouncementCard } from '@/components/cards';
import { Badge, ButtonLink, EmptyState, ErrorState, ListSkeleton, PageHeader, SampleNotice, SelectField, TextField, Skeleton } from '@/components/ui';
import { announcementCategories } from '@/utils/labels';
import { formatDate, matchesQuery } from '@/utils/format';
import type { AnnouncementCategory } from '@/types';

export function Announcements() {
  useSeo('Elanlar', 'Sosial iş şöbəsinin son elanları: tədris, imtahan, təcrübə və tələbə həyatı.');
  const { data, loading, error, reload } = useAsync(() => announcementsApi.list(), []);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'' | AnnouncementCategory>('');
  const [order, setOrder] = useState<'new' | 'old'>('new');

  const items = useMemo(() => {
    const f = (data ?? []).filter((a) => (!cat || a.category === cat) && matchesQuery(q, a.title, a.summary, a.body));
    f.sort((a, b) => (order === 'new' ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)));
    return [...f.filter((a) => a.important), ...f.filter((a) => !a.important)];
  }, [data, q, cat, order]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <PageHeader title="Elanlar" text="Şöbədən gələn son məlumatlar. Vacib elanlar siyahının başında göstərilir." />
      {isSampleMode && <SampleNotice />}
      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_12rem_12rem]" role="search">
        <div className="relative"><TextField label="Axtarış" type="search" placeholder="Başlıq və ya mətn üzrə" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" /><Search className="pointer-events-none absolute bottom-3 left-3 size-5 text-muted" aria-hidden /></div>
        <SelectField label="Kateqoriya" value={cat} onChange={(e) => setCat(e.target.value as '' | AnnouncementCategory)}>
          <option value="">Hamısı</option>
          {Object.entries(announcementCategories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </SelectField>
        <SelectField label="Sıralama" value={order} onChange={(e) => setOrder(e.target.value as 'new' | 'old')}>
          <option value="new">Əvvəlcə yenilər</option><option value="old">Əvvəlcə köhnələr</option>
        </SelectField>
      </div>
      {loading ? <ListSkeleton /> : error ? <ErrorState message={error} onRetry={reload} /> :
        items.length ? <div className="grid gap-4" aria-live="polite">{items.map((a) => <AnnouncementCard key={a.id} a={a} />)}</div> :
          <EmptyState title={data?.length ? 'Uyğun elan tapılmadı' : 'Hələ elan yoxdur'} text={data?.length ? 'Axtarış sözünü və ya kateqoriyanı dəyişin.' : 'Yeni elanlar yayımlandıqda burada görünəcək.'} />}
    </div>
  );
}

export function AnnouncementDetail() {
  const { id = '' } = useParams();
  const { data, loading, error, reload } = useAsync(() => announcementsApi.get(id), [id]);
  useSeo(data?.title ?? 'Elan', data?.summary);
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link to="/announcements" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"><ArrowLeft className="size-4" aria-hidden />Bütün elanlar</Link>
      {loading ? <div className="grid gap-3"><Skeleton className="h-8 w-3/4" /><Skeleton className="h-4 w-1/3" /><Skeleton className="h-40" /></div> :
        error ? <ErrorState message={error} onRetry={reload} /> :
          !data ? <EmptyState title="Elan tapılmadı" text="Elan silinmiş və ya gizlədilmiş ola bilər." action={<ButtonLink to="/announcements">Elanlara qayıt</ButtonLink>} /> : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {data.important && <Badge tone="accent"><Star className="size-3" aria-hidden />Vacib</Badge>}
                <Badge tone="brand">{announcementCategories[data.category]}</Badge>
                <time dateTime={data.createdAt} className="text-sm text-muted">{formatDate(data.createdAt)}</time>
              </div>
              <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">{data.title}</h1>
              <div className="mt-6 space-y-4 text-[1.05rem] leading-relaxed">{data.body.split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}</div>
            </>
          )}
    </article>
  );
}
