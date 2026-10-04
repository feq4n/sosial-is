import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { runMigration, rollback, sendResetEmails } from './lib/runner.mjs';

const ts = (iso) => ({ toDate: () => new Date(iso) });

// ---------- Saxta Supabase (yaddaşda): upsert/unikallıq, sadə CHECK, createUser + profil tətiyi, cascade
function fakeSupabase() {
  const T = Object.fromEntries(['profiles', 'announcements', 'materials', 'events', 'schedule_entries', 'contact_messages', 'event_registrations', 'saved_materials', 'personal_notes', 'notification_reads'].map((n) => [n, []]));
  const hasId = new Set(['profiles', 'announcements', 'materials', 'events', 'schedule_entries', 'contact_messages', 'personal_notes']);
  const checks = {
    announcements: (r) => (r.title?.length >= 3 ? null : { code: '23514', message: 'check title' }),
    events: (r) => (r.starts_at ? null : { code: '23502', message: 'starts_at null' }),
  };
  const log = { createUser: [], reset: [], writes: 0 };
  const project = (r, cols) => (cols === '*' ? { ...r } : Object.fromEntries(cols.split(',').map((c) => [c, r[c] ?? null])));
  const from = (name) => ({
    select: (cols) => ({ range: (a, b) => Promise.resolve({ data: T[name].slice(a, b + 1).map((r) => project(r, cols)), error: null }) }),
    upsert: (row, { onConflict }) => {
      log.writes++;
      const err = checks[name]?.(row); if (err) return Promise.resolve({ error: err });
      const keys = onConflict.split(',');
      const i = T[name].findIndex((r) => keys.every((k) => r[k] === row[k]));
      if (i >= 0) Object.assign(T[name][i], row); else T[name].push({ ...(hasId.has(name) ? { id: randomUUID() } : {}), ...row });
      return Promise.resolve({ error: null });
    },
    update: (patch) => ({ eq: (col, val) => { log.writes++; T[name].filter((r) => r[col] === val).forEach((r) => Object.assign(r, patch)); return Promise.resolve({ error: null }); } }),
    delete: () => ({ not: (col) => { T[name] = T[name].filter((r) => r[col] == null); return Promise.resolve({ error: null }); } }),
  });
  const auth = { admin: {
    createUser: async (a) => {
      log.createUser.push(a);
      if (T.profiles.some((p) => p.email.toLowerCase() === a.email.toLowerCase())) return { data: null, error: { code: 'email_exists', message: 'exists' } };
      const id = randomUUID();
      const m = a.user_metadata;
      T.profiles.push({ id, email: a.email, first_name: m.first_name, last_name: m.last_name, degree: null, course: null, specialty: m.specialty ?? null, group_name: m.group ?? null, student_id: m.student_id, role: 'student', firebase_uid: null }); // handle_new_user tətiyi
      return { data: { user: { id } }, error: null };
    },
    deleteUser: async (id) => {
      T.profiles = T.profiles.filter((p) => p.id !== id);
      for (const n of ['event_registrations', 'saved_materials', 'personal_notes', 'notification_reads']) T[n] = T[n].filter((r) => r.user_id !== id);
      return { error: null };
    },
  }, resetPasswordForEmail: async (email, o) => { log.reset.push([email, o]); return { error: null }; } };
  // 'from' dəyişdikcə tables yenilənə bilər (delete), ona görə həmişə T-ni oxuyur
  return { from, auth, T, log };
}

// ---------- Saxta Firebase mənbəyi
function fixture() {
  const col = {
    users: [
      { id: 'u1', data: { firstName: 'Admin', lastName: 'Adminov', role: 'admin', degree: 'magistr', course: 1, group: 'SI-21', createdAt: ts('2025-01-01T00:00:00Z') } }, // köhnə sxem: sərbəst mətn qrup
      { id: 'u2', data: { firstName: 'Aysel', lastName: 'Məmmədova', role: 'student', specialty: 'Sİ', group: 'Sİ26/01SB', studentId: 'S-1', createdAt: ts('2025-09-01T00:00:00Z') } },
      { id: 'u4', data: { firstName: 'Yetim', lastName: 'Profil' } }, // Auth hesabı yoxdur
      { id: 'u5', data: { firstName: 'Bloklu', lastName: 'İstifadəçi' } },
    ],
    announcements: [
      { id: 'a1', data: { title: 'Elan 1', summary: 'S', body: 'Mətn', published: true, createdAt: ts('2026-01-10T10:00:00Z') } },
      { id: 'a2', data: { title: 'ab', body: 'Qısa başlıq', published: true } }, // DB CHECK rədd edəcək
    ],
    materials: [{ id: 'm1', data: { title: 'Material', subject: 'Fənn', url: 'https://x.az/m.pdf', fileType: 'pdf', createdAt: ts('2026-01-11T10:00:00Z') } }],
    events: [
      { id: 'e1', data: { title: 'Seminar', location: 'Zal', startsAt: ts('2026-05-01T09:00:00Z'), registrationOpen: true } },
      { id: 'e2', data: { title: 'Tarixsiz', location: 'Zal' } }, // startsAt yoxdur
    ],
    schedule: [{ id: 's1', data: { day: 1, startTime: '09:00', endTime: '10:30', subject: 'Sosial iş' } }],
    contact_messages: [{ id: 'c1', data: { name: 'Qonaq', email: 'q@x.az', subject: 'Sual', message: 'Mesaj mətni burada', status: 'read', createdAt: ts('2026-02-01T00:00:00Z') } }],
  };
  const sub = {
    registrations: [
      { id: 'u2', parentId: 'e1', data: { name: 'Aysel', email: 'a@x.az', createdAt: ts('2026-03-01T00:00:00Z') } },
      { id: 'u2', parentId: 'e2', data: { name: 'Aysel', email: 'a@x.az' } }, // e2 köçürülmür
    ],
    saved: [
      { id: 'm1', parentId: 'u2', data: { createdAt: ts('2026-03-02T00:00:00Z') } },
      { id: 'mYOX', parentId: 'u2', data: {} },
    ],
    notes: [{ id: 'n1', parentId: 'u2', data: { text: 'Qeyd', day: 3, createdAt: ts('2026-03-03T00:00:00Z') } }],
    notificationReads: [
      { id: 'a-a1', parentId: 'u2', data: { readAt: ts('2026-03-04T00:00:00Z') } },
      { id: 'a-a2', parentId: 'u2', data: {} }, // a2 köçürülmədi
      { id: 'weird', parentId: 'u2', data: {} },
    ],
  };
  return {
    async authUsers() {
      return [
        { uid: 'u1', email: 'admin@x.az', disabled: false },
        { uid: 'u2', email: 'aysel@x.az', disabled: false },
        { uid: 'u3', email: 'profilsiz@x.az', disabled: false }, // Firestore profili yoxdur
        { uid: 'u5', email: 'bloklu@x.az', disabled: true },
      ];
    },
    async collection(n) { return col[n] ?? []; },
    async subcollection(n) { return sub[n] ?? []; },
  };
}

const quiet = () => {};
const GROUPS = [{ code: 'Sİ26/01SB', specialty: 'Sİ' }, { code: 'KŞATS25/01SB', specialty: 'KŞATS' }];

test('dry-run: Supabase olmadan işləyir, heç nə yazmır, problemləri aşkarlayır', async () => {
  const r = await runMigration({ source: fixture(), sb: null, mode: 'dry-run', log: quiet, groups: GROUPS });
  assert.equal(r.verification.length, 0);
  const reasons = r.problems.map((p) => `${p.area}:${p.id}`);
  assert.ok(reasons.includes('users:u3'), 'profilsiz auth hesabı');
  assert.ok(reasons.includes('users:u4'), 'auth-suz profil');
  assert.ok(reasons.includes('events:e2'), 'startsAt-sız tədbir');
  assert.ok(reasons.includes('notification_reads:u2/weird'));
});

test('apply: hesablar, rollar, FK-lar, tarixlər və bildiriş açarları düzgün köçürülür; say yoxlaması uğurludur', async () => {
  const sb = fakeSupabase();
  const r = await runMigration({ source: fixture(), sb, mode: 'apply', log: quiet, groups: GROUPS });

  // istifadəçilər: u1, u2, u5 (blok); u3 profilsiz atlandı
  assert.equal(sb.T.profiles.length, 3);
  const admin = sb.T.profiles.find((p) => p.firebase_uid === 'u1');
  assert.equal(admin.role, 'admin', 'admin rolu qorunur');
  assert.equal(admin.created_at, '2025-01-01T00:00:00.000Z');
  const aysel = sb.T.profiles.find((p) => p.firebase_uid === 'u2');
  assert.deepEqual([aysel.role, aysel.specialty, aysel.group_name, aysel.student_id], ['student', 'Sİ', 'Sİ26/01SB', 'S-1']);
  // köhnə sxemli admin: degree/course saxlanılır, sərbəst mətn qrup təmizlənir (hesabatda bildirilir)
  assert.deepEqual([admin.degree, admin.course, admin.specialty, admin.group_name], ['magistr', 1, null, null]);
  assert.ok(r.problems.some((p) => p.area === 'users' && p.id === 'u1' && /ixtisas\/qrup keçərsizdir/.test(p.reason)));
  assert.equal(r.verification.find((v) => v.area === 'users').skipped, 1, 'təmizlənən qrup istifadəçini atlanmışlara əlavə etmir');
  assert.deepEqual(sb.log.createUser.find((a) => a.email === 'aysel@x.az').user_metadata, { first_name: 'Aysel', last_name: 'Məmmədova', student_id: 'S-1', specialty: 'Sİ', group: 'Sİ26/01SB' });

  // createUser: parolsuz köçürmə (təsadüfi parol), rol metadata-da yoxdur, bloklu hesab bloklanıb
  assert.equal(sb.log.createUser.length, 3);
  const pwds = new Set(sb.log.createUser.map((a) => a.password));
  assert.equal(pwds.size, 3);
  for (const a of sb.log.createUser) { assert.ok(a.password.length >= 40); assert.ok(!('role' in a.user_metadata)); assert.ok(!('degree' in a.user_metadata)); assert.equal(a.email_confirm, true); }
  assert.equal(sb.log.createUser.find((a) => a.email === 'bloklu@x.az').ban_duration, '876000h');

  // məzmun
  assert.equal(sb.T.announcements.length, 1, 'a2 DB CHECK ilə rədd edilib');
  assert.equal(sb.T.announcements[0].created_at, '2026-01-10T10:00:00.000Z');
  assert.equal(sb.T.materials.length, 1);
  assert.equal(sb.T.events.length, 1);
  assert.equal(sb.T.schedule_entries.length, 1);
  assert.equal(sb.T.contact_messages[0].status, 'read');

  // əlaqələr yeni UUID-lərlə
  const reg = sb.T.event_registrations;
  assert.equal(reg.length, 1);
  assert.equal(reg[0].event_id, sb.T.events[0].id);
  assert.equal(reg[0].user_id, aysel.id);
  assert.equal(sb.T.saved_materials.length, 1);
  assert.equal(sb.T.saved_materials[0].material_id, sb.T.materials[0].id);
  assert.equal(sb.T.personal_notes[0].firebase_id, 'u2/n1');
  assert.equal(sb.T.notification_reads.length, 1);
  assert.equal(sb.T.notification_reads[0].key, `a-${sb.T.announcements[0].id}`, 'açar yeni elan UUID-si ilə əvəzlənib');

  // problemlər aydın bildirilir
  const failed = r.problems.filter((p) => p.area === 'announcements');
  assert.equal(failed.length, 1);
  assert.equal(failed[0].id, 'a2');
  assert.ok(r.problems.some((p) => p.area === 'saved_materials' && p.id === 'u2/mYOX'));

  // say yoxlaması: hamısı uyğun
  assert.equal(r.ok, true, JSON.stringify(r.verification.filter((v) => !v.ok)));
  const byArea = Object.fromEntries(r.verification.map((v) => [v.area, v]));
  assert.deepEqual([byArea.users.firebase, byArea.users.skipped, byArea.users.supabase], [4, 1, 3]);
  assert.deepEqual([byArea.announcements.firebase, byArea.announcements.failed, byArea.announcements.supabase], [2, 1, 1]);
});

test('apply ikinci dəfə: dublikat yaranmır, yeni hesab yaradılmır (idempotent)', async () => {
  const sb = fakeSupabase();
  await runMigration({ source: fixture(), sb, mode: 'apply', log: quiet, groups: GROUPS });
  const before = JSON.stringify(Object.fromEntries(Object.entries(sb.T).map(([k, v]) => [k, v.length])));
  const usersBefore = sb.log.createUser.length;
  const r = await runMigration({ source: fixture(), sb, mode: 'apply', log: quiet, groups: GROUPS });
  assert.equal(sb.log.createUser.length, usersBefore, 'mövcud istifadəçilər yenidən yaradılmır');
  assert.equal(JSON.stringify(Object.fromEntries(Object.entries(sb.T).map(([k, v]) => [k, v.length]))), before);
  assert.equal(r.ok, true);
});

test('verify: heç nə yazmır və sərtdir: Supabase-ə düşməyən sənədi (a2) gizlətmir; itkini tapır', async () => {
  const sb = fakeSupabase();
  await runMigration({ source: fixture(), sb, mode: 'apply', log: quiet, groups: GROUPS });
  const writes = sb.log.writes;

  const r1 = await runMigration({ source: fixture(), sb, mode: 'verify', log: quiet, groups: GROUPS });
  assert.equal(sb.log.writes, writes, 'verify rejimi yazmır');
  assert.deepEqual(r1.verification.filter((v) => !v.ok).map((v) => v.area), ['announcements'], 'yalnız DB-nin rədd etdiyi a2 fərq kimi görünür');

  // mənbədən problemli elanı çıxarsaq, hər şey uyğundur
  const base = fixture();
  const clean = { ...base, collection: async (n) => (n === 'announcements' ? (await base.collection(n)).filter((d) => d.id === 'a1') : base.collection(n)) };
  assert.equal((await runMigration({ source: clean, sb, mode: 'verify', log: quiet, groups: GROUPS })).ok, true);

  // itki simulyasiyası
  sb.T.materials.length = 0;
  const r2 = await runMigration({ source: clean, sb, mode: 'verify', log: quiet, groups: GROUPS });
  assert.equal(r2.ok, false);
  assert.equal(r2.verification.find((v) => v.area === 'materials').ok, false);
});

test('rollback: yalnız köçürülmüşləri silir, əl ilə yaradılmış məlumata toxunmur', async () => {
  const sb = fakeSupabase();
  await runMigration({ source: fixture(), sb, mode: 'apply', log: quiet, groups: GROUPS });
  sb.T.announcements.push({ id: randomUUID(), firebase_id: null, title: 'Əl ilə yazılmış elan', body: 'x' });
  sb.T.profiles.push({ id: randomUUID(), firebase_uid: null, email: 'yeni@x.az', first_name: 'Yeni', last_name: 'Qeydiyyat', role: 'student' });
  await rollback({ sb, log: quiet });
  assert.equal(sb.T.announcements.length, 1);
  assert.equal(sb.T.announcements[0].title, 'Əl ilə yazılmış elan');
  assert.equal(sb.T.profiles.length, 1);
  assert.equal(sb.T.profiles[0].email, 'yeni@x.az');
  assert.equal(sb.T.event_registrations.length + sb.T.saved_materials.length + sb.T.notification_reads.length, 0);
});

test('sendResetEmails: yalnız köçürülmüş istifadəçilərə /reset-password keçidi göndərir', async () => {
  const sb = fakeSupabase();
  await runMigration({ source: fixture(), sb, mode: 'apply', log: quiet, groups: GROUPS });
  sb.T.profiles.push({ id: randomUUID(), firebase_uid: null, email: 'yeni@x.az' });
  const { sent, failed } = await sendResetEmails({ sb, redirectTo: 'https://site.az/reset-password', delayMs: 0, log: quiet });
  assert.equal(sent, 3);
  assert.equal(failed.length, 0);
  assert.ok(sb.log.reset.every(([, o]) => o.redirectTo === 'https://site.az/reset-password'));
  assert.ok(!sb.log.reset.some(([e]) => e === 'yeni@x.az'));
});
