import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as t from './lib/transform.mjs';

const ts = (iso) => ({ toDate: () => new Date(iso) }); // Firestore Timestamp təqlidi

test('tsToIso: Timestamp, Date, ISO, {_seconds}, boş', () => {
  assert.equal(t.tsToIso(ts('2026-03-05T10:00:00Z')), '2026-03-05T10:00:00.000Z');
  assert.equal(t.tsToIso(new Date('2026-03-05T10:00:00Z')), '2026-03-05T10:00:00.000Z');
  assert.equal(t.tsToIso('2026-03-05T10:00:00Z'), '2026-03-05T10:00:00.000Z');
  assert.equal(t.tsToIso({ _seconds: 1772704800 }), '2026-03-05T10:00:00.000Z');
  assert.equal(t.tsToIso(''), null);
  assert.equal(t.tsToIso(undefined), null);
  assert.equal(t.tsToIso('yanlış'), null);
});

const GROUPS = new Map([['Sİ26/01SB', 'Sİ'], ['KŞATS25/01SB', 'KŞATS']]);

test('mapProfile: rol, köhnə pillə/kurs, ixtisas+qrup və tarix qorunur; firebase_uid saxlanılır', () => {
  const r = t.mapProfile(
    { firstName: ' Aysel ', lastName: 'Məmmədova', role: 'admin', degree: 'magistr', course: 2, studentId: 'S1', specialty: 'Sİ', group: 'Sİ26/01SB', createdAt: ts('2025-09-01T08:00:00Z') },
    { uid: 'fbUID123' }, GROUPS,
  );
  assert.deepEqual(r, { firebase_uid: 'fbUID123', first_name: 'Aysel', last_name: 'Məmmədova', role: 'admin', student_id: 'S1', degree: 'magistr', course: 2, specialty: 'Sİ', group_name: 'Sİ26/01SB', created_at: '2025-09-01T08:00:00.000Z' });
});

test('placementOf: düzgün cüt saxlanılır; köhnə sərbəst mətn qrup, uyğunsuz və yarımçıq cüt təmizlənir (dropped=true)', () => {
  assert.deepEqual(t.placementOf({ specialty: 'Sİ', group: 'Sİ26/01SB' }, GROUPS), { specialty: 'Sİ', group_name: 'Sİ26/01SB', dropped: false });
  assert.deepEqual(t.placementOf({}, GROUPS), { specialty: null, group_name: null, dropped: false });
  assert.equal(t.placementOf({ group: 'SI-21' }, GROUPS).dropped, true, 'köhnə sxem: ixtisassız sərbəst qrup');
  assert.equal(t.placementOf({ specialty: 'KŞATS', group: 'Sİ26/01SB' }, GROUPS).dropped, true, 'qrup başqa ixtisasa aiddir');
  assert.equal(t.placementOf({ specialty: 'Sİ', group: 'uydurma' }, GROUPS).dropped, true);
  assert.equal(t.placementOf({ specialty: 'Sİ' }, GROUPS).dropped, true, 'yalnız ixtisas');
  assert.deepEqual(t.placementOf({ specialty: 'Sİ', group: 'Sİ26/01SB' }, null), { specialty: 'Sİ', group_name: 'Sİ26/01SB', dropped: false }, 'groupMap yoxdursa yoxlanmır');
});

test('mapProfile: yanlış rol/pillə/kurs təhlükəsiz defolta düşür (rol heç vaxt yüksəlmir)', () => {
  const r = t.mapProfile({ firstName: 'A', lastName: 'B', role: 'superadmin', degree: 'x', course: 9 }, { uid: 'u' });
  assert.equal(r.role, 'student');
  assert.equal(r.degree, null);
  assert.equal(r.course, null);
  assert.equal(r.specialty, null);
  assert.equal(r.group_name, null);
  assert.equal(r.student_id, null);
  assert.ok(!('created_at' in r));
});

test('mapProfile: ad və ya soyad yoxdursa rədd edilir', () => {
  assert.throws(() => t.mapProfile({ lastName: 'B' }, { uid: 'u' }), /firstName/);
  assert.throws(() => t.mapProfile({ firstName: 'A', lastName: '   ' }, { uid: 'u' }), /lastName/);
  assert.throws(() => t.mapProfile({ firstName: 'x'.repeat(61), lastName: 'B' }, { uid: 'u' }), /firstName/);
});

test('mapAnnouncement: published yalnız true olduqda true; yanlış kateqoriya → umumi', () => {
  const a = t.mapAnnouncement('d1', { title: 'Başlıq', body: 'B', category: 'yox', published: 'true', important: true, createdAt: ts('2026-01-01T00:00:00Z') });
  assert.equal(a.firebase_id, 'd1');
  assert.equal(a.published, false);
  assert.equal(a.important, true);
  assert.equal(a.category, 'umumi');
  assert.equal(a.summary, '');
});

test('mapEvent: ends_at boşdursa null, starts_at ISO', () => {
  const e = t.mapEvent('e1', { title: 'T', location: 'Zal', startsAt: ts('2026-05-01T09:00:00Z'), endsAt: '', registrationOpen: true });
  assert.equal(e.starts_at, '2026-05-01T09:00:00.000Z');
  assert.equal(e.ends_at, null);
  assert.equal(e.registration_open, true);
});

test('mapMaterial / mapSchedule / mapMessage: sahə adları və defoltlar', () => {
  assert.deepEqual(t.mapMaterial('m1', { title: 'T', subject: 'S', url: 'https://x.az/a.pdf', fileType: 'pdf' }),
    { firebase_id: 'm1', title: 'T', subject: 'S', author: '', description: '', url: 'https://x.az/a.pdf', file_type: 'pdf' });
  assert.deepEqual(t.mapSchedule('s1', { day: 3, startTime: '09:00', endTime: '10:30', subject: 'Fənn', lessonType: 'seminar' }),
    { firebase_id: 's1', day: 3, start_time: '09:00', end_time: '10:30', subject: 'Fənn', teacher: '', room: '', lesson_type: 'seminar' });
  assert.equal(t.mapMessage('c1', { name: 'A', email: 'a@b.az', subject: 'S', message: 'M', status: 'weird' }).status, 'new');
});

test('mapNote: firebase_id uid ilə birləşir; mapSaved/mapRegistration FK-ları yeni ID-lərlə qurulur', () => {
  const n = t.mapNote('fbU', 'note1', 'uuid-u', { text: ' qeyd ', day: 4, createdAt: ts('2026-02-02T00:00:00Z') });
  assert.deepEqual(n, { firebase_id: 'fbU/note1', user_id: 'uuid-u', text: 'qeyd', day: 4, created_at: '2026-02-02T00:00:00.000Z' });
  assert.deepEqual(t.mapSaved('uuid-u', 'uuid-m', {}), { user_id: 'uuid-u', material_id: 'uuid-m' });
  assert.deepEqual(t.mapRegistration('uuid-e', 'uuid-u', { name: 'A', email: 'a@b.az' }), { event_id: 'uuid-e', user_id: 'uuid-u', name: 'A', email: 'a@b.az' });
});

test('remapReadKey: köhnə ID-lər yeni UUID-lərlə əvəz olunur, tanınmayan açar null qaytarır', () => {
  const ann = new Map([['oldA', 'uuid-a']]);
  const ev = new Map([['oldE', 'uuid-e']]);
  assert.equal(t.remapReadKey('a-oldA', ann, ev), 'a-uuid-a');
  assert.equal(t.remapReadKey('e-oldE', ann, ev), 'e-uuid-e');
  assert.equal(t.remapReadKey('a-yoxdur', ann, ev), null);
  assert.equal(t.remapReadKey('x-oldA', ann, ev), null);
});

test('randomPassword: uzun və hər dəfə fərqli', () => {
  const a = t.randomPassword(), b = t.randomPassword();
  assert.ok(a.length >= 40);
  assert.notEqual(a, b);
});
