import { Clock, DoorOpen, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui';
import { dayHeading, lessonView, type Lesson } from '@/data/timetable';
import { weekdays } from '@/utils/labels';

export function LessonCard({ l }: { l: Lesson }) {
  const v = lessonView(l);
  return (
    <li className="rounded-xl bg-surface-2 p-3">
      <p className="flex items-center gap-1.5 text-sm font-bold text-brand">
        <Clock className="size-3.5" aria-hidden />{l.start} – {l.end}
        <span className="ml-auto text-xs font-medium text-muted">Dərs {l.lesson}</span>
      </p>
      <p className={`mt-1 font-semibold ${l.pending ? 'text-muted' : ''}`}>{v.subject}</p>
      {(v.teacher || v.room) && (
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          {v.teacher && <span className="inline-flex items-center gap-1"><UserRound className="size-3.5" aria-hidden />{v.teacher}</span>}
          {v.room && <span className="inline-flex items-center gap-1"><DoorOpen className="size-3.5" aria-hidden />Otaq {v.room}</span>}
        </p>
      )}
    </li>
  );
}

export function TimetableGrid({ lessons, days = [1, 2, 3, 4, 5], today, notes, idPrefix = 'day' }: {
  lessons: Lesson[];
  days?: number[];
  today?: number | null;
  notes?: (day: number) => React.ReactNode;
  idPrefix?: string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {days.map((day) => {
        const list = lessons.filter((l) => l.day === day);
        const heading = day <= 5 ? dayHeading(day) : weekdays[day - 1];
        return (
          <section key={day} aria-labelledby={`${idPrefix}-${day}`} className={`rounded-2xl border bg-surface p-4 shadow-card ${today === day ? 'border-brand ring-2 ring-brand/20' : 'border-line'}`}>
            <h3 id={`${idPrefix}-${day}`} className="flex items-center justify-between gap-2 text-lg font-bold">{heading}{today === day && <Badge tone="brand">Bu gün</Badge>}</h3>
            <ul className="mt-3 grid gap-2.5">
              {list.length === 0 && <li className="rounded-xl bg-surface-2 p-3 text-sm text-muted">Bu gün üçün cədvəldə dərs yoxdur.</li>}
              {list.map((l) => <LessonCard key={`${l.group}-${l.day}-${l.lesson}`} l={l} />)}
            </ul>
            {notes?.(day)}
          </section>
        );
      })}
    </div>
  );
}
