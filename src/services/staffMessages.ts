import { supabase } from '@/lib/supabase';
import { STAFF_MESSAGES_CHANGED, validateStaffMessage } from '@/lib/staffMessages';
import type { StaffMessage } from '@/types';
import { fromRow, need, unwrap } from './db';

/**
 * Tələbə → əməkdaş mesajları (cədvəl: staff_messages). İcazələr yalnız Postgres RLS ilə təmin olunur;
 * aşağıdakı `eq(...)` süzgəcləri admin-in "hamısını görür" siyasətindən gələn artıq sətirləri çıxarmaq üçündür.
 * sender_id, status, read_at, ad snapshot-ları serverdə yazılır; müştəri onları göndərə bilmir.
 */
const COLS = 'id, sender_id, recipient_id, subject, message, status, created_at, read_at, sender_name, recipient_name';
const map = (row: Record<string, unknown>) => fromRow<StaffMessage>(row, ['createdAt', 'readAt']);

export interface StaffMessageDraft { recipientId: string; subject: string; message: string }

export async function sendStaffMessage(d: StaffMessageDraft): Promise<void> {
  need();
  const subject = d.subject.trim();
  const message = d.message.trim();
  if (Object.keys(validateStaffMessage(subject, message)).length) throw Object.assign(new Error('invalid-message'), { code: 'validation_failed' });
  unwrap(await supabase.from('staff_messages').insert({ recipient_id: d.recipientId, subject, message }));
  notifyChanged();
}

/** Tələbənin göndərdiyi mesajlar (ən yenisi birinci). */
export async function listSentMessages(uid: string): Promise<StaffMessage[]> {
  need();
  const rows = unwrap(await supabase.from('staff_messages').select(COLS).eq('sender_id', uid).order('created_at', { ascending: false })) as Record<string, unknown>[];
  return rows.map(map);
}

/** Əməkdaşa göndərilən mesajlar (ən yenisi birinci). */
export async function listInboxMessages(uid: string): Promise<StaffMessage[]> {
  need();
  const rows = unwrap(await supabase.from('staff_messages').select(COLS).eq('recipient_id', uid).order('created_at', { ascending: false })) as Record<string, unknown>[];
  return rows.map(map);
}

/** Mesajı oxundu işarələyir (yalnız alıcı; read_at serverdə təyin olunur). Artıq oxunmuşdursa heç nə etmir və null qaytarır. */
export async function markStaffMessageRead(id: string): Promise<{ readAt?: string } | null> {
  need();
  const rows = unwrap(await supabase.from('staff_messages').update({ status: 'read' }).eq('id', id).eq('status', 'sent').select('id, read_at')) as Record<string, unknown>[];
  notifyChanged();
  const row = rows?.[0];
  return row ? { readAt: fromRow<{ readAt?: string }>(row, ['readAt']).readAt } : null;
}

export async function countUnreadStaffMessages(uid: string): Promise<number> {
  need();
  const res = await supabase.from('staff_messages').select('id', { count: 'exact', head: true }).eq('recipient_id', uid).eq('status', 'sent');
  if (res.error) throw res.error;
  return res.count ?? 0;
}

function notifyChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(STAFF_MESSAGES_CHANGED));
}
