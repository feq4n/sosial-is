import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, isConfigured, NotConfiguredError } from '@/lib/firebase';

export interface ContactPayload { name: string; email: string; subject: string; message: string }

/** Mesaj Firestore-da `contact_messages` kolleksiyasına yazılır; yalnız admin oxuya bilər. */
export async function sendContactMessage(p: ContactPayload) {
  if (!isConfigured) throw new NotConfiguredError();
  await addDoc(collection(db, 'contact_messages'), {
    name: p.name.trim(),
    email: p.email.trim(),
    subject: p.subject.trim(),
    message: p.message.trim(),
    status: 'new',
    createdAt: serverTimestamp(),
  });
}
