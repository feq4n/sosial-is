import { collection, deleteDoc, doc, getDocs, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import { db, isConfigured, NotConfiguredError } from '@/lib/firebase';
import type { ContactMessage, Role, UserProfile } from '@/types';

const need = () => { if (!isConfigured) throw new NotConfiguredError(); };
const iso = (v: unknown) => (v instanceof Timestamp ? v.toDate().toISOString() : new Date(0).toISOString());

export async function listUsers(): Promise<UserProfile[]> {
  need();
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs
    .map((d) => ({ ...(d.data() as Omit<UserProfile, 'uid' | 'createdAt'>), uid: d.id, createdAt: iso(d.data().createdAt) }))
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

export async function setUserRole(uid: string, role: Role) {
  need();
  await updateDoc(doc(db, 'users', uid), { role, updatedAt: serverTimestamp() });
}

export async function listMessages(): Promise<ContactMessage[]> {
  need();
  const snap = await getDocs(collection(db, 'contact_messages'));
  return snap.docs
    .map((d) => ({ ...(d.data() as Omit<ContactMessage, 'id' | 'createdAt'>), id: d.id, createdAt: iso(d.data().createdAt) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function markMessageRead(id: string, status: 'new' | 'read') {
  need();
  await updateDoc(doc(db, 'contact_messages', id), { status });
}

export async function deleteMessage(id: string) {
  need();
  await deleteDoc(doc(db, 'contact_messages', id));
}
