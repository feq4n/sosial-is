// Miqrasiya məntiqi. Firebase və Supabase klientləri KƏNARDAN verilir (migrate.mjs real klientləri, testlər saxta klientləri ötürür).
//
//   source.authUsers()           -> [{ uid, email, disabled }]
//   source.collection(name)      -> [{ id, data }]
//   source.subcollection(name)   -> [{ id, parentId, data }]   (collectionGroup; parentId = sahib sənədin ID-si)
//
// Rejimlər:
//   'dry-run' : yalnız Firebase-dən oxuyur, heç nə yazmır, Supabase-ə qoşulmur.
//   'apply'   : yazır (təkrar işə salmaq təhlükəsizdir: firebase_id / firebase_uid və açar cütləri üzrə upsert), sonra yoxlayır.
//   'verify'  : yazmır; Firebase ilə Supabase sətir saylarını müqayisə edir.
import * as t from './transform.mjs';

const PAGE = 1000;

export async function fetchAll(sb, table, cols) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select(cols).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < PAGE) return out;
  }
}

const AREAS = ['users', 'announcements', 'materials', 'events', 'schedule', 'contact_messages', 'event_registrations', 'saved_materials', 'personal_notes', 'notification_reads'];

export async function runMigration({ source, sb, mode = 'dry-run', log = console.log }) {
  const write = mode === 'apply';
  const stats = Object.fromEntries(AREAS.map((a) => [a, { source: 0, skipped: 0, failed: 0 }]));
  const problems = [];
  const problem = (area, id, reason, counts = 'skipped') => { problems.push({ area, id, reason }); if (counts) stats[area][counts]++; };

  // ---------- 1. Firebase-dən oxu (yalnız oxuma)
  const authUsers = await source.authUsers();
  const userDocs = new Map((await source.collection('users')).map((d) => [d.id, d.data]));
  const snapshot = {
    authUsers, users: Object.fromEntries(userDocs),
    announcements: await source.collection('announcements'),
    materials: await source.collection('materials'),
    events: await source.collection('events'),
    schedule: await source.collection('schedule'),
    contact_messages: await source.collection('contact_messages'),
    registrations: await source.subcollection('registrations'),
    saved: await source.subcollection('saved'),
    notes: await source.subcollection('notes'),
    notificationReads: await source.subcollection('notificationReads'),
  };
  log(`Firebase oxundu: ${authUsers.length} auth hesabı, ${userDocs.size} profil sənədi`);

  // ---------- 2. İstifadəçilər
  const uidMap = new Map(); // firebase uid -> supabase uuid
  if (sb) for (const p of await fetchAll(sb, 'profiles', 'id,firebase_uid')) if (p.firebase_uid) uidMap.set(p.firebase_uid, p.id);
  const authUids = new Set(authUsers.map((u) => u.uid));
  for (const id of userDocs.keys()) if (!authUids.has(id)) problem('users', id, 'Firestore profili var, Firebase Auth hesabı yoxdur (köçürülmür)', null);

  stats.users.source = authUsers.length;
  for (const au of authUsers) {
    const doc = userDocs.get(au.uid);
    if (!doc) { problem('users', au.uid, 'Firebase Auth hesabı var, Firestore profili yoxdur (köhnə sistemdə də giriş işləməzdi)'); continue; }
    if (!au.email) { problem('users', au.uid, 'e-poçt yoxdur'); continue; }
    let row;
    try { row = t.mapProfile(doc, au); } catch (e) { problem('users', au.uid, e.message); continue; }
    if (uidMap.has(au.uid)) continue; // artıq köçürülüb
    if (!write) { uidMap.set(au.uid, `dry:${au.uid}`); continue; }

    const { data, error } = await sb.auth.admin.createUser({
      email: au.email,
      email_confirm: true, // köhnə sistem təsdiqi məcburi etmirdi; istifadəçi parolu e-poçt keçidi ilə yeniləyəcək
      password: t.randomPassword(),
      user_metadata: { first_name: row.first_name, last_name: row.last_name, degree: row.degree, course: row.course, student_id: row.student_id },
      ...(au.disabled ? { ban_duration: '876000h' } : {}),
    });
    if (error) { problem('users', au.uid, `Supabase Auth: ${error.code ?? ''} ${error.message}`, 'failed'); continue; }
    const { error: upErr } = await sb.from('profiles').update(row).eq('id', data.user.id);
    if (upErr) { problem('users', au.uid, `profil yenilənmədi: ${upErr.message}`, 'failed'); continue; }
    uidMap.set(au.uid, data.user.id);
  }

  // ---------- 3. Məzmun (firebase_id üzrə upsert)
  async function upsertAll(area, table, docs, mapper) {
    stats[area].source = docs.length;
    for (const { id, data } of docs) {
      let row;
      try { row = mapper(id, data); } catch (e) { problem(area, id, e.message); continue; }
      if (!write) continue;
      const { error } = await sb.from(table).upsert(row, { onConflict: 'firebase_id' });
      if (error) problem(area, id, `${error.code ?? ''} ${error.message}`.trim(), 'failed');
    }
  }
  await upsertAll('announcements', 'announcements', snapshot.announcements, t.mapAnnouncement);
  await upsertAll('materials', 'materials', snapshot.materials, t.mapMaterial);
  await upsertAll('events', 'events', snapshot.events, (id, d) => {
    const r = t.mapEvent(id, d);
    if (!r.starts_at) throw new Error('startsAt yoxdur və ya tanınmır');
    return r;
  });
  await upsertAll('schedule', 'schedule_entries', snapshot.schedule, t.mapSchedule);
  await upsertAll('contact_messages', 'contact_messages', snapshot.contact_messages, t.mapMessage);

  const idMap = async (table, docs) => {
    if (!write && !sb) return new Map(docs.map((d) => [d.id, `dry:${d.id}`]));
    const m = new Map();
    for (const r of await fetchAll(sb, table, 'id,firebase_id')) if (r.firebase_id) m.set(r.firebase_id, r.id);
    return m;
  };
  const announcementIds = await idMap('announcements', snapshot.announcements);
  const materialIds = await idMap('materials', snapshot.materials);
  const eventIds = await idMap('events', snapshot.events);

  // ---------- 4. Əlaqəli məlumatlar (köhnə ID-lər yeni UUID-lərlə əvəz olunur)
  async function link(area, table, items, onConflict, build) {
    stats[area].source = items.length;
    for (const it of items) {
      let row;
      try { row = build(it); } catch (e) { problem(area, `${it.parentId}/${it.id}`, e.message); continue; }
      if (!row) continue;
      if (!write) continue;
      const { error } = await sb.from(table).upsert(row, { onConflict });
      if (error) problem(area, `${it.parentId}/${it.id}`, `${error.code ?? ''} ${error.message}`.trim(), 'failed');
    }
  }
  const need = (map, key, what) => { const v = map.get(key); if (!v) throw new Error(`${what} köçürülməyib: ${key}`); return v; };

  await link('event_registrations', 'event_registrations', snapshot.registrations, 'event_id,user_id',
    (it) => t.mapRegistration(need(eventIds, it.parentId, 'tədbir'), need(uidMap, it.id, 'istifadəçi'), it.data));
  await link('saved_materials', 'saved_materials', snapshot.saved, 'user_id,material_id',
    (it) => t.mapSaved(need(uidMap, it.parentId, 'istifadəçi'), need(materialIds, it.id, 'material'), it.data));
  await link('personal_notes', 'personal_notes', snapshot.notes, 'firebase_id',
    (it) => t.mapNote(it.parentId, it.id, need(uidMap, it.parentId, 'istifadəçi'), it.data));
  await link('notification_reads', 'notification_reads', snapshot.notificationReads, 'user_id,key', (it) => {
    const key = t.remapReadKey(it.id, announcementIds, eventIds);
    if (!key) throw new Error(`bildiriş açarı tanınmır və ya elan/tədbir köçürülməyib: ${it.id}`);
    const row = { user_id: need(uidMap, it.parentId, 'istifadəçi'), key };
    const r = t.tsToIso(it.data.readAt); if (r) row.read_at = r;
    return row;
  });

  // ---------- 5. Yoxlama: Firebase sayı − (uğursuz/atlanan) = Supabase sayı
  const verification = [];
  if (mode !== 'dry-run') {
    const migratedUsers = new Set(uidMap.values());
    const actual = {
      users: (await fetchAll(sb, 'profiles', 'firebase_uid')).filter((r) => r.firebase_uid).length,
      announcements: (await fetchAll(sb, 'announcements', 'firebase_id')).filter((r) => r.firebase_id).length,
      materials: (await fetchAll(sb, 'materials', 'firebase_id')).filter((r) => r.firebase_id).length,
      events: (await fetchAll(sb, 'events', 'firebase_id')).filter((r) => r.firebase_id).length,
      schedule: (await fetchAll(sb, 'schedule_entries', 'firebase_id')).filter((r) => r.firebase_id).length,
      contact_messages: (await fetchAll(sb, 'contact_messages', 'firebase_id')).filter((r) => r.firebase_id).length,
      personal_notes: (await fetchAll(sb, 'personal_notes', 'firebase_id')).filter((r) => r.firebase_id).length,
      event_registrations: (await fetchAll(sb, 'event_registrations', 'user_id')).filter((r) => migratedUsers.has(r.user_id)).length,
      saved_materials: (await fetchAll(sb, 'saved_materials', 'user_id')).filter((r) => migratedUsers.has(r.user_id)).length,
      notification_reads: (await fetchAll(sb, 'notification_reads', 'user_id')).filter((r) => migratedUsers.has(r.user_id)).length,
    };
    for (const a of AREAS) {
      const s = stats[a];
      const expected = s.source - s.skipped - s.failed;
      verification.push({ area: a, firebase: s.source, skipped: s.skipped, failed: s.failed, expected, supabase: actual[a], ok: expected === actual[a] });
    }
  }
  return { mode, stats, problems, verification, snapshot, ok: verification.every((v) => v.ok) };
}

/** Yalnız bu skriptlə köçürülmüş məlumatı (firebase_id / firebase_uid olanları) silir. Firebase-ə toxunmur. */
export async function rollback({ sb, log = console.log }) {
  for (const table of ['announcements', 'materials', 'events', 'schedule_entries', 'contact_messages', 'personal_notes']) {
    const { error } = await sb.from(table).delete().not('firebase_id', 'is', null);
    if (error) throw new Error(`${table}: ${error.message}`);
    log(`silindi: ${table} (firebase_id olanlar)`);
  }
  // auth istifadəçisi silinəndə profil, saxlanılanlar, qeydlər, oxunma və qeydiyyatlar cascade ilə silinir
  const users = (await fetchAll(sb, 'profiles', 'id,firebase_uid')).filter((p) => p.firebase_uid);
  for (const u of users) {
    const { error } = await sb.auth.admin.deleteUser(u.id);
    if (error) throw new Error(`auth istifadəçisi ${u.id}: ${error.message}`);
  }
  log(`silindi: ${users.length} köçürülmüş istifadəçi`);
}

/** Köçürülmüş istifadəçilərə şifrə yeniləmə keçidi göndərir (Supabase-in daxili SMTP limiti aşağıdır; öz SMTP-nizi qoşun). */
export async function sendResetEmails({ sb, redirectTo, delayMs = 1200, log = console.log }) {
  const users = (await fetchAll(sb, 'profiles', 'email,firebase_uid')).filter((p) => p.firebase_uid);
  let sent = 0; const failed = [];
  for (const u of users) {
    const { error } = await sb.auth.resetPasswordForEmail(u.email, { redirectTo });
    if (error) failed.push({ email: u.email, reason: error.message }); else sent++;
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
  }
  log(`şifrə sıfırlama göndərildi: ${sent}/${users.length}`);
  return { sent, failed };
}
