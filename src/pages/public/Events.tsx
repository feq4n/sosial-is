import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarCheck } from 'lucide-react';
import { useAsync } from '@/hooks/useAsync';
import { useSeo } from '@/hooks/useSeo';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import { eventsApi, isSampleMode } from '@/services/content';
import { cancelRegistration, isRegistered, registerForEvent } from '@/services/personal';
import { EventCard, MetaRow } from '@/components/cards';
import { Badge, Button, ButtonLink, EmptyState, ErrorState, ListSkeleton, PageHeader, SampleNotice, SelectField, Skeleton } from '@/components/ui';
import { eventCategories } from '@/utils/labels';
import { formatDateTime } from '@/utils/format';
import { friendlyError } from '@/utils/errors';
import type { EventCategory } from '@/types';

export function Events() {
  useSeo('Tədbirlər', 'ADPK ixtisaslarının seminar, konfrans və könüllülük tədbirləri.');
  const { data, loading, error, reload } = useAsync(() => eventsApi.list(), []);
  const [cat, setCat] = useState<'' | EventCategory>('');
  const [showPast, setShowPast] = useState(false);
  const now = new Date().toISOString();
  const { upcoming, past } = useMemo(() => {
    const f = (data ?? []).filter((e) => !cat || e.category === cat);
    return { upcoming: f.filter((e) => e.startsAt >= now), past: f.filter((e) => e.startsAt < now).reverse() };
  }, [data, cat, now]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <PageHeader title="Tədbirlər" text="Qarşıdan gələn seminar, konfrans və digər fəaliyyətlər." />
      {isSampleMode && <SampleNotice />}
      <div className="mb-6 max-w-xs"><SelectField label="Kateqoriya" value={cat} onChange={(e) => setCat(e.target.value as '' | EventCategory)}><option value="">Hamısı</option>{Object.entries(eventCategories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</SelectField></div>
      {loading ? <ListSkeleton /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <>
          {upcoming.length ? <div className="grid gap-4 md:grid-cols-2">{upcoming.map((e) => <EventCard key={e.id} e={e} />)}</div> :
            <EmptyState title="Yaxın tədbir yoxdur" text="Yeni tədbir əlavə olunduqda burada görünəcək." />}
          {past.length > 0 && (
            <div className="mt-10">
              <Button variant="ghost" onClick={() => setShowPast((s) => !s)} aria-expanded={showPast}>{showPast ? 'Keçmiş tədbirləri gizlət' : `Keçmiş tədbirlər (${past.length})`}</Button>
              {showPast && <div className="mt-4 grid gap-4 opacity-80 md:grid-cols-2">{past.map((e) => <EventCard key={e.id} e={e} />)}</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function EventDetail() {
  const { id = '' } = useParams();
  const { data, loading, error, reload } = useAsync(() => eventsApi.get(id), [id]);
  const { user, profile } = useAuth();
  const toast = useToast();
  const reg = useAsync(() => (user && data ? isRegistered(id, user.uid) : Promise.resolve(false)), [id, user?.uid, data?.id]);
  const [busy, setBusy] = useState(false);
  useSeo(data?.title ?? 'Tədbir', data?.description);
  const past = data ? data.startsAt < new Date().toISOString() : false;
  const registered = reg.data === true;

  const toggle = async () => {
    if (!user || !data) return;
    setBusy(true);
    try {
      if (registered) { await cancelRegistration(data.id, user.uid); toast.success('Qeydiyyat ləğv edildi'); }
      else { await registerForEvent(data.id, user.uid, profile ? `${profile.firstName} ${profile.lastName}` : user.email ?? '', user.email ?? ''); toast.success('Tədbirə qeydiyyatdan keçdiniz'); }
      reg.setData(!registered);
    } catch (e) { toast.error(friendlyError(e)); } finally { setBusy(false); }
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link to="/events" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"><ArrowLeft className="size-4" aria-hidden />Bütün tədbirlər</Link>
      {loading ? <div className="grid gap-3"><Skeleton className="h-8 w-3/4" /><Skeleton className="h-32" /></div> : error ? <ErrorState message={error} onRetry={reload} /> :
        !data ? <EmptyState title="Tədbir tapılmadı" action={<ButtonLink to="/events">Tədbirlərə qayıt</ButtonLink>} /> : (
          <>
            <Badge tone="brand">{eventCategories[data.category]}</Badge>
            <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">{data.title}</h1>
            <div className="mt-4 grid gap-1.5"><MetaRow icon="date">{formatDateTime(data.startsAt)}</MetaRow><MetaRow icon="place">{data.location}</MetaRow></div>
            <p className="mt-6 whitespace-pre-line leading-relaxed">{data.description}</p>
            <div className="mt-8">
              {past ? <Badge>Bu tədbir başa çatıb</Badge> : !data.registrationOpen ? <Badge>Bu tədbir üçün qeydiyyat tələb olunmur</Badge> :
                !user ? <ButtonLink to="/login" state={{ from: `/events/${data.id}` }} size="lg">Qeydiyyat üçün daxil ol</ButtonLink> :
                  <Button size="lg" variant={registered ? 'secondary' : 'primary'} loading={busy || reg.loading} onClick={toggle}><CalendarCheck className="size-5" aria-hidden />{registered ? 'Qeydiyyatı ləğv et' : 'Tədbirə qeydiyyatdan keç'}</Button>}
            </div>
          </>
        )}
    </article>
  );
}
