import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { findGroup, groupBySlot, groups, isValidPlacement, lessons, lessonsOfGroup, lessonView, shifts, specialties, specialtyLabel, variantLabel, type Lesson } from '@/data/timetable';

describe('rəsmi cədvəl məlumatı', () => {
  it('3 ixtisas, 29 qrup və hər iki növbə var', () => {
    expect(specialties.map((s) => s.code)).toEqual(['KŞATS', 'KŞŞİ', 'Sİ']);
    expect(groups).toHaveLength(29);
    expect(shifts).toEqual([1, 2]);
    expect(groups.filter((g) => g.shift === 1)).toHaveLength(16);
    expect(groups.filter((g) => g.shift === 2)).toHaveLength(13);
  });

  it('növbə qrup kodundan təxmin edilmir, cədvəldən götürülür', () => {
    expect(findGroup('Sİ26/01SB')).toMatchObject({ specialty: 'Sİ', shift: 1 });
    expect(findGroup('Sİ25/01SB')).toMatchObject({ specialty: 'Sİ', shift: 2 });
    expect(findGroup('Sİ25/03SB')).toMatchObject({ specialty: 'Sİ', shift: 1 });
    expect(findGroup('KŞATS25/01SB')).toMatchObject({ shift: 2 });
    expect(findGroup('KŞATS25/02SB')).toMatchObject({ shift: 1 });
  });

  it('hər dərs mövcud qrupa bağlıdır, saatlar düzgündür və yerlər təkrarlanmır', () => {
    const codes = new Set(groups.map((g) => g.code));
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const l of lessons) {
      expect(codes.has(l.group)).toBe(true);
      expect(l.start).toMatch(/^\d{2}:\d{2}$/);
      expect(l.end).toMatch(/^\d{2}:\d{2}$/);
      expect(l.day).toBeGreaterThanOrEqual(1);
      expect(l.day).toBeLessThanOrEqual(5);
      const key = `${l.group}|${l.day}|${l.lesson}|${l.week}|${l.subgroup ?? 0}`;
      if (seen.has(key)) dupes.push(key);
      seen.add(key);
    }
    // Mənbədəki yeganə təkrar yer (aşağıdakı ziddiyyət testi); yeni təkrar yaranarsa test xəbər verir.
    expect(dupes).toEqual(['KŞŞİ24/02SB|1|1|all|0']);
  });

  it('növbələrə görə dərs saatları cədvəldəki kimidir', () => {
    const first = lessonsOfGroup('Sİ26/01SB');
    expect(first.find((l) => l.lesson === 1)).toMatchObject({ start: '09:00', end: '10:20' });
    expect(first.find((l) => l.lesson === 4)).toMatchObject({ start: '13:30', end: '14:50' });
    const second = lessonsOfGroup('Sİ25/01SB');
    expect(second.find((l) => l.lesson === 1)).toMatchObject({ start: '13:30', end: '14:50' });
    expect(second.find((l) => l.lesson === 3)).toMatchObject({ start: '16:30', end: '17:50' });
  });

  it('fənn, növ, müəllim və otaq əlaqəsi saxlanılır', () => {
    expect(lessonsOfGroup('Sİ26/01SB').find((l) => l.day === 1 && l.lesson === 1)).toMatchObject({
      subject: 'Biologiya', kind: 'Seminar', teacher: 'Yaqut Salahova', room: '110', week: 'all', subgroup: null,
    });
    expect(lessonsOfGroup('KŞŞİ26/01SB').find((l) => l.day === 1 && l.lesson === 1)).toMatchObject({
      subject: 'Azərbaycan dili', kind: 'Seminar', teacher: 'İlahə Əsgərova', room: '221',
    });
    expect(lessonsOfGroup('KŞATS25/01SB').find((l) => l.day === 1 && l.lesson === 2)).toMatchObject({ kind: 'Praktika', subject: 'Əməliyyat sistemləri' });
  });

  it('cədvəldə 400 dərs sətri var və növ/həftə/yarımqrup dəyərləri etibarlıdır', () => {
    expect(lessons).toHaveLength(400);
    expect(lessons.every((l) => ['Mühazirə', 'Seminar', 'Praktika'].includes(l.kind))).toBe(true);
    expect(lessons.every((l) => ['all', 'upper', 'lower'].includes(l.week))).toBe(true);
    expect(lessons.every((l) => l.subgroup === null || l.subgroup === 1 || l.subgroup === 2)).toBe(true);
    expect(lessons.filter((l) => l.week === 'upper')).toHaveLength(34);
    expect(lessons.filter((l) => l.week === 'lower')).toHaveLength(31);
    expect(lessons.filter((l) => l.subgroup !== null)).toHaveLength(34);
  });

  it('üst/alt həftə və yarımqrup variantları bir dərs yerində birlikdə qalır', () => {
    const slot = groupBySlot(lessonsOfGroup('Sİ25/01SB').filter((l) => l.day === 4)).find((items) => items[0].lesson === 1)!;
    expect(slot.map((l) => [l.week, l.subject])).toEqual([['upper', 'Psixologiya'], ['lower', 'Uşaq və yeniyetmələrlə sosial iş']]);
    expect(variantLabel(slot[0])).toBe('Üst həftə');
    const halves = groupBySlot(lessonsOfGroup('KŞŞİ26/01SB').filter((l) => l.day === 1)).find((items) => items[0].lesson === 2)!;
    expect(halves.map((l) => [l.subgroup, l.teacher])).toEqual([[1, 'Natiqə Abdüləzizova'], [2, 'İnarə Cəfərova']]);
    expect(variantLabel(halves[1])).toBe('2-ci yarımqrup');
    expect(variantLabel(lessonsOfGroup('Sİ26/01SB')[0])).toBeNull();
  });

  it('“XXX” qeydləri real fənnlə əvəz edilmir (cari cədvəldə belə qeyd yoxdur)', () => {
    expect(lessons.filter((l) => l.pending)).toHaveLength(0);
    const placeholder: Lesson = { ...lessons[0], subject: 'XXX', teacher: null, pending: true };
    expect(lessonView(placeholder).subject).toBe('Fənn hələ təyin olunmayıb');
    const mixed: Lesson = { ...lessons[0], subject: 'Fizika / XXX', pending: false };
    expect(lessonView(mixed).subject).not.toMatch(/X{2,}/i);
  });

  it('boş xanalar uydurma məlumatla doldurulmur', () => {
    // KŞATS25/03SB cədvəldə yalnız I–III dərs yerlərinə malikdir: IV dərs uydurulmur.
    expect(lessonsOfGroup('KŞATS25/03SB').find((x) => x.lesson === 4)).toBeUndefined();
    // Sİ24/01SB bazar ertəsi yalnız I dərs: II və III dərs yeri boş qalır.
    expect(lessonsOfGroup('Sİ24/01SB').filter((x) => x.day === 1).map((x) => x.lesson)).toEqual([1]);
  });

  it('mənbədəki bir ziddiyyət olduğu kimi saxlanılır: KŞŞİ24/02SB I gün I dərs yerində iki dərs', () => {
    const both = lessonsOfGroup('KŞŞİ24/02SB').filter((x) => x.day === 1 && x.lesson === 1);
    expect(both.map((x) => x.subject).sort()).toEqual(['Kompüter şəbəkələrinin idarəedilməsinin təşkili', 'Python proqramlaşdırma dili']);
  });

  it('ixtisas və qrup əlaqəsi yoxlanılır, tam ad yalnız məlum olanda göstərilir', () => {
    expect(isValidPlacement('Sİ', 'Sİ26/01SB')).toBe(true);
    expect(isValidPlacement('KŞATS', 'Sİ26/01SB')).toBe(false);
    expect(isValidPlacement('Sİ', 'uydurma')).toBe(false);
    expect(specialtyLabel('Sİ')).toBe('Sosial İş');
    expect(specialtyLabel('KŞATS')).toBe('KŞATS');
    expect(specialtyLabel('KŞŞİ')).toBe('KŞŞİ');
  });
});

describe('Supabase qrup siyahısı uyğunluğu', () => {
  const pairsOf = (sql: string) => {
    const block = sql.slice(sql.indexOf('values'), sql.indexOf(') as v'));
    return Object.fromEntries([...block.matchAll(/\('([^']+)', '([^']+)'\)/g)].map((m) => [m[1], m[2]]));
  };
  const expected = Object.fromEntries(groups.map((g) => [g.code, g.specialty]));

  it('supabase/seed/groups.sql cədvəl məlumatı ilə üst-üstə düşür (skript yenidən işlədilməlidir)', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/seed/groups.sql'), 'utf-8');
    expect(pairsOf(sql)).toEqual(expected);
  });

  it('ADPK miqrasiyasındakı ilkin qrup siyahısı seed ilə eynidir', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20261004000001_adpk_placement.sql'), 'utf-8');
    expect(pairsOf(sql)).toEqual(expected);
  });
});

describe('universitetə aid qalıqlar', () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
  it('mənbə kodunda universitet terminləri yoxdur', () => {
    const files = walk(join(process.cwd(), 'src')).filter((f) => /\.(ts|tsx|json|css)$/.test(f));
    const bad = files.filter((f) => /universitet|(?<!sub)bakalavr|magistr|doktorantura|fakültə|ADPU|Sosial İş Hub/i.test(readFileSync(f, 'utf-8')));
    expect(bad).toEqual([]);
  });
});
