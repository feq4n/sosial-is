import { Link } from 'react-router-dom';
import { BookOpen, CalendarDays, Mail, Megaphone, Users, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { useSeo } from '@/hooks/useSeo';
import { announcementsApi, eventsApi, materialsApi, scheduleApi } from '@/services/content';
import { listMessages, listUsers } from '@/services/users';
import { Card, ErrorState, PageHeader, Skeleton } from '@/components/ui';

export default function AdminOverview() {
  useSeo('İdarəetmə paneli', undefined, { noindex: true });
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const { data, loading, error, reload } = useAsync(async () => {
    const [a, m, e, s] = await Promise.all([announcementsApi.list({ includeDrafts: true }), materialsApi.list(), eventsApi.list(), scheduleApi.list()]);
    const [u, msgs] = isAdmin ? await Promise.all([listUsers(), listMessages()]) : [[], []];
    return { a, m, e, s, u, unread: msgs.filter((x) => x.status === 'new').length };
  }, [isAdmin]);

  const now = new Date().toISOString();
  const stats: { label: string; value: number; icon: LucideIcon; to: string; show?: boolean }[] = data ? [
    { label: 'Elan', value: data.a.length, icon: Megaphone, to: '/admin/announcements' },
    { label: 'Material', value: data.m.length, icon: BookOpen, to: '/admin/materials' },
    { label: 'Yaxın tədbir', value: data.e.filter((x) => x.startsAt >= now).length, icon: CalendarDays, to: '/admin/events' },
    { label: 'Dərs (cədvəldə)', value: data.s.length, icon: CalendarDays, to: '/admin/schedule' },
    { label: 'İstifadəçi', value: data.u.length, icon: Users, to: '/admin/users', show: isAdmin },
    { label: 'Oxunmamış mesaj', value: data.unread, icon: Mail, to: '/admin/messages', show: isAdmin },
  ] : [];

  return (
    <>
      <PageHeader title="İdarəetmə paneli" text="Saytın məzmunu və istifadəçilər üzrə ümumi göstəricilər." />
      {loading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.filter((s) => s.show !== false).map((s) => (
            <Link key={s.label} to={s.to} className="group"><Card className="p-5 transition group-hover:border-brand group-hover:shadow-pop">
              <s.icon className="size-6 text-brand" aria-hidden /><p className="mt-3 font-display text-4xl font-extrabold">{s.value}</p><p className="text-sm text-muted">{s.label}</p>
            </Card></Link>))}
        </div>
      )}
    </>
  );
}
