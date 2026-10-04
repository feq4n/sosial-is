import raw from './timetable.json';
import { findSpecialty } from '@/services/specialties';

/** Cədvəldəki ixtisas açarı. Ad/təsvir məlumatları src/data/specialties.ts-dədir (təkrar saxlanılmır). */
export interface Specialty { code: string }
/** Növbə (1 = I növbə, 2 = II növbə) rəsmi cədvəldən götürülür; kurs anlayışı saytda istifadə olunmur. */
export interface Group { code: string; specialty: string; shift: number }
export interface Lesson {
  group: string;
  day: number;
  lesson: number;
  start: string;
  end: string;
  subject: string;
  teacher: string | null;
  room: string | null;
  pending: boolean;
}
interface Timetable {
  meta: { academicYear: string; semester: string; source: string };
  specialties: Specialty[];
  groups: Group[];
  lessons: Lesson[];
}

export const timetable = raw as unknown as Timetable;
export const specialties = timetable.specialties;
export const groups = timetable.groups;
export const lessons = timetable.lessons;

export const shifts = [...new Set(groups.map((g) => g.shift))].sort((a, b) => a - b);

export const timetableDays = [
  { no: 1, label: 'I gün', weekday: 'Bazar ertəsi' },
  { no: 2, label: 'II gün', weekday: 'Çərşənbə axşamı' },
  { no: 3, label: 'III gün', weekday: 'Çərşənbə' },
  { no: 4, label: 'IV gün', weekday: 'Cümə axşamı' },
  { no: 5, label: 'V gün', weekday: 'Cümə' },
];

export const dayHeading = (no: number) => {
  const d = timetableDays.find((x) => x.no === no);
  return d ? `${d.label} · ${d.weekday}` : String(no);
};

export const dayFromJsDate = (jsDay: number): number | null => (jsDay >= 1 && jsDay <= 5 ? jsDay : null);

const groupIndex = new Map(groups.map((g) => [g.code, g]));
const lessonIndex = new Map<string, Lesson[]>();
for (const l of [...lessons].sort((a, b) => a.day - b.day || a.lesson - b.lesson)) {
  const list = lessonIndex.get(l.group);
  if (list) list.push(l); else lessonIndex.set(l.group, [l]);
}

export const findGroup = (code: string | undefined | null) => (code ? groupIndex.get(code) : undefined);
export const groupsOfSpecialty = (code: string) => groups.filter((g) => g.specialty === code);
export const lessonsOfGroup = (code: string | undefined | null) => (code ? lessonIndex.get(code) ?? [] : []);
export const isValidPlacement = (specialty: string, group: string) => findGroup(group)?.specialty === specialty;

/** Qısa ad (nişan, siyahı): Sosial İş, KŞATS, KŞŞİ. */
export const specialtyLabel = (code: string) => findSpecialty(code)?.name ?? code;
/** Seçim siyahıları üçün tam ad: “Kompüter Şəbəkəsi və Şəbəkə İnzibatçılığı (KŞŞİ)”. */
export const specialtyFullLabel = (code: string) => {
  const s = findSpecialty(code);
  return !s ? code : s.fullName === s.name ? s.name : `${s.fullName} (${s.name})`;
};
export const shiftLabel = (shift: number) => `${shift === 1 ? 'I' : 'II'} növbə`;

const clean = (value: string) => value.replace(/\bX{2,}\b/gi, '—').replace(/\s*\/\s*/g, ' / ').trim();

export function lessonView(l: Lesson) {
  if (l.pending) return { subject: 'Fənn hələ təyin olunmayıb', teacher: null as string | null, room: l.room };
  return { subject: clean(l.subject), teacher: l.teacher ? clean(l.teacher) : null, room: l.room };
}
