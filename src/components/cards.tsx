import { Link } from 'react-router-dom';
import { Bookmark, BookmarkCheck, Calendar, ExternalLink, FileText, Film, Link2, MapPin, Presentation, Star } from 'lucide-react';
import type { Announcement, EventItem, Material, MaterialType } from '@/types';
import { announcementCategories, eventCategories, materialTypes } from '@/utils/labels';
import { dayAndMonth, formatDate, formatTime, isSafeHttpsUrl } from '@/utils/format';
import { Badge, Button, Card, cx } from './ui';

export function AnnouncementCard({ a }: { a: Announcement }) {
  return (
    <Link to={`/announcements/${a.id}`} className="group block">
      <Card className={cx('p-5 transition group-hover:-translate-y-0.5 group-hover:shadow-pop', a.important && 'border-accent/60 bg-accent-soft/40')}>
        <div className="flex flex-wrap items-center gap-2">
          {a.important && <Badge tone="accent"><Star className="size-3" aria-hidden />Vacib</Badge>}
          <Badge tone="brand">{announcementCategories[a.category]}</Badge>
          <time dateTime={a.createdAt} className="ml-auto text-xs text-muted">{formatDate(a.createdAt)}</time>
        </div>
        <h3 className="mt-3 text-lg font-bold group-hover:text-brand">{a.title}</h3>
        <p className="mt-1.5 line-clamp-2 text-sm text-muted">{a.summary}</p>
      </Card>
    </Link>
  );
}

export function EventCard({ e }: { e: EventItem }) {
  const { day, month } = dayAndMonth(e.startsAt);
  return (
    <Link to={`/events/${e.id}`} className="group block">
      <Card className="flex gap-4 p-4 transition group-hover:-translate-y-0.5 group-hover:shadow-pop">
        <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-brand text-brand-ink" aria-hidden>
          <div className="text-center leading-none"><div className="font-display text-2xl font-extrabold">{day}</div><div className="mt-1 text-xs">{month}</div></div>
        </div>
        <div className="min-w-0">
          <Badge tone="neutral">{eventCategories[e.category]}</Badge>
          <h3 className="mt-1.5 font-bold group-hover:text-brand">{e.title}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><MapPin className="size-3.5 shrink-0" aria-hidden /><span className="truncate">{e.location}</span> · {formatTime(e.startsAt)}</p>
        </div>
      </Card>
    </Link>
  );
}

const typeIcon: Record<MaterialType, typeof FileText> = { pdf: FileText, doc: FileText, ppt: Presentation, video: Film, link: Link2 };

export function MaterialCard({ m, saved, onToggle, signedIn }: { m: Material; saved?: boolean; onToggle?: () => void; signedIn?: boolean }) {
  const Icon = typeIcon[m.fileType];
  const safe = isSafeHttpsUrl(m.url);
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="size-5" aria-hidden /></div>
        <div className="min-w-0 flex-1">
          <Link to={`/materials/${m.id}`} className="font-bold leading-snug hover:text-brand">{m.title}</Link>
          <p className="mt-0.5 text-sm text-muted">{m.subject}</p>
        </div>
        {onToggle && signedIn && (
          <button onClick={onToggle} aria-pressed={saved} aria-label={saved ? 'Saxlanılanlardan çıxar' : 'Yadda saxla'}
            className={cx('rounded-lg p-2 transition hover:bg-surface-2', saved ? 'text-accent' : 'text-muted')}>
            {saved ? <BookmarkCheck className="size-5" /> : <Bookmark className="size-5" />}
          </button>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
        <Badge>{materialTypes[m.fileType]}</Badge>
        <span>{m.author}</span><span aria-hidden>·</span><time dateTime={m.createdAt}>{formatDate(m.createdAt)}</time>
      </div>
      {safe && (
        <a href={m.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
          <ExternalLink className="size-4" aria-hidden />Aç
        </a>
      )}
    </Card>
  );
}

export function MetaRow({ icon, children }: { icon: 'date' | 'place'; children: React.ReactNode }) {
  const I = icon === 'date' ? Calendar : MapPin;
  return <p className="flex items-center gap-2 text-sm text-muted"><I className="size-4 shrink-0" aria-hidden />{children}</p>;
}
export { Button };
