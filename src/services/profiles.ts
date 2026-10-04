import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types';
import { fromRow, iso, need, unwrap } from './db';

export interface ProfileUpdate { firstName: string; lastName: string; studentId?: string; specialty?: string; group?: string }

/** profiles sətri → UserProfile (`id` → `uid`, `group_name` → `group`). */
export function toProfile(row: Record<string, unknown>): UserProfile {
  const p = fromRow<Record<string, unknown>>(row);
  const { id, groupName, createdAt, updatedAt, ...rest } = p;
  void updatedAt;
  return { ...(rest as Omit<UserProfile, 'uid' | 'group' | 'createdAt'>), uid: String(id), ...(groupName ? { group: String(groupName) } : {}), createdAt: iso(createdAt, '') || undefined };
}

export async function fetchProfile(uid: string): Promise<UserProfile | null> {
  need();
  const row = unwrap(await supabase.from('profiles').select('*').eq('id', uid).maybeSingle());
  return row ? toProfile(row as Record<string, unknown>) : null;
}

/** Yalnız sahibinin dəyişə biləcəyi sahələr (rol bura daxil deyil; DB də bunu təmin edir). Köhnə degree/course sütunları yenilənmir. */
export async function updateOwnProfile(uid: string, data: ProfileUpdate): Promise<UserProfile> {
  need();
  const patch: Record<string, unknown> = {
    first_name: data.firstName.trim(),
    last_name: data.lastName.trim(),
  };
  if (data.studentId !== undefined) patch.student_id = data.studentId.trim() || null;
  // İxtisas və qrup birlikdə yenilənir; cütün düzgünlüyünü verilənlər bazası (groups cədvəli, FK) də yoxlayır.
  if (data.specialty !== undefined || data.group !== undefined) {
    patch.specialty = data.specialty || null;
    patch.group_name = data.group || null;
  }
  const row = unwrap(await supabase.from('profiles').update(patch).eq('id', uid).select('*').single());
  return toProfile(row as Record<string, unknown>);
}
