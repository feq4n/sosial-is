import { describe, expect, it } from 'vitest';
import {
  audienceLabel, audienceMatches, cleanAnswers, cleanField, csvCell, isClosed, newField, newFieldId, responsesToCsv, shareLink,
  summarize, validateAnswers, validateDefinition, type FormDraft, type FormField,
} from '@/lib/forms';

const f = (over: Partial<FormField> & Pick<FormField, 'id' | 'type'>): FormField => ({ label: `Sual ${over.id}`, required: false, ...over });
const draft = (over: Partial<FormDraft> = {}): FormDraft => ({
  title: 'Yay praktikası anketi', description: '', status: 'draft',
  audience: { mode: 'all', specialties: [], groups: [] },
  fields: [f({ id: 'q1', type: 'text' })], ...over,
});

describe('sual yaratma', () => {
  it('açar boş olan ilk qN-dir və təkrarlanmır', () => {
    expect(newFieldId([])).toBe('q1');
    expect(newFieldId([{ id: 'q1' }, { id: 'q2' }])).toBe('q3');
    expect(newFieldId([{ id: 'q2' }])).toBe('q1');
  });
  it('seçim sualı ilkin variantlarla yaranır, mətn sualı yox', () => {
    expect(newField('radio', []).options).toEqual(['Variant 1', 'Variant 2']);
    expect(newField('text', []).options).toBeUndefined();
  });
  it('cleanField mətni kəsir, boş variantları atır, seçim olmayan sualdan variantları silir', () => {
    expect(cleanField({ id: 'q1', type: 'radio', label: ' Ad ', required: true, help: '  ', options: [' a ', '', 'b'] }))
      .toEqual({ id: 'q1', type: 'radio', label: 'Ad', required: true, options: ['a', 'b'] });
    expect(cleanField({ id: 'q1', type: 'text', label: 'Ad', required: false, options: ['x'] })).toEqual({ id: 'q1', type: 'text', label: 'Ad', required: false });
  });
});

describe('validateDefinition', () => {
  it('düzgün təyin keçir', () => expect(validateDefinition(draft())).toBeNull());
  it('qısa başlıq rədd edilir', () => expect(validateDefinition(draft({ title: 'ab' }))).toMatch(/Başlıq/));
  it('dərc üçün ən azı bir sual lazımdır, qaralama boş ola bilər', () => {
    expect(validateDefinition(draft({ status: 'published', fields: [] }))).toMatch(/ən azı bir sual/);
    expect(validateDefinition(draft({ fields: [] }))).toBeNull();
  });
  it('boş «məhdud» auditoriya rədd edilir', () => {
    expect(validateDefinition(draft({ audience: { mode: 'restricted', specialties: [], groups: [] } }))).toMatch(/ən azı bir ixtisas/);
    expect(validateDefinition(draft({ audience: { mode: 'restricted', specialties: ['Sİ'], groups: [] } }))).toBeNull();
  });
  it('boş sual mətni, təkrar açar və pis variantlar rədd edilir', () => {
    expect(validateDefinition(draft({ fields: [f({ id: 'q1', type: 'text', label: '  ' })] }))).toMatch(/Sual 1: sual mətni/);
    expect(validateDefinition(draft({ fields: [f({ id: 'q1', type: 'text' }), f({ id: 'q1', type: 'text' })] }))).toMatch(/Sual 2: daxili açar/);
    expect(validateDefinition(draft({ fields: [f({ id: 'q1', type: 'radio', options: ['a'] })] }))).toMatch(/ən azı 2 variant/);
    expect(validateDefinition(draft({ fields: [f({ id: 'q1', type: 'radio', options: ['a', ' a '] })] }))).toMatch(/təkrarlanmamalıdır/);
    expect(validateDefinition(draft({ fields: [f({ id: 'Q 1', type: 'text' })] }))).toMatch(/daxili açar/);
  });
  it('61 sual rədd edilir', () => {
    const many = Array.from({ length: 61 }, (_, i) => f({ id: `q${i + 1}`, type: 'text' }));
    expect(validateDefinition(draft({ fields: many }))).toMatch(/ən çox 60/);
  });
});

describe('validateAnswers / cleanAnswers', () => {
  const fields: FormField[] = [
    f({ id: 'q1', type: 'text', required: true }),
    f({ id: 'q2', type: 'radio', options: ['Bəli', 'Xeyr'] }),
    f({ id: 'q3', type: 'checkbox', options: ['A', 'B'] }),
    f({ id: 'q4', type: 'scale' }),
    f({ id: 'q5', type: 'number' }),
    f({ id: 'q6', type: 'date' }),
    f({ id: 'q7', type: 'email' }),
  ];
  it('məcburi sual boşdursa xəta var, boşluq da boş sayılır', () => {
    expect(validateAnswers(fields, {})).toEqual({ q1: 'Bu sual məcburidir.' });
    expect(validateAnswers(fields, { q1: '   ' })).toHaveProperty('q1');
  });
  it('düzgün cavablar xətasızdır', () => {
    expect(validateAnswers(fields, { q1: 'Aysel', q2: 'Bəli', q3: ['A'], q4: 5, q5: '12,5', q6: '2026-10-04', q7: 'a@b.az' })).toEqual({});
  });
  it('variantdan kənar, yanlış tarix, e-poçt, qiymət və ədəd rədd edilir', () => {
    const errs = validateAnswers(fields, { q1: 'x', q2: 'Ola bilər', q3: ['Z'], q4: 6, q5: 'abc', q6: '2026-02-30', q7: 'abc' });
    expect(Object.keys(errs).sort()).toEqual(['q2', 'q3', 'q4', 'q5', 'q6', 'q7']);
  });
  it('çox uzun mətn rədd edilir', () => {
    expect(validateAnswers([f({ id: 'q1', type: 'text' })], { q1: 'a'.repeat(501) })).toHaveProperty('q1');
    expect(validateAnswers([f({ id: 'q1', type: 'textarea' })], { q1: 'a'.repeat(4000) })).toEqual({});
  });
  it('cleanAnswers boşları və təyində olmayan açarları atır, tipləri çevirir', () => {
    const out = cleanAnswers(fields, { q1: '  Aysel ', q2: '', q3: ['A', 'B'], q4: 3, q5: '12,5', q6: '2026-10-04', zzz: 'x' } as never);
    expect(out).toEqual({ q1: 'Aysel', q3: ['A', 'B'], q4: 3, q5: 12.5, q6: '2026-10-04' });
  });
});

describe('vaxt və auditoriya', () => {
  const now = Date.parse('2026-10-04T12:00:00Z');
  it('isClosed', () => {
    expect(isClosed({ status: 'published' }, now)).toBe(false);
    expect(isClosed({ status: 'closed' }, now)).toBe(true);
    expect(isClosed({ status: 'published', closesAt: '2026-10-04T11:59:00Z' }, now)).toBe(true);
    expect(isClosed({ status: 'published', closesAt: '2026-10-05T00:00:00Z' }, now)).toBe(false);
  });
  it('audienceMatches: ixtisas, qrup və ixtisassız tələbə', () => {
    const a = { mode: 'restricted' as const, specialties: ['Sİ'], groups: ['KŞŞİ25/01SB'] };
    expect(audienceMatches({ mode: 'all', specialties: [], groups: [] }, null)).toBe(true);
    expect(audienceMatches(a, { specialty: 'Sİ', group: 'Sİ26/01SB' })).toBe(true);
    expect(audienceMatches(a, { specialty: 'KŞŞİ', group: 'KŞŞİ25/01SB' })).toBe(true);
    expect(audienceMatches(a, { specialty: 'KŞŞİ', group: 'KŞŞİ25/02SB' })).toBe(false);
    expect(audienceMatches(a, {})).toBe(false);
    expect(audienceMatches(a, null)).toBe(false);
  });
  it('audienceLabel və shareLink', () => {
    expect(audienceLabel({ mode: 'all', specialties: [], groups: [] })).toBe('Bütün tələbələr');
    expect(audienceLabel({ mode: 'restricted', specialties: ['Sİ'], groups: ['KŞŞİ25/01SB'] })).toBe('Sİ, KŞŞİ25/01SB');
    expect(shareLink('abc123def456', 'https://sosial.example.az')).toBe('https://sosial.example.az/f/abc123def456');
  });
});

describe('CSV', () => {
  it('Excel düstur inyeksiyasına qarşı mətnin əvvəlinə apostrof qoyur, dırnağı ikiləşdirir', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe(`"'+1"`);
    expect(csvCell('@a')).toBe(`"'@a"`);
    expect(csvCell('-5', false)).toBe('"-5"');
    expect(csvCell('salam')).toBe('"salam"');
  });
  it('BOM + ; ayırıcı + sütun sırası; mənfi ədəd dəyişmir, mətn qorunur', () => {
    const fields = [f({ id: 'q1', type: 'text', label: 'Ad' }), f({ id: 'q2', type: 'number', label: 'Say' }), f({ id: 'q3', type: 'checkbox', label: 'Seç', options: ['A', 'B'] })];
    const csv = responsesToCsv(fields, [
      { id: '1', submittedAt: '2026-10-04T10:00:00Z', answers: { q1: '=cmd|x', q2: -5, q3: ['A', 'B'] }, respondentName: 'Aysel Məmmədova', respondentEmail: 'aysel@example.az', respondentKind: 'student' },
      { id: '2', submittedAt: '2026-10-04T11:00:00Z', answers: { q1: 'Əli; "Vəli"' }, respondentName: '=SUM(A1)', respondentEmail: 'x@example.az', respondentKind: 'student' },
      { id: '3', submittedAt: '2026-10-04T12:00:00Z', answers: { q1: 'Köhnə' } },
    ]);
    expect(csv.startsWith('\ufeff"№";"Tarix";"Ad soyad";"E-poçt";"Növ";"Ad";"Say";"Seç"\r\n')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines).toHaveLength(4);
    expect(lines[1].split(';').slice(2)).toEqual(['"Aysel Məmmədova"', '"aysel@example.az"', '"Qeydiyyatlı"', `"'=cmd|x"`, '"-5"', '"A, B"']);
    expect(lines[2].split(';')[2]).toBe(`"'=SUM(A1)"`); // ad xanası da düstur inyeksiyasına qarşı qorunur
    expect(lines[2].split(';')[4]).toBe('"Qeydiyyatlı"');
    expect(lines[2]).toContain('"Əli; ""Vəli"""');
    expect(lines[3].split(';').slice(2, 5)).toEqual(['""', '""', '"Anonim"']); // qonaq/köhnə cavab: kimlik yoxdur
  });
  it('vaxt dəqiqə dəqiqliyi ilə yazılır (artıq saata yuvarlaqlaşdırılmır)', () => {
    const csv = responsesToCsv([f({ id: 'q1', type: 'text', label: 'Ad' })], [{ id: '1', submittedAt: new Date(2026, 9, 4, 10, 37).toISOString(), answers: {} }]);
    expect(csv).toContain('2026-10-04 10:37');
  });
});

describe('summarize', () => {
  it('seçim sayğacı, qiymət ortası və digər suallar', () => {
    const fields = [
      f({ id: 'q1', type: 'radio', options: ['Bəli', 'Xeyr'] }),
      f({ id: 'q2', type: 'checkbox', options: ['A', 'B'] }),
      f({ id: 'q3', type: 'scale' }),
      f({ id: 'q4', type: 'text' }),
    ];
    const rows = [
      { id: '1', submittedAt: '', answers: { q1: 'Bəli', q2: ['A', 'B'], q3: 5, q4: 'x' } },
      { id: '2', submittedAt: '', answers: { q1: 'Bəli', q2: ['A'], q3: 4 } },
      { id: '3', submittedAt: '', answers: { q1: 'Xeyr' } },
    ];
    const [radio, check, scale, text] = summarize(fields, rows);
    expect(radio).toMatchObject({ kind: 'choice', total: 3, counts: [{ label: 'Bəli', count: 2 }, { label: 'Xeyr', count: 1 }] });
    expect(check).toMatchObject({ kind: 'choice', total: 2, counts: [{ label: 'A', count: 2 }, { label: 'B', count: 1 }] });
    expect(scale).toMatchObject({ kind: 'scale', total: 2, average: 4.5 });
    expect(text).toMatchObject({ kind: 'other', total: 1 });
  });
});
