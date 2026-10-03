import { Link } from 'react-router-dom';
import { Bell, CalendarClock, Megaphone } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useSeo } from '@/hooks/useSeo';
import { Badge, Button, Card, EmptyState, ErrorState, ListSkeleton, PageHeader, cx } from '@/components/ui';
import { formatDateTime } from '@/utils/format';

export default function Notifications() {
  useSeo('Bildirişlər', undefined, { noindex: true });
  const n = useNotifications();
  return (
    <>
      <PageHeader title="Bildirişlər" text="Yeni elanlar və yaxınlaşan tədbirlər barədə xatırlatmalar."
        actions={n.unread > 0 ? <Button variant="secondary" onClick={() => n.markRead(n.items.filter((i) => !i.read).map((i) => i.key))}>Hamısını oxunmuş et</Button> : undefined} />
      {n.loading ? <ListSkeleton rows={3} /> : n.error ? <ErrorState message={n.error} onRetry={n.reload} /> :
        n.items.length ? (
          <ul className="grid gap-3">
            {n.items.map((i) => (
              <li key={i.key}>
                <Card className={cx('flex items-start gap-4 p-4', !i.read && 'border-brand/50 bg-brand-soft/40')}>
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">{i.kind === 'announcement' ? <Megaphone className="size-5" aria-hidden /> : <CalendarClock className="size-5" aria-hidden />}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">{!i.read && <Badge tone="accent">Yeni</Badge>}<time dateTime={i.date} className="text-xs text-muted">{formatDateTime(i.date)}</time></div>
                    <Link to={i.href} onClick={() => !i.read && n.markRead([i.key])} className="mt-1 block font-bold hover:text-brand">{i.title}</Link>
                    <p className="line-clamp-2 text-sm text-muted">{i.text}</p>
                  </div>
                  {!i.read && <Button size="sm" variant="ghost" onClick={() => n.markRead([i.key])}>Oxundu</Button>}
                </Card>
              </li>
            ))}
          </ul>
        ) : <EmptyState icon={<Bell className="size-7" aria-hidden />} title="Bildiriş yoxdur" text="Yeni elan və ya yaxınlaşan tədbir olduqda burada görünəcək." />}
    </>
  );
}
