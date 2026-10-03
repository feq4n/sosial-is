import { useMemo } from 'react';
import { Clock, DoorOpen, UserRound } from 'lucide-react';
import { useAsync } from '@/hooks/useAsync';
import { useSeo } from '@/hooks/useSeo';
import { isSampleMode, scheduleApi } from '@/services/content';
import { Badge, Card, EmptyState, ErrorState, ListSkeleton, PageHeader, SampleNotice } from '@/components/ui';
import { jsDayToIso, lessonTypes, weekdays } from '@/utils/labels';
import type { ScheduleEntry } from '@/types';

export function WeekGrid({ entries, today, notes }: { entries: ScheduleEntry[]; today?: number; notes?: (day: number) => React.ReactNode }) {
  const byDay = useMemo(() => weekdays.map((_, i) => entries.filter((e) => e.day === i + 1)), [entries]);
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {byDay.map((list, i) => {
        const day = i + 1;
        if (!list.length && day > 5 && !notes) return null;
        return (
          <section key={day} aria-labelledby={`day-${day}`} className={`rounded-2xl border bg-surface p-4 shadow-card ${today === day ? 'border-brand ring-2 ring-brand/20' : 'border-line'}`}>
            <h2 id={`day-${day}`} className="flex items-center justify-between text-lg font-bold">{weekdays[i]}{today === day && <Badge tone="brand">Bu gün</Badge>}</h2>
            <ul className="mt-3 grid gap-2.5">
              {list.length === 0 && <li className="rounded-xl bg-surface-2 p-3 text-sm text-muted">Bu gün dərs yoxdur.</li>}
              {list.map((s) => (
                <li key={s.id} className="rounded-xl bg-surface-2 p-3">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-brand"><Clock className="size-3.5" aria-hidden />{s.startTime} – {s.endTime}</p>
                  <p className="mt-1 font-semibold">{s.subject}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <span className="inline-flex items-center gap-1"><UserRound className="size-3.5" aria-hidden />{s.teacher}</span>
                    <span className="inline-flex items-center gap-1"><DoorOpen className="size-3.5" aria-hidden />{s.room}</span>
                    <Badge>{lessonTypes[s.lessonType]}</Badge>
                  </p>
                </li>
              ))}
            </ul>
            {notes?.(day)}
          </section>
        );
      })}
    </div>
  );
}

export default function Schedule() {
  useSeo('Dərs cədvəli', 'Sosial iş şöbəsinin həftəlik dərs cədvəli: fənn, müəllim, auditoriya və saat.');
  const { data, loading, error, reload } = useAsync(() => scheduleApi.list(), []);
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <PageHeader title="Dərs cədvəli" text="Həftəlik dərs bölgüsü günlər üzrə qruplaşdırılıb." />
      {isSampleMode && <SampleNotice />}
      {loading ? <ListSkeleton rows={3} /> : error ? <ErrorState message={error} onRetry={reload} /> :
        data?.length ? <WeekGrid entries={data} today={jsDayToIso(new Date().getDay())} /> :
          <Card className="p-2"><EmptyState title="Cədvəl hələ əlavə olunmayıb" text="Dərs cədvəli administrator tərəfindən əlavə edildikdə burada görünəcək." /></Card>}
    </div>
  );
}
