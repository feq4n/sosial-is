import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, ExternalLink, Search } from 'lucide-react';
import { useAsync } from '@/hooks/useAsync';
import { useSaved } from '@/hooks/useSaved';
import { useSeo } from '@/hooks/useSeo';
import { isSampleMode, materialsApi } from '@/services/content';
import { MaterialCard, materialAction } from '@/components/cards';
import { specialtyLabel } from '@/data/timetable';
import { formatBytes } from '@/utils/upload';
import { Badge, Button, ButtonLink, EmptyState, ErrorState, ListSkeleton, PageHeader, SampleNotice, SelectField, Skeleton, TextField } from '@/components/ui';
import { formatDate, matchesQuery } from '@/utils/format';
import { materialTypes } from '@/utils/labels';
import type { MaterialType } from '@/types';

export function Materials() {
  useSeo('Tədris materialları', 'Fənlər üzrə mühazirə konspektləri, təqdimatlar və digər tədris materialları.');
  const { data, loading, error, reload } = useAsync(() => materialsApi.list(), []);
  const saved = useSaved();
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState('');
  const [type, setType] = useState<'' | MaterialType>('');
  const [spec, setSpec] = useState('');

  const subjects = useMemo(() => [...new Set((data ?? []).map((m) => m.subject))].sort((a, b) => a.localeCompare(b, 'az')), [data]);
  const items = useMemo(() => (data ?? []).filter((m) =>
    (!subject || m.subject === subject) && (!type || m.fileType === type) && (!spec || !m.specialty || m.specialty === spec)
    && matchesQuery(q, m.title, m.subject, m.author, m.description, m.fileName)), [data, q, subject, type, spec]);
  const specs = useMemo(() => [...new Set((data ?? []).map((m) => m.specialty).filter((x): x is string => Boolean(x)))], [data]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader title="Tədris materialları" text="Fənlər üzrə resurslar. Daxil olduqdan sonra materialları yadda saxlaya bilərsiniz." />
      {isSampleMode && <SampleNotice />}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_13rem_11rem_11rem]" role="search">
        <div className="relative"><TextField label="Axtarış" type="search" placeholder="Ad, fənn və ya müəllif" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" /><Search className="pointer-events-none absolute bottom-3 left-3 size-5 text-muted" aria-hidden /></div>
        <SelectField label="Fənn" value={subject} onChange={(e) => setSubject(e.target.value)}><option value="">Bütün fənlər</option>{subjects.map((s) => <option key={s}>{s}</option>)}</SelectField>
        <SelectField label="Növ" value={type} onChange={(e) => setType(e.target.value as '' | MaterialType)}><option value="">Hamısı</option>{Object.entries(materialTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</SelectField>
        {specs.length > 0 && <SelectField label="İxtisas" value={spec} onChange={(e) => setSpec(e.target.value)}><option value="">Hamısı</option>{specs.map((s) => <option key={s} value={s}>{specialtyLabel(s)}</option>)}</SelectField>}
      </div>
      {loading ? <ListSkeleton /> : error ? <ErrorState message={error} onRetry={reload} /> :
        items.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">{items.map((m) => <MaterialCard key={m.id} m={m} signedIn={saved.signedIn} saved={saved.ids.has(m.id)} onToggle={() => saved.toggle(m.id)} />)}</div> :
          <EmptyState title={data?.length ? 'Uyğun material tapılmadı' : 'Material hələ əlavə olunmayıb'} text={data?.length ? 'Axtarışı və ya filtrləri dəyişin.' : 'Materiallar əlavə olunduqda burada görünəcək.'} />}
      {!saved.signedIn && !loading && !!data?.length && <p className="mt-6 text-sm text-muted"><Link className="font-semibold text-brand hover:underline" to="/login">Daxil olun</Link> — materialları yadda saxlamaq üçün.</p>}
    </div>
  );
}

export function MaterialDetail() {
  const { id = '' } = useParams();
  const { data, loading, error, reload } = useAsync(() => materialsApi.get(id), [id]);
  const saved = useSaved();
  useSeo(data?.title ?? 'Material', data?.description);
  const action = data ? materialAction(data) : null;
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link to="/materials" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"><ArrowLeft className="size-4" aria-hidden />Bütün materiallar</Link>
      {loading ? <div className="grid gap-3"><Skeleton className="h-8 w-3/4" /><Skeleton className="h-32" /></div> : error ? <ErrorState message={error} onRetry={reload} /> :
        !data ? <EmptyState title="Material tapılmadı" action={<ButtonLink to="/materials">Materiallara qayıt</ButtonLink>} /> : (
          <>
            <div className="flex flex-wrap items-center gap-2"><Badge tone="brand">{materialTypes[data.fileType]}</Badge><span className="text-sm text-muted">{data.subject}</span>{data.specialty && <Badge>{specialtyLabel(data.specialty)}{data.groupName ? ` · ${data.groupName}` : ''}</Badge>}</div>
            <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">{data.title}</h1>
            <dl className="mt-5 grid grid-cols-2 gap-4 rounded-2xl border border-line bg-surface p-5 text-sm">
              <div><dt className="text-muted">Müəllif</dt><dd className="font-semibold">{data.author}</dd></div>
              <div><dt className="text-muted">Əlavə olunub</dt><dd className="font-semibold">{formatDate(data.createdAt)}</dd></div>
              {data.fileName && <div className="col-span-2"><dt className="text-muted">Fayl</dt><dd className="break-all font-semibold">{data.fileName}{data.fileSize ? ` · ${formatBytes(data.fileSize)}` : ''}</dd></div>}
            </dl>
            {data.description && <p className="mt-6 whitespace-pre-line leading-relaxed">{data.description}</p>}
            <div className="mt-8 flex flex-wrap gap-3">
              {action ? <a href={action.href} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand px-6 font-semibold text-brand-ink shadow-card hover:brightness-110">{action.download ? <Download className="size-4" aria-hidden /> : <ExternalLink className="size-4" aria-hidden />}{action.download ? 'Faylı endir' : 'Materialı aç'}</a> : <Badge tone="danger">{data.filePath ? 'Fayl əlçatan deyil' : 'Keçid təhlükəsiz deyil'}</Badge>}
              {saved.signedIn ? <Button variant="secondary" size="lg" onClick={() => saved.toggle(data.id)}>{saved.ids.has(data.id) ? 'Saxlanılanlardan çıxar' : 'Yadda saxla'}</Button> : <ButtonLink variant="secondary" size="lg" to="/login">Yadda saxlamaq üçün daxil ol</ButtonLink>}
            </div>
            <p className="mt-4 text-xs text-muted">{data.filePath ? 'Fayl saytın öz anbarından endirilir.' : 'Material xarici ünvanda açılır. Yalnız https:// ilə başlayan keçidlər göstərilir.'}</p>
          </>
        )}
    </article>
  );
}
