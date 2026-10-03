import { supabase } from '@/lib/supabase';
import type { PersonalNote } from '@/types';
import { iso, isUuid, need, unwrap } from './db';

// Şəxsi məlumatlar yalnız sahibinə görünür (RLS: user_id = auth.uid()).

// ---- Saxlanılmış materiallar: saved_materials
export async function listSavedIds(uid: string): Promise<string[]> {
  need();
  const rows = unwrap(await supabase.from('saved_materials').select('material_id').eq('user_id', uid)) as { material_id: string }[];
  return rows.map((r) => r.material_id);
}
export async function saveMaterial(uid: string, materialId: string) {
  need();
  unwrap(await supabase.from('saved_materials').upsert({ user_id: uid, material_id: materialId }, { onConflict: 'user_id,material_id', ignoreDuplicates: true }));
}
export async function unsaveMaterial(uid: string, materialId: string) {
  need();
  unwrap(await supabase.from('saved_materials').delete().eq('user_id', uid).eq('material_id', materialId));
}

// ---- Şəxsi qeydlər: personal_notes
export async function listNotes(uid: string): Promise<PersonalNote[]> {
  need();
  const rows = unwrap(await supabase.from('personal_notes').select('id,text,day,created_at').eq('user_id', uid)) as { id: string; text: string; day: number; created_at: string }[];
  return rows
    .map((r) => ({ id: r.id, text: String(r.text ?? ''), day: Number(r.day ?? 1), createdAt: iso(r.created_at, new Date().toISOString()) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function addNote(uid: string, text: string, day: number) {
  need();
  unwrap(await supabase.from('personal_notes').insert({ user_id: uid, text, day }));
}
export async function removeNote(uid: string, id: string) {
  need();
  unwrap(await supabase.from('personal_notes').delete().eq('user_id', uid).eq('id', id));
}

// ---- Bildirişlərin oxunma vəziyyəti: notification_reads
export async function listReadKeys(uid: string): Promise<Set<string>> {
  need();
  const rows = unwrap(await supabase.from('notification_reads').select('key').eq('user_id', uid)) as { key: string }[];
  return new Set(rows.map((r) => r.key));
}
export async function markRead(uid: string, keys: string[]) {
  need();
  if (!keys.length) return;
  unwrap(await supabase.from('notification_reads').upsert(keys.map((key) => ({ user_id: uid, key })), { onConflict: 'user_id,key', ignoreDuplicates: true }));
}

// ---- Tədbirə qeydiyyat: event_registrations
export async function isRegistered(eventId: string, uid: string): Promise<boolean> {
  need();
  if (!isUuid(eventId)) return false;
  const row = unwrap(await supabase.from('event_registrations').select('event_id').eq('event_id', eventId).eq('user_id', uid).maybeSingle());
  return row !== null;
}
export async function registerForEvent(eventId: string, uid: string, name: string, email: string) {
  need();
  unwrap(await supabase.from('event_registrations').upsert({ event_id: eventId, user_id: uid, name, email }, { onConflict: 'event_id,user_id', ignoreDuplicates: true }));
}
export async function cancelRegistration(eventId: string, uid: string) {
  need();
  unwrap(await supabase.from('event_registrations').delete().eq('event_id', eventId).eq('user_id', uid));
}
