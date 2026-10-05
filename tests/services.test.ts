import { beforeEach, describe, expect, it, vi } from 'vitest';

// Supabase klienti saxta zəncirvari builder ilə əvəz olunur: hansı sorğuların qurulduğunu və
// cavabların necə çevrildiyini yoxlayırıq (real şəbəkə sorğusu yoxdur).
const h = vi.hoisted(() => {
  const state = { result: { data: null as unknown, error: null as unknown }, calls: [] as [string, unknown[]][], table: '' };
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'order']) {
    builder[m] = (...args: unknown[]) => { state.calls.push([m, args]); return builder; };
  }
  builder.single = () => { state.calls.push(['single', []]); return Promise.resolve(state.result); };
  builder.maybeSingle = () => { state.calls.push(['maybeSingle', []]); return Promise.resolve(state.result); };
  builder.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(state.result).then(res, rej);
  const supabase = { from: (t: string) => { state.table = t; state.calls.push(['from', [t]]); return builder; } };
  return { state, supabase };
});

vi.mock('@/lib/supabase', () => ({
  isConfigured: true,
  supabase: h.supabase,
  NotConfiguredError: class extends Error {},
}));

import { announcementsApi, eventsApi } from '@/services/content';
import { fromRow, toRow, isUuid } from '@/services/db';
import { toProfile } from '@/services/profiles';
import { setUserRole, listMessages } from '@/services/users';
import { saveMaterial, markRead, isRegistered } from '@/services/personal';
import { updateOwnProfile } from '@/services/profiles';

const UUID = '8f14e45f-ceea-467f-a0e6-1f6b0a9a3c11';
const called = (m: string) => h.state.calls.filter(([n]) => n === m).map(([, a]) => a);

beforeEach(() => { h.state.calls = []; h.state.result = { data: null, error: null }; });

describe('sətir çevirmələri', () => {
  it('snake_case → camelCase, null buraxılır, tarixlər ISO olur, firebase_id gizlədilir', () => {
    const o = fromRow<Record<string, unknown>>(
      { id: UUID, starts_at: '2026-10-05T09:00:00+00:00', ends_at: null, registration_open: true, firebase_id: 'abc' }, ['startsAt', 'endsAt'],
    );
    expect(o).toEqual({ id: UUID, startsAt: '2026-10-05T09:00:00.000Z', registrationOpen: true });
  });

  it('camelCase → snake_case; id, createdAt, undefined və boş tarix yazılmır', () => {
    const r = toRow({ id: 'x', createdAt: 'x', title: 'T', registrationOpen: true, startsAt: '2026-10-05T09:00:00Z', endsAt: '', extra: undefined }, ['startsAt', 'endsAt']);
    expect(r).toEqual({ title: 'T', registration_open: true, starts_at: '2026-10-05T09:00:00.000Z' });
  });

  it('UUID yoxlaması', () => {
    expect(isUuid(UUID)).toBe(true);
    expect(isUuid('yoxdur')).toBe(false);
    expect(isUuid('sample-a1')).toBe(false);
  });

  it('profiles sətri UserProfile-a çevrilir (id→uid, group_name→group, specialty)', () => {
    const p = toProfile({ id: UUID, first_name: 'Aysel', last_name: 'M', email: 'a@b.az', role: 'admin', student_id: 'S-1', course: 2, specialty: 'Sİ', group_name: 'Sİ26/01SB', created_at: '2026-01-02T03:04:05Z', updated_at: null, firebase_uid: 'fb' });
    expect(p).toMatchObject({ uid: UUID, firstName: 'Aysel', lastName: 'M', role: 'admin', specialty: 'Sİ', group: 'Sİ26/01SB', createdAt: '2026-01-02T03:04:05.000Z' });
    expect(p).not.toHaveProperty('studentId');
    expect(p).not.toHaveProperty('course');
    expect(p).not.toHaveProperty('id');
  });
});

describe('məzmun repository-si', () => {
  it('elanlar: ictimai siyahı published=true süzgəci ilə sorğulanır, yeni → köhnə sıralanır', async () => {
    h.state.result = { data: [
      { id: '1', title: 'Köhnə', created_at: '2026-01-01T00:00:00Z', published: true },
      { id: '2', title: 'Yeni', created_at: '2026-03-01T00:00:00Z', published: true },
    ], error: null };
    const list = await announcementsApi.list();
    expect(list.map((a) => a.title)).toEqual(['Yeni', 'Köhnə']);
    expect(called('eq')).toContainEqual(['published', true]);
    expect(h.state.table).toBe('announcements');
  });

  it('elanlar: admin qaralamaları da istəyəndə süzgəc tətbiq olunmur', async () => {
    h.state.result = { data: [], error: null };
    await announcementsApi.list({ includeDrafts: true });
    expect(called('eq')).toHaveLength(0);
  });

  it('get: etibarsız id üçün sorğu göndərmir, null qaytarır (olmayan səhifə boş vəziyyət göstərsin)', async () => {
    expect(await eventsApi.get('yoxdur')).toBeNull();
    expect(h.state.calls).toHaveLength(0);
  });

  it('get: tapılmayanda null qaytarır', async () => {
    h.state.result = { data: null, error: null };
    expect(await eventsApi.get(UUID)).toBeNull();
  });

  it('create: snake_case payload göndərir, createdAt/id göndərmir və yeni id qaytarır', async () => {
    h.state.result = { data: { id: UUID }, error: null };
    const id = await eventsApi.create({ title: 'Seminar', description: '', category: 'seminar', location: 'Zal', startsAt: '2026-10-05T09:00:00.000Z', registrationOpen: true, createdAt: 'x' });
    expect(id).toBe(UUID);
    const payload = called('insert')[0][0] as Record<string, unknown>;
    expect(payload).toMatchObject({ title: 'Seminar', starts_at: '2026-10-05T09:00:00.000Z', registration_open: true });
    expect(payload).not.toHaveProperty('created_at');
    expect(payload).not.toHaveProperty('id');
  });

  it('update/remove: RLS səbəbilə heç bir sətir dəyişməyibsə səssiz uğur əvəzinə xəta atır', async () => {
    h.state.result = { data: [], error: null };
    await expect(announcementsApi.update(UUID, { title: 'Yeni başlıq' })).rejects.toMatchObject({ code: 'no-rows' });
    await expect(announcementsApi.remove(UUID)).rejects.toMatchObject({ code: 'no-rows' });
    h.state.result = { data: [{ id: UUID }], error: null };
    await expect(announcementsApi.remove(UUID)).resolves.toBeUndefined();
  });

  it('Postgres xətası olduğu kimi (kodu ilə) atılır', async () => {
    h.state.result = { data: null, error: { code: '42501', message: 'rls' } };
    await expect(announcementsApi.list()).rejects.toMatchObject({ code: '42501' });
  });
});

describe('istifadəçi və mesaj əməliyyatları', () => {
  it('setUserRole yalnız role sütununu yeniləyir; sətir yoxdursa xəta verir', async () => {
    h.state.result = { data: [{ id: UUID }], error: null };
    await setUserRole(UUID, 'editor');
    expect(called('update')[0][0]).toEqual({ role: 'editor' });
    h.state.result = { data: [], error: null };
    await expect(setUserRole(UUID, 'admin')).rejects.toMatchObject({ code: 'no-rows' });
  });

  it('listMessages tarixləri ISO-ya çevirir', async () => {
    h.state.result = { data: [{ id: '1', name: 'A', email: 'a@b.az', subject: 'S', message: 'M', status: 'new', created_at: '2026-02-03T04:05:06+00:00' }], error: null };
    const [m] = await listMessages();
    expect(m).toMatchObject({ id: '1', status: 'new', createdAt: '2026-02-03T04:05:06.000Z' });
  });
});

describe('profil yeniləməsi', () => {
  it('ixtisas və qrup birlikdə göndərilir, köhnə degree/course heç vaxt göndərilmir', async () => {
    h.state.result = { data: { id: UUID, first_name: 'A', last_name: 'B', email: 'a@b.az', role: 'student', specialty: 'Sİ', group_name: 'Sİ26/01SB', created_at: '2026-01-01T00:00:00Z' }, error: null };
    const p = await updateOwnProfile(UUID, { firstName: ' A ', lastName: 'B', specialty: 'Sİ', group: 'Sİ26/01SB' });
    const patch = called('update')[0][0] as Record<string, unknown>;
    expect(patch).toEqual({ first_name: 'A', last_name: 'B', specialty: 'Sİ', group_name: 'Sİ26/01SB' });
    expect(patch).not.toHaveProperty('degree');
    expect(patch).not.toHaveProperty('course');
    expect(patch).not.toHaveProperty('role');
    expect(p).toMatchObject({ uid: UUID, specialty: 'Sİ', group: 'Sİ26/01SB' });
  });

  it('ixtisas/qrup verilməyibsə onlara toxunulmur', async () => {
    h.state.result = { data: { id: UUID, first_name: 'A', last_name: 'B', email: 'a@b.az', role: 'student', created_at: '2026-01-01T00:00:00Z' }, error: null };
    await updateOwnProfile(UUID, { firstName: 'A', lastName: 'B' });
    const patch = called('update')[0][0] as Record<string, unknown>;
    expect(patch).not.toHaveProperty('specialty');
    expect(patch).not.toHaveProperty('group_name');
  });
});

describe('şəxsi məlumatlar', () => {
  it('saxlama və oxunma işarəsi təkrar çağırışda xəta vermir (ignoreDuplicates)', async () => {
    await saveMaterial('u1', UUID);
    await markRead('u1', ['a-1', 'e-2']);
    const ups = called('upsert');
    expect(ups[0][1]).toMatchObject({ onConflict: 'user_id,material_id', ignoreDuplicates: true });
    expect(ups[1][0]).toEqual([{ user_id: 'u1', key: 'a-1' }, { user_id: 'u1', key: 'e-2' }]);
  });

  it('isRegistered: etibarsız id üçün sorğusuz false qaytarır', async () => {
    expect(await isRegistered('sample-e1', 'u1')).toBe(false);
    expect(h.state.calls).toHaveLength(0);
    h.state.result = { data: { event_id: UUID }, error: null };
    expect(await isRegistered(UUID, 'u1')).toBe(true);
  });
});
