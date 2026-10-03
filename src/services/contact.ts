import { supabase } from '@/lib/supabase';
import { need, unwrap } from './db';

export interface ContactPayload { name: string; email: string; subject: string; message: string }

/**
 * Mesaj `contact_messages` cədvəlinə yazılır; yalnız admin oxuya bilər.
 * `status` və `created_at` serverdə təyin olunur (müştəriyə bu sütunlara yazmaq icazəsi verilmir).
 */
export async function sendContactMessage(p: ContactPayload) {
  need();
  unwrap(await supabase.from('contact_messages').insert({
    name: p.name.trim(),
    email: p.email.trim(),
    subject: p.subject.trim(),
    message: p.message.trim(),
  }));
}
