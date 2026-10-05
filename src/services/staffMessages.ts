import { supabase } from '@/lib/supabase';
import { STAFF_MESSAGES_CHANGED, normalizeSpaces, validateStaffMessageFields } from '@/lib/staffMessages';
import type { StaffMessage } from '@/types';
import { fromRow, need, unwrap } from './db';

const COLS = 'id, sender_id, recipient_id, subject, message, status, created_at, read_at, sender_name, sender_group, recipient_name';
const map = (row: Record<string, unknown>) => fromRow<StaffMessage>(row, ['createdAt', 'readAt']);

export interface StaffMessageDraft { recipientId: string; senderName: string; senderGroup: string; subject: string; message: string }

export async function sendStaffMessage(d: StaffMessageDraft): Promise<void> {
  need();
  const draft: StaffMessageDraft = {
    recipientId: d.recipientId,
    senderName: normalizeSpaces(d.senderName),
    senderGroup: normalizeSpaces(d.senderGroup),
    subject: d.subject.trim(),
    message: d.message.trim(),
  };
  if (Object.keys(validateStaffMessageFields(draft)).length) throw Object.assign(new Error('invalid-message'), { code: 'validation_failed' });
  unwrap(await supabase.rpc('send_staff_message', {
    p_recipient_id: draft.recipientId,
    p_subject: draft.subject,
    p_message: draft.message,
    p_sender_name: draft.senderName,
    p_sender_group: draft.senderGroup,
  }));
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
