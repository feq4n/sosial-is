import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, Timestamp, updateDoc, where,
  type DocumentData,
} from 'firebase/firestore';
import { db, isConfigured, NotConfiguredError } from '@/lib/firebase';
import type { Announcement, EventItem, Material } from '@/types';
import { sampleAnnouncements, sampleEvents, sampleMaterials } from '@/data/sample';

type WithId = { id: string };

/** Firestore Timestamp → ISO sətir (UI üçün) */
function fromDoc<T extends WithId>(id: string, data: DocumentData, dateFields: string[]): T {
  const out: DocumentData = { ...data, id };
  for (const [k, v] of Object.entries(data)) {
    if (v instanceof Timestamp) out[k] = v.toDate().toISOString();
  }
  void dateFields;
  return out as T;
}

/** ISO sətir → Firestore Timestamp (yazmaq üçün) */
function toDocData(data: Record<string, unknown>, dateFields: string[]): DocumentData {
  const out: DocumentData = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === 'id' || v === undefined) continue;
    out[k] = dateFields.includes(k) && typeof v === 'string' && v ? Timestamp.fromDate(new Date(v)) : v;
  }
  return out;
}

export interface Resource<T extends WithId> {
  list: (opts?: { includeDrafts?: boolean }) => Promise<T[]>;
  get: (id: string) => Promise<T | null>;
  create: (data: Omit<T, 'id'>) => Promise<string>;
  update: (id: string, data: Partial<Omit<T, 'id'>>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

function makeResource<T extends WithId>(
  name: string,
  dateFields: string[],
  sample: T[],
  sort: (a: T, b: T) => number,
  publicFilter?: { field: string; value: unknown },
): Resource<T> {
  return {
    async list(opts) {
      if (!isConfigured) return [...sample].sort(sort);
      const col = collection(db, name);
      // Sıralama istemci tərəfdə aparılır: bu, kompozit indeks tələbini aradan qaldırır.
      const q = publicFilter && !opts?.includeDrafts ? query(col, where(publicFilter.field, '==', publicFilter.value)) : col;
      const snap = await getDocs(q);
      return snap.docs.map((d) => fromDoc<T>(d.id, d.data(), dateFields)).sort(sort);
    },
    async get(id) {
      if (!isConfigured) return sample.find((s) => s.id === id) ?? null;
      const snap = await getDoc(doc(db, name, id));
      if (!snap.exists()) return null;
      return fromDoc<T>(snap.id, snap.data(), dateFields);
    },
    async create(data) {
      if (!isConfigured) throw new NotConfiguredError();
      const payload = toDocData({ ...data, createdAt: new Date().toISOString() }, [...dateFields, 'createdAt']);
      const ref = await addDoc(collection(db, name), payload);
      return ref.id;
    },
    async update(id, data) {
      if (!isConfigured) throw new NotConfiguredError();
      await updateDoc(doc(db, name, id), toDocData(data as Record<string, unknown>, dateFields));
    },
    async remove(id) {
      if (!isConfigured) throw new NotConfiguredError();
      await deleteDoc(doc(db, name, id));
    },
  };
}

const byNewest = <T extends { createdAt: string }>(a: T, b: T) => b.createdAt.localeCompare(a.createdAt);

export const announcementsApi = makeResource<Announcement>(
  'announcements', [], sampleAnnouncements, byNewest, { field: 'published', value: true },
);
export const materialsApi = makeResource<Material>('materials', [], sampleMaterials, byNewest);
export const eventsApi = makeResource<EventItem>(
  'events', ['startsAt', 'endsAt'], sampleEvents, (a, b) => a.startsAt.localeCompare(b.startsAt),
);
export const isSampleMode = !isConfigured;
