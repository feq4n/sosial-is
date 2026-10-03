import { supabase } from '@/lib/supabase';
import type { ContactMessage, Role, UserProfile } from '@/types';
import { expectRows, fromRow, need, unwrap } from './db';
import { toProfile } from './profiles';

/** Admin əməliyyatları. Server tərəfdə yalnız admin üçün RLS siyasətləri icazə verir. */
export async function listUsers(): Promise<UserProfile[]> {
  need();
  const rows = unwrap(await supabase.from('profiles').select('*').order('created_at', { ascending: false })) as Record<string, unknown>[];
  return rows.map(toProfile);
}

export async function setUserRole(uid: string, role: Role) {
  need();
  const rows = unwrap(await supabase.from('profiles').update({ role }).eq('id', uid).select('id'));
  expectRows(rows);
}

export async function listMessages(): Promise<ContactMessage[]> {
  need();
  const rows = unwrap(await supabase.from('contact_messages').select('*').order('created_at', { ascending: false })) as Record<string, unknown>[];
  return rows.map((r) => fromRow<ContactMessage>(r, ['createdAt']));
}

export async function markMessageRead(id: string, status: 'new' | 'read') {
  need();
  expectRows(unwrap(await supabase.from('contact_messages').update({ status }).eq('id', id).select('id')));
}

export async function deleteMessage(id: string) {
  need();
  expectRows(unwrap(await supabase.from('contact_messages').delete().eq('id', id).select('id')));
}
