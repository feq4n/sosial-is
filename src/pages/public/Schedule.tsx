import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSeo } from '@/hooks/useSeo';
import { Badge, Button, Card, EmptyState, PageHeader, SelectField } from '@/components/ui';
import { TimetableGrid } from '@/components/TimetableGrid';
import {
  courseLabel, courses, dayFromJsDate, dayHeading, findGroup, groups, lessonsOfGroup, shiftLabel, shifts,
  specialties, specialtyLabel, timetable, timetableDays, type Group,
} from '@/data/timetable';

const KEYS = ['specialty', 'course', 'shift', 'group', 'day'] as const;
type Key = (typeof KEYS)[number];
type Filters = Record<Key, string>;

function GroupTitle({ g }: { g: Group }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-lg font-bold">{g.code}</span>
      <Badge tone="brand">{specialtyLabel(g.specialty)}</Badge>
      <Badge>Kurs: {g.course}</Badge>
      <Badge>{shiftLabel(g.shift)}</Badge>
    </span>
  );
}

export default function Schedule() {
  useSeo('Dərs cədvəli', 'Azərbaycan Dövlət Pedaqoji Kolleci üzrə rəsmi dərs cədvəli: ixtisas, qrup, kurs və növbəyə görə filtr.');
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const own = findGroup(profile?.group);
  const useOwn = !params.has('f') && own && own.specialty === profile?.specialty ? own : undefined;

  const filters: Filters = {
    specialty: params.get('specialty') ?? useOwn?.specialty ?? '',
    course: params.get('course') ?? '',
    shift: params.get('shift') ?? '',
    group: params.get('group') ?? useOwn?.code ?? '',
    day: params.get('day') ?? '',
  };

  const update = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    const g = findGroup(next.group);
    if (g && ((next.specialty && g.specialty !== next.specialty) || (next.course && g.course !== next.course) || (next.shift && String(g.shift) !== next.shift))) next.group = '';
    const out = new URLSearchParams({ f: '1' });
    for (const k of KEYS) if (next[k]) out.set(k, next[k]);
    setParams(out, { replace: true });
  };

  const groupOptions = useMemo(() => groups.filter((g) =>
    (!filters.specialty || g.specialty === filters.specialty)
    && (!filters.course || g.course === filters.course)
    && (!filters.shift || String(g.shift) === filters.shift)), [filters.specialty, filters.course, filters.shift]);
  const matched = groupOptions.filter((g) => !filters.group || g.code === filters.group);
  const days = filters.day ? [Number(filters.day)] : timetableDays.map((d) => d.no);
  const today = dayFromJsDate(new Date().getDay());
  const anyFilter = KEYS.some((k) => filters[k]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <PageHeader title="Dərs cədvəli" text={`${timetable.meta.academicYear} tədris ili, ${timetable.meta.semester} semestri. Rəsmi cədvəl üzrə günlər I gündən V günədək göstərilir.`} />
      <Card className="mb-6 p-4 sm:p-5">
        <form role="search" aria-label="Cədvəl filtrləri" onSubmit={(e) => e.preventDefault()} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SelectField label="İxtisas" value={filters.specialty} onChange={(e) => update({ specialty: e.target.value })}>
            <option value="">Hamısı</option>
            {specialties.map((s) => <option key={s.code} value={s.code}>{specialtyLabel(s.code)}</option>)}
          </SelectField>
          <SelectField label="Kurs" value={filters.course} onChange={(e) => update({ course: e.target.value })}>
            <option value="">Hamısı</option>
            {courses.map((c) => <option key={c} value={c}>{courseLabel(c)}</option>)}
          </SelectField>
          <SelectField label="Növbə" value={filters.shift} onChange={(e) => update({ shift: e.target.value })}>
            <option value="">Hamısı</option>
            {shifts.map((s) => <option key={s} value={s}>{shiftLabel(s)}</option>)}
          </SelectField>
          <SelectField label="Qrup" value={filters.group} onChange={(e) => update({ group: e.target.value })}>
            <option value="">Hamısı</option>
            {groupOptions.map((g) => <option key={g.code} value={g.code}>{g.code}</option>)}
          </SelectField>
          <SelectField label="Gün" value={filters.day} onChange={(e) => update({ day: e.target.value })}>
            <option value="">Bütün günlər</option>
            {timetableDays.map((d) => <option key={d.no} value={d.no}>{dayHeading(d.no)}</option>)}
          </SelectField>
        </form>
        {anyFilter && <div className="mt-3"><Button size="sm" variant="secondary" onClick={() => setParams(new URLSearchParams({ f: '1' }), { replace: true })}>Filtrləri sıfırla</Button></div>}
      </Card>

      {matched.length === 0 ? (
        <Card className="p-2"><EmptyState title="Uyğun qrup tapılmadı" text="Seçilmiş filtrlərə uyğun qrup yoxdur. Filtrləri dəyişin." /></Card>
      ) : matched.length === 1 ? (
        <section aria-label={`${matched[0].code} qrupunun cədvəli`}>
          <div className="mb-4"><GroupTitle g={matched[0]} /></div>
          <TimetableGrid lessons={lessonsOfGroup(matched[0].code)} days={days} today={today} idPrefix={`g-${matched[0].code}`} />
        </section>
      ) : (
        <div className="grid gap-3">
          <p className="text-sm text-muted">{matched.length} qrup tapıldı. Cədvəli görmək üçün qrupu açın və ya yuxarıdan qrup seçin.</p>
          {matched.map((g) => (
            <details key={g.code} className="group rounded-2xl border border-line bg-surface shadow-card">
              <summary className="cursor-pointer list-none rounded-2xl p-4 focus-visible:outline-2"><GroupTitle g={g} /></summary>
              <div className="border-t border-line p-4"><TimetableGrid lessons={lessonsOfGroup(g.code)} days={days} today={today} idPrefix={`g-${g.code}`} /></div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
