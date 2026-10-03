import { Link } from 'react-router-dom';
import { ArrowRight, Bell, CalendarDays, GraduationCap } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { useSeo } from '@/hooks/useSeo';
import { useNotifications } from '@/hooks/useNotifications';
import { announcementsApi, eventsApi, materialsApi, scheduleApi } from '@/services/content';
import { AnnouncementCard, EventCard, MaterialCard } from '@/components/cards';
import { Badge, Card, EmptyState, ErrorState, ListSkeleton, PageHeader } from '@/components/ui';
import { degreeLabels, jsDayToIso, weekdays } from '@/utils/labels';

export default function Overview() {
  useSeo('Kabinet', undefined, { noindex: true });
  const { profile, user } = useAuth();
  const n = useNotifications();
  const data = useAsync(async () => {
    const [a, e, m, s] = await Promise.all([announcementsApi.list(), eventsApi.list(), materialsApi.list(), scheduleApi.list()]);
    return { a: a.slice(0, 3), e: e.filter((x) => x.startsAt >= new Date().toISOString()).slice(0, 2), m: m.slice(0, 3), s };
  }, []);
  const day = jsDayToIso(new Date().getDay());
  const today = data.data?.s.filter((x) => x.day === day) ?? [];
  const next = today[0];

  return (
    <>
      <PageHeader title={`Xoş gəldiniz, ${profile?.firstName ?? 'tələbə'}!`} text="Bu gün üçün vacib olanlar bir yerdə." />
      {data.loading ? <ListSkeleton rows={3} /> : data.error ? <ErrorState message={data.error} onRetry={data.reload} /> : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-bold"><CalendarDays className="size-5 text-brand" aria-hidden />{weekdays[day - 1]}</h2><Link to="/dashboard/schedule" className="text-sm font-semibold text-brand hover:underline">Şəxsi cədvəl</Link></div>
            {today.length ? <ul className="mt-4 grid gap-2.5">{today.map((s) => <li key={s.id} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3"><span className="w-24 shrink-0 text-sm font-bold text-brand">{s.startTime} – {s.endTime}</span><span className="min-w-0 truncate font-semibold">{s.subject}</span><span className="ml-auto shrink-0 text-xs text-muted">{s.room}</span></li>)}</ul> :
              <p className="mt-4 rounded-xl bg-surface-2 p-4 text-sm text-muted">Bu gün üçün dərs görünmür.{next ? '' : ' Həftəlik cədvələ baxa bilərsiniz.'}</p>}
          </Card>
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold"><GraduationCap className="size-5 text-brand" aria-hidden />Profil xülasəsi</h2>
            <dl className="mt-4 grid gap-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted">Ad</dt><dd className="font-semibold">{profile?.firstName} {profile?.lastName}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">E-poçt</dt><dd className="truncate font-semibold">{user?.email}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Pillə</dt><dd className="font-semibold">{profile?.degree ? degreeLabels[profile.degree] : '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Kurs</dt><dd className="font-semibold">{profile?.course ?? '—'}</dd></div>
            </dl>
            <Link to="/dashboard/notifications" className="mt-4 flex items-center justify-between rounded-xl bg-brand-soft px-3 py-2.5 text-sm font-semibold text-brand"><span className="flex items-center gap-2"><Bell className="size-4" aria-hidden />Bildirişlər</span>{n.unread > 0 ? <Badge tone="accent">{n.unread} yeni</Badge> : <span className="text-muted">Yeni yoxdur</span>}</Link>
          </Card>

          <section className="lg:col-span-2"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Son elanlar</h2><Link className="text-sm font-semibold text-brand hover:underline" to="/announcements">Hamısı</Link></div>
            {data.data?.a.length ? <div className="grid gap-3">{data.data.a.map((a) => <AnnouncementCard key={a.id} a={a} />)}</div> : <EmptyState title="Hələ elan yoxdur" />}</section>
          <section><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Yaxın tədbirlər</h2><Link className="text-sm font-semibold text-brand hover:underline" to="/events">Hamısı</Link></div>
            {data.data?.e.length ? <div className="grid gap-3">{data.data.e.map((e) => <EventCard key={e.id} e={e} />)}</div> : <EmptyState title="Yaxın tədbir yoxdur" />}</section>
          <section className="lg:col-span-3"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Ən son materiallar</h2><Link className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline" to="/materials">Bütün materiallar <ArrowRight className="size-4" aria-hidden /></Link></div>
            {data.data?.m.length ? <div className="grid gap-3 md:grid-cols-3">{data.data.m.map((m) => <MaterialCard key={m.id} m={m} />)}</div> : <EmptyState title="Material hələ əlavə olunmayıb" />}</section>
        </div>
      )}
    </>
  );
}
