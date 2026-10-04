import { describe, expect, it } from 'vitest';
import { parseFields, rowToForm, toFormRow } from '@/services/forms';

describe('forms servisi: xəritələmə', () => {
  it('parseFields pozulmuş elementləri atır, seçim olmayan sualdan variantları silir', () => {
    const out = parseFields([
      { id: 'q1', type: 'text', label: 'Ad', required: true, options: ['x'] },
      { id: 'q2', type: 'radio', label: 'Seçim', options: ['a', 3, 'b'], help: 'izah' },
      { id: 'q3', type: 'yoxdur', label: 'X' },
      { type: 'text', label: 'açarsız' },
      null, 'mətn',
    ]);
    expect(out).toEqual([
      { id: 'q1', type: 'text', label: 'Ad', required: true },
      { id: 'q2', type: 'radio', label: 'Seçim', required: false, help: 'izah', options: ['a', 'b'] },
    ]);
    expect(parseFields('x')).toEqual([]);
  });

  it('rowToForm: auditoriya, son tarix və cavab sayı', () => {
    const f = rowToForm({
      id: 'u1', slug: 'abc123def456', title: 'Sorğu', description: null, status: 'published', closes_at: '2026-10-10T08:00:00+00:00',
      audience_mode: 'restricted', audience_specialties: ['Sİ'], audience_groups: [], fields: [], created_at: '2026-10-04T08:00:00+00:00',
      form_responses: [{ count: 7 }],
    });
    expect(f).toMatchObject({ id: 'u1', slug: 'abc123def456', status: 'published', description: '', responseCount: 7, audience: { mode: 'restricted', specialties: ['Sİ'], groups: [] } });
    expect(f.closesAt).toBe('2026-10-10T08:00:00.000Z');
  });

  it('rowToForm: naməlum status qaralama sayılır, cavab sayı yoxdursa sahə yoxdur', () => {
    const f = rowToForm({ id: 'u1', slug: 's', title: 'T', status: 'zzz', audience_mode: 'all', fields: [], created_at: '2026-10-04T08:00:00Z' });
    expect(f.status).toBe('draft');
    expect('responseCount' in f).toBe(false);
    expect(f.closesAt).toBeUndefined();
  });

  it('toFormRow: «hamı» auditoriyasında seçilmiş ixtisas/qrup yazılmır, mətn kəsilir, boş son tarix null olur', () => {
    const row = toFormRow({
      title: '  Sorğu  ', description: ' t ', status: 'draft', closesAt: '',
      audience: { mode: 'all', specialties: ['Sİ'], groups: ['Sİ26/01SB'] },
      fields: [{ id: 'q1', type: 'text', label: ' Ad ', required: false, options: ['x'] }],
    });
    expect(row).toEqual({
      title: 'Sorğu', description: 't', status: 'draft', closes_at: null,
      audience_mode: 'all', audience_specialties: [], audience_groups: [],
      fields: [{ id: 'q1', type: 'text', label: 'Ad', required: false }],
    });
  });
});
