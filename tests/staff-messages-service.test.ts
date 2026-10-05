import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const db = { result: { data: null as unknown, error: null as unknown, count: null as number | null }, calls: [] as [string, unknown[]][] };
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'insert', 'update', 'eq', 'order']) builder[m] = (...a: unknown[]) => { db.calls.push([m, a]); return builder; };
  builder.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(db.result).then(res, rej);
  return { db, supabase: { from: (t: string) => { db.calls.push(['from', [t]]); return builder; } } };
});

vi.mock('@/lib/supabase', () => ({ isConfigured: true, supabase: h.supabase, NotConfiguredError: class extends Error {} }));

const UUID = '8f14e45f-ceea-467f-a0e6-1f6b0a9a3c11';
const called = (m: string) => h.db.calls.filter(([n]) => n === m).map(([, a]) => a);

/* ------------------------------------------------------------------ yoxlama */
import { MESSAGE_MAX, SUBJECT_MAX, validateStaffMessage } from '@/lib/staffMessages';

describe('mesaj validation', () => {
  it('boş mövzu və mesaj rədd edilir (yalnız boşluq da boşdur)', () => {
    expect(validateStaffMessage('', '')).toEqual({ subject: 'Mövzu boş ola bilməz', message: 'Mesaj boş ola bilməz' });
    expect(validateStaffMessage('   ', '   ').subject).toBeDefined();
  });
  it('maksimum uzunluqlar tətbiq olunur', () => {
    expect(validateStaffMessage('a'.repeat(SUBJECT_MAX + 1), 'Salam, necəsiniz?').subject).toMatch(/ən çox/);
    expect(validateStaffMessage('Mövzu', 'a'.repeat(MESSAGE_MAX + 1)).message).toMatch(/ən çox/);
  });
  it('düzgün dəyərlər xəta vermir', () => {
    expect(validateStaffMessage('Imtahan', 'Salam, sualım var.')).toEqual({});
  });
});

/* ------------------------------------------------------------------ servis */
describe('staffMessages servisi', () => {
  beforeEach(() => { h.db.calls = []; h.db.result = { data: null, error: null, count: null }; });

  it('göndərmə yalnız recipient_id, subject, message yazır (sender_id/status müştəridən getmir), mətn kəsilir', async () => {
    const { sendStaffMessage } = await import('@/services/staffMessages');
    await sendStaffMessage({ recipientId: UUID, subject: '  Mövzu  ', message: '  Mesaj mətni  ' });
    expect(called('from')[0]).toEqual(['staff_messages']);
    expect(called('insert')[0]).toEqual([{ recipient_id: UUID, subject: 'Mövzu', message: 'Mesaj mətni' }]);
  });

  it('etibarsız məzmun bazaya getmir', async () => {
    const { sendStaffMessage } = await import('@/services/staffMessages');
    await expect(sendStaffMessage({ recipientId: UUID, subject: ' ', message: 'Mesaj mətni' })).rejects.toMatchObject({ message: 'invalid-message' });
    expect(called('insert')).toHaveLength(0);
  });

  it('server xətası olduğu kimi atılır', async () => {
    const { sendStaffMessage } = await import('@/services/staffMessages');
    h.db.result = { data: null, error: { code: '23514', message: 'invalid-recipient' }, count: null };
    await expect(sendStaffMessage({ recipientId: UUID, subject: 'Mövzu', message: 'Mesaj mətni' })).rejects.toMatchObject({ message: 'invalid-recipient' });
  });

  it('göndərilənlər sender_id, gələnlər recipient_id üzrə süzülür; sətirlər camelCase olur', async () => {
    const { listSentMessages, listInboxMessages } = await import('@/services/staffMessages');
    h.db.result = { data: [{ id: 'm1', sender_id: 's', recipient_id: 'r', subject: 'A', message: 'B', status: 'read', created_at: '2026-10-05T09:00:00Z', read_at: '2026-10-05T10:00:00Z', sender_name: 'S', recipient_name: 'R' }], error: null, count: null };
    const sent = await listSentMessages('s');
    expect(called('eq')[0]).toEqual(['sender_id', 's']);
    expect(sent[0]).toMatchObject({ id: 'm1', senderName: 'S', recipientName: 'R', status: 'read', readAt: '2026-10-05T10:00:00.000Z' });
    h.db.calls = [];
    await listInboxMessages('r');
    expect(called('eq')[0]).toEqual(['recipient_id', 'r']);
  });

  it('oxundu işarələmə yalnız status-u göndərir (read_at serverdə təyin olunur)', async () => {
    const { markStaffMessageRead } = await import('@/services/staffMessages');
    h.db.result = { data: [{ id: 'm1', read_at: '2026-10-05T10:00:00Z' }], error: null, count: null };
    const r = await markStaffMessageRead('m1');
    expect(called('update')[0]).toEqual([{ status: 'read' }]);
    expect(r?.readAt).toBe('2026-10-05T10:00:00.000Z');
    h.db.result = { data: [], error: null, count: null };
    expect(await markStaffMessageRead('m1')).toBeNull();
  });

  it('oxunmamış say', async () => {
    const { countUnreadStaffMessages } = await import('@/services/staffMessages');
    h.db.result = { data: null, error: null, count: 3 };
    expect(await countUnreadStaffMessages('r')).toBe(3);
    expect(called('eq')).toEqual([['recipient_id', 'r'], ['status', 'sent']]);
  });
});

