// Firestore sənədləri → Supabase sətirləri. Yalnız saf funksiyalar (şəbəkə yoxdur), ona görə testlənir.
import { randomBytes } from 'node:crypto';

export const ROLES = ['student', 'editor', 'admin'];
export const DEGREES = ['bakalavr', 'magistr', 'doktorantura'];
export const ANN_CATEGORIES = ['umumi', 'tedris', 'imtahan', 'telebe-heyati', 'praktika'];
export const EVENT_CATEGORIES = ['seminar', 'konfrans', 'goenullu', 'tedris-xarici', 'praktika'];
export const MATERIAL_TYPES = ['pdf', 'doc', 'ppt', 'video', 'link'];
export const LESSON_TYPES = ['muhazire', 'seminar', 'praktika'];

/** Firestore Timestamp (və ya Date / ISO sətir / {_seconds}) → ISO sətir; tanınmazsa null. */
export function tsToIso(v) {
  if (v == null || v === '') return null;
  let d;
  if (typeof v.toDate === 'function') d = v.toDate();
  else if (v instanceof Date) d = v;
  else if (typeof v === 'object' && typeof v._seconds === 'number') d = new Date(v._seconds * 1000);
  else if (typeof v === 'string') d = new Date(v);
  else return null;
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const str = (v, fallback = '') => (typeof v === 'string' ? v.trim() : fallback);
const pick = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);
const withDate = (row, d) => { const c = tsToIso(d.createdAt); if (c) row.created_at = c; return row; };

/**
 * İxtisas + qrup cütü. `groupMap` (qrup kodu → ixtisas) verilibsə cüt onunla yoxlanılır; keçərsiz cüt (məs. köhnə sxemdəki
 * sərbəst mətn qrup) təmizlənir və dropped=true qaytarılır ki, hesabatda göstərilsin. Məlumat itirilmir: Firebase surəti backup/-dadır.
 */
export function placementOf(d, groupMap) {
  const specialty = str(d.specialty).slice(0, 40), group = str(d.group).slice(0, 20);
  if (!specialty && !group) return { specialty: null, group_name: null, dropped: false };
  if (groupMap && !(specialty && group && groupMap.get(group) === specialty)) return { specialty: null, group_name: null, dropped: true };
  if (!specialty || !group) return { specialty: null, group_name: null, dropped: true };
  return { specialty, group_name: group, dropped: false };
}

/** Profil: ad və soyad olmadan hesab yaradılmır (DB tətiyi də rədd edər). Köhnə degree/course sütunlarda saxlanılır (istifadə olunmur). */
export function mapProfile(d, authUser, groupMap = null) {
  const first = str(d.firstName), last = str(d.lastName);
  if (first.length < 1 || first.length > 60) throw new Error('firstName boşdur və ya 60 simvoldan uzundur');
  if (last.length < 1 || last.length > 60) throw new Error('lastName boşdur və ya 60 simvoldan uzundur');
  const course = Number(d.course);
  const row = {
    firebase_uid: authUser.uid,
    first_name: first,
    last_name: last,
    role: pick(d.role, ROLES, 'student'),
    student_id: str(d.studentId).slice(0, 30) || null,
    degree: pick(d.degree, DEGREES, null),
    course: Number.isInteger(course) && course >= 1 && course <= 6 ? course : null,
  };
  const { dropped, ...placement } = placementOf(d, groupMap);
  void dropped;
  Object.assign(row, placement);
  return withDate(row, d);
}

export const mapAnnouncement = (id, d) => withDate({
  firebase_id: id, title: str(d.title), summary: str(d.summary), body: str(d.body),
  category: pick(d.category, ANN_CATEGORIES, 'umumi'), important: d.important === true, published: d.published === true,
}, d);

export const mapMaterial = (id, d) => withDate({
  firebase_id: id, title: str(d.title), subject: str(d.subject), author: str(d.author), description: str(d.description),
  url: str(d.url), file_type: pick(d.fileType, MATERIAL_TYPES, 'link'),
}, d);

export const mapEvent = (id, d) => withDate({
  firebase_id: id, title: str(d.title), description: str(d.description), category: pick(d.category, EVENT_CATEGORIES, 'seminar'),
  location: str(d.location), starts_at: tsToIso(d.startsAt), ends_at: tsToIso(d.endsAt), registration_open: d.registrationOpen === true,
}, d);

export const mapSchedule = (id, d) => ({
  firebase_id: id, day: Number(d.day), start_time: str(d.startTime), end_time: str(d.endTime), subject: str(d.subject),
  teacher: str(d.teacher), room: str(d.room), lesson_type: pick(d.lessonType, LESSON_TYPES, 'muhazire'),
});

export const mapMessage = (id, d) => withDate({
  firebase_id: id, name: str(d.name), email: str(d.email), subject: str(d.subject), message: str(d.message),
  status: pick(d.status, ['new', 'read'], 'new'),
}, d);

export const mapRegistration = (eventId, userId, d) => withDate({
  event_id: eventId, user_id: userId, name: str(d.name), email: str(d.email),
}, d);

/** Qeyd ID-ləri yalnız istifadəçinin alt kolleksiyasında unikaldır, ona görə firebase_id = "uid/noteId". */
export const mapNote = (fbUid, noteId, userId, d) => withDate({
  firebase_id: `${fbUid}/${noteId}`, user_id: userId, text: str(d.text), day: Number(d.day ?? 1),
}, d);

export function mapSaved(userId, materialId, d) {
  const row = { user_id: userId, material_id: materialId };
  const c = tsToIso(d.createdAt); if (c) row.created_at = c;
  return row;
}

/** Bildiriş açarı "a-<elanId>" / "e-<tədbirId>" köhnə ID-ni daşıyır; yeni UUID ilə əvəz olunur. Tanınmazsa null. */
export function remapReadKey(key, announcementIds, eventIds) {
  const m = /^([ae])-(.+)$/.exec(key);
  if (!m) return null;
  const map = m[1] === 'a' ? announcementIds : eventIds;
  const id = map.get(m[2]);
  return id ? `${m[1]}-${id}` : null;
}

/** Hesablar parolsuz köçürülür: təsadüfi, heç vaxt göstərilməyən və saxlanılmayan parol təyin olunur. İstifadəçi "şifrəni unutdum" ilə yenisini yaradır. */
export const randomPassword = () => randomBytes(32).toString('base64url');
