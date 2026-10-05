import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const db = { result: { data: null as unknown, error: null as unknown, count: null as number | null }, calls: [] as [string, unknown[]][] };
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'insert', 'update', 'eq', 'order']) builder[m] = (...a: unknown[]) => { db.calls.push([m, a]); return builder; };
  builder.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(db.result).then(res, rej);
  return { db, supabase: { from: (t: string) => { db.calls.push(['from', [t]]); return builder; }, rpc: (n: string, a: unknown) => { db.calls.push(['rpc', [n, a]]); return builder; } } };
});

vi.mock('@/lib/supabase', () => ({ isConfigured: true, supabase: h.supabase, NotConfiguredError: class extends Error {} }));

const UUID = '8f14e45f-ceea-467f-a0e6-1f6b0a9a3c11';
const called = (m: string) => h.db.calls.filter(([n]) => n === m).map(([, a]) => a);

/* ------------------------------------------------------------------ yoxlama */
import { MESSAGE_MAX, SENDER_GROUP_MAX, SENDER_NAME_MAX, SUBJECT_MAX, validateStaffMessage, validateStaffMessageFields, validateStaffSender } from '@/lib/staffMessages';

describe('göndərən validation', () => {
  it('ad və qrup məcburidir; yalnız boşluq da boş sayılır', () => {
    expect(validateStaffSender('', '')).toEqual({ senderName: 'Ad və soyad boş ola bilməz', senderGroup: 'Qrup boş ola bilməz' });
    expect(validateStaffSender('   ', '   ')).toEqual({ senderName: 'Ad və soyad boş ola bilməz', senderGroup: 'Qrup boş ola bilməz' });
  });
  it('maksimum uzunluqlar tətbiq olunur', () => {
    expect(validateStaffSender('a'.repeat(SENDER_NAME_MAX + 1), 'Q').senderName).toMatch(/ən çox/);
    expect(validateStaffSender('Ad', 'a'.repeat(SENDER_GROUP_MAX + 1)).senderGroup).toMatch(/ən çox/);
    expect(validateStaffSender('a'.repeat(SENDER_NAME_MAX), 'a'.repeat(SENDER_GROUP_MAX))).toEqual({});
  });
  it('bütün sahələr birlikdə yoxlanılır, alıcı məcburidir', () => {
    expect(validateStaffMessageFields({ recipientId: '', senderName: '', senderGroup: '', subject: '', message: '' })).toEqual({
      recipient: 'Əməkdaşı seçin', senderName: 'Ad və soyad boş ola bilməz', senderGroup: 'Qrup boş ola bilməz', subject: 'Mövzu boş ola bilməz', message: 'Mesaj boş ola bilməz',
    });
    expect(validateStaffMessageFields({ recipientId: UUID, senderName: 'Fəqan Gəraylı', senderGroup: 'KŞATS 25/01', subject: 'Dərs cədvəli', message: 'Salam, sualım var.' })).toEqual({});
  });
});

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

  const draft = { recipientId: UUID, senderName: 'Fəqan Gəraylı', senderGroup: 'KŞATS 25/01', subject: 'Dərs cədvəli', message: 'Salam, dərs cədvəli ilə bağlı sualım var.' };

  it('göndərmə yalnız send_staff_message RPC-sini çağırır; sender_id, status və tarix müştəridən getmir; mətn kəsilir', async () => {
    const { sendStaffMessage } = await import('@/services/staffMessages');
    await sendStaffMessage({ ...draft, senderName: '  Fəqan   Gəraylı ', senderGroup: ' KŞATS 25/01 ', subject: '  Dərs cədvəli  ', message: '  Salam, dərs cədvəli ilə bağlı sualım var.  ' });
    expect(called('insert')).toHaveLength(0);
    expect(called('rpc')).toEqual([['send_staff_message', {
      p_recipient_id: UUID, p_subject: 'Dərs cədvəli', p_message: 'Salam, dərs cədvəli ilə bağlı sualım var.', p_sender_name: 'Fəqan Gəraylı', p_sender_group: 'KŞATS 25/01',
    }]]);
    const args = called('rpc')[0][1] as Record<string, unknown>;
    expect(Object.keys(args)).not.toContain('p_sender_id');
    expect(Object.keys(args)).not.toContain('p_status');
  });

  it.each([
    ['ad boşdur', { senderName: ' ' }],
    ['qrup boşdur', { senderGroup: '' }],
    ['mövzu boşdur', { subject: ' ' }],
    ['mesaj boşdur', { message: '' }],
    ['alıcı seçilməyib', { recipientId: '' }],
    ['ad çox uzundur', { senderName: 'a'.repeat(SENDER_NAME_MAX + 1) }],
    ['qrup çox uzundur', { senderGroup: 'a'.repeat(SENDER_GROUP_MAX + 1) }],
  ])('etibarsız məzmun bazaya getmir: %s', async (_, patch) => {
    const { sendStaffMessage } = await import('@/services/staffMessages');
    await expect(sendStaffMessage({ ...draft, ...patch })).rejects.toMatchObject({ message: 'invalid-message' });
    expect(called('rpc')).toHaveLength(0);
  });

  it('server xətası olduğu kimi atılır', async () => {
    const { sendStaffMessage } = await import('@/services/staffMessages');
    h.db.result = { data: null, error: { code: '23514', message: 'invalid-recipient' }, count: null };
    await expect(sendStaffMessage(draft)).rejects.toMatchObject({ message: 'invalid-recipient' });
  });

  it('sürət limiti xətası serverdən gəlir və istifadəçiyə aydın mesajla çatır', async () => {
    const { sendStaffMessage } = await import('@/services/staffMessages');
    const { friendlyError } = await import('@/utils/errors');
    h.db.result = { data: null, error: { code: '54000', message: 'message-rate-limit' }, count: null };
    const err = await sendStaffMessage(draft).catch((e: unknown) => e);
    expect(friendlyError(err)).toBe('Qısa müddətdə çox mesaj göndərdiniz. Bir az gözləyib yenidən cəhd edin.');
  });

  it('göndərilənlər sender_id, gələnlər recipient_id üzrə süzülür; sətirlər camelCase olur', async () => {
    const { listSentMessages, listInboxMessages } = await import('@/services/staffMessages');
    h.db.result = { data: [{ id: 'm1', sender_id: 's', recipient_id: 'r', subject: 'A', message: 'B', status: 'read', created_at: '2026-10-05T09:00:00Z', read_at: '2026-10-05T10:00:00Z', sender_name: 'S', sender_group: 'KŞATS 25/01', recipient_name: 'R' }], error: null, count: null };
    const sent = await listSentMessages('s');
    expect(called('eq')[0]).toEqual(['sender_id', 's']);
    expect(sent[0]).toMatchObject({ id: 'm1', senderName: 'S', senderGroup: 'KŞATS 25/01', recipientName: 'R', status: 'read', readAt: '2026-10-05T10:00:00.000Z' });
    h.db.calls = [];
    await listInboxMessages('r');
    expect(called('eq')[0]).toEqual(['recipient_id', 'r']);
  });

  it('qonaq mesajı (sender_id NULL) camelCase-ə çevrilir və senderId olmur', async () => {
    const { listInboxMessages } = await import('@/services/staffMessages');
    h.db.result = { data: [{ id: 'g1', sender_id: null, recipient_id: 'r', subject: 'Dərs cədvəli', message: 'Salam', status: 'sent', created_at: '2026-10-05T09:00:00Z', read_at: null, sender_name: 'Fəqan Gəraylı', sender_group: 'KŞATS 25/01', recipient_name: 'R' }], error: null, count: null };
    const [m] = await listInboxMessages('r');
    expect(m.senderId).toBeUndefined();
    expect(m).toMatchObject({ senderName: 'Fəqan Gəraylı', senderGroup: 'KŞATS 25/01', status: 'sent' });
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

