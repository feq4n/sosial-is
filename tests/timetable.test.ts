import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { courses, findGroup, groups, isValidPlacement, lessons, lessonsOfGroup, lessonView, shifts, specialties, specialtyLabel } from '@/data/timetable';

describe('rəsmi cədvəl məlumatı', () => {
  it('3 ixtisas, 29 qrup və hər iki növbə var', () => {
    expect(specialties.map((s) => s.code)).toEqual(['KŞATS', 'KŞŞİ', 'Sİ']);
    expect(groups).toHaveLength(29);
    expect(shifts).toEqual([1, 2]);
    expect(courses).toEqual(['H', 'I', 'II']);
    expect(groups.filter((g) => g.shift === 1)).toHaveLength(16);
    expect(groups.filter((g) => g.shift === 2)).toHaveLength(13);
  });

  it('kurs və növbə qrup kodundan təxmin edilmir, cədvəldən götürülür', () => {
    expect(findGroup('Sİ26/01SB')).toMatchObject({ specialty: 'Sİ', course: 'H', shift: 1 });
    expect(findGroup('Sİ25/01SB')).toMatchObject({ specialty: 'Sİ', course: 'I', shift: 2 });
    expect(findGroup('Sİ25/03SB')).toMatchObject({ specialty: 'Sİ', course: 'II', shift: 1 });
    expect(findGroup('KŞATS25/01SB')).toMatchObject({ course: 'I', shift: 2 });
    expect(findGroup('KŞATS25/02SB')).toMatchObject({ course: 'II', shift: 1 });
  });

  it('hər dərs mövcud qrupa bağlıdır, saatlar düzgündür və yerlər təkrarlanmır', () => {
    const codes = new Set(groups.map((g) => g.code));
    const seen = new Set<string>();
    for (const l of lessons) {
      expect(codes.has(l.group)).toBe(true);
      expect(l.start).toMatch(/^\d{2}:\d{2}$/);
      expect(l.end).toMatch(/^\d{2}:\d{2}$/);
      expect(l.day).toBeGreaterThanOrEqual(1);
      expect(l.day).toBeLessThanOrEqual(5);
      const key = `${l.group}|${l.day}|${l.lesson}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('növbələrə görə dərs saatları cədvəldəki kimidir', () => {
    const first = lessonsOfGroup('Sİ26/01SB');
    expect(first.find((l) => l.lesson === 1)).toMatchObject({ start: '09:00', end: '10:20' });
    expect(first.find((l) => l.lesson === 4)).toMatchObject({ start: '13:30', end: '14:50' });
    const second = lessonsOfGroup('Sİ25/01SB');
    expect(second.find((l) => l.lesson === 1)).toMatchObject({ start: '13:30', end: '14:50' });
    expect(second.find((l) => l.lesson === 3)).toMatchObject({ start: '16:30', end: '17:50' });
  });

  it('fənn, müəllim və otaq əlaqəsi saxlanılır', () => {
    expect(lessonsOfGroup('Sİ26/01SB').find((l) => l.day === 1 && l.lesson === 1)).toMatchObject({
      subject: 'Riyaziyyat', teacher: 'Qasımlı Əsmər', room: '129',
    });
    expect(lessonsOfGroup('KŞŞİ26/01SB').find((l) => l.day === 1 && l.lesson === 1)).toMatchObject({
      subject: 'Azərbaycan dili', teacher: 'Əsgərova İlahə', room: '122',
    });
  });

  it('“XXX” qeydləri real fənnlə əvəz edilmir', () => {
    const pending = lessons.filter((l) => l.pending);
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((l) => /^X+$/i.test(l.subject))).toBe(true);
    expect(lessonView(pending[0]).subject).toBe('Fənn hələ təyin olunmayıb');
    const mixed = lessons.find((l) => !l.pending && /\bX{2,}\b/i.test(l.subject));
    expect(mixed).toBeDefined();
    expect(lessonView(mixed!).subject).not.toMatch(/X{2,}/i);
  });

  it('boş xanalar uydurma məlumatla doldurulmur', () => {
    const l = lessonsOfGroup('KŞATS25/03SB').find((x) => x.day === 3 && x.lesson === 1);
    expect(l).toBeUndefined();
  });

  it('ixtisas və qrup əlaqəsi yoxlanılır, tam ad yalnız məlum olanda göstərilir', () => {
    expect(isValidPlacement('Sİ', 'Sİ26/01SB')).toBe(true);
    expect(isValidPlacement('KŞATS', 'Sİ26/01SB')).toBe(false);
    expect(isValidPlacement('Sİ', 'uydurma')).toBe(false);
    expect(specialtyLabel('Sİ')).toBe('Sosial iş (Sİ)');
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
    const bad = files.filter((f) => /universitet|bakalavr|magistr|doktorantura|fakültə|ADPU|Sosial İş Hub/i.test(readFileSync(f, 'utf-8')));
    expect(bad).toEqual([]);
  });
});
