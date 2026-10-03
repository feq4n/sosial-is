import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp,
} from 'firebase/firestore';
import { db, isConfigured, NotConfiguredError } from '@/lib/firebase';
import type { PersonalNote } from '@/types';

const need = () => { if (!isConfigured) throw new NotConfiguredError(); };

// ---- Saxlanılmış materiallar: users/{uid}/saved/{materialId}
export async function listSavedIds(uid: string): Promise<string[]> {
  need();
  const snap = await getDocs(collection(db, 'users', uid, 'saved'));
  return snap.docs.map((d) => d.id);
}
export async function saveMaterial(uid: string, materialId: string) {
  need();
  await setDoc(doc(db, 'users', uid, 'saved', materialId), { materialId, createdAt: serverTimestamp() });
}
export async function unsaveMaterial(uid: string, materialId: string) {
  need();
  await deleteDoc(doc(db, 'users', uid, 'saved', materialId));
}

// ---- Şəxsi qeydlər: users/{uid}/notes/{id}
export async function listNotes(uid: string): Promise<PersonalNote[]> {
  need();
  const snap = await getDocs(collection(db, 'users', uid, 'notes'));
  return snap.docs
    .map((d) => {
      const x = d.data();
      return {
        id: d.id,
        text: String(x.text ?? ''),
        day: Number(x.day ?? 1),
        createdAt: x.createdAt instanceof Timestamp ? x.createdAt.toDate().toISOString() : new Date().toISOString(),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function addNote(uid: string, text: string, day: number) {
  need();
  await addDoc(collection(db, 'users', uid, 'notes'), { text, day, createdAt: serverTimestamp() });
}
export async function removeNote(uid: string, id: string) {
  need();
  await deleteDoc(doc(db, 'users', uid, 'notes', id));
}

// ---- Bildirişlərin oxunma vəziyyəti: users/{uid}/notificationReads/{key}
export async function listReadKeys(uid: string): Promise<Set<string>> {
  need();
  const snap = await getDocs(collection(db, 'users', uid, 'notificationReads'));
  return new Set(snap.docs.map((d) => d.id));
}
export async function markRead(uid: string, keys: string[]) {
  need();
  await Promise.all(keys.map((k) => setDoc(doc(db, 'users', uid, 'notificationReads', k), { readAt: serverTimestamp() })));
}

// ---- Tədbirə qeydiyyat: events/{id}/registrations/{uid}
export async function isRegistered(eventId: string, uid: string): Promise<boolean> {
  need();
  const snap = await getDoc(doc(db, 'events', eventId, 'registrations', uid));
  return snap.exists();
}
export async function registerForEvent(eventId: string, uid: string, name: string, email: string) {
  need();
  await setDoc(doc(db, 'events', eventId, 'registrations', uid), { userId: uid, name, email, createdAt: serverTimestamp() });
}
export async function cancelRegistration(eventId: string, uid: string) {
  need();
  await deleteDoc(doc(db, 'events', eventId, 'registrations', uid));
}
