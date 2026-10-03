import { isConfigured, NotConfiguredError } from '@/lib/supabase';

/** Supabase sorğularının ortaq köməkçiləri (repository qatı). */

export const need = () => { if (!isConfigured) throw new NotConfiguredError(); };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Etibarsız UUID Postgres-də 22P02 xətası verir; bunun əvəzinə "tapılmadı" qaytarılır. */
export const isUuid = (v: string) => UUID_RE.test(v);

export interface DbResult { data: unknown; error: { code?: string; message: string } | null }

/** `{ data, error }` cavabını açır; xəta varsa onu olduğu kimi atır (friendlyError `code`-a baxır). */
export function unwrap<T = unknown>(res: DbResult): T {
  if (res.error) throw res.error;
  return res.data as T;
}

/** RLS və ya mövcud olmayan qeyd səbəbilə heç bir sətir dəyişməyibsə xəta atır (səssiz uğursuzluğun qarşısı). */
export class NoRowsError extends Error {
  code = 'no-rows';
  constructor() { super('no-rows'); this.name = 'NoRowsError'; }
}
export function expectRows(rows: unknown) {
  if (!Array.isArray(rows) || rows.length === 0) throw new NoRowsError();
}

const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/** Postgres timestamptz → ISO sətir (tətbiq tarixləri sətir kimi müqayisə edir). */
export const iso = (v: unknown, fallback = new Date(0).toISOString()) => {
  if (typeof v !== 'string' || !v) return fallback;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
};

/** snake_case sətir → camelCase obyekt; null dəyərlər buraxılır, tarix sahələri ISO-ya normallaşır. */
export function fromRow<T>(row: Record<string, unknown>, dateFields: string[] = []): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'firebase_id' || v === null || v === undefined) continue;
    const key = toCamel(k);
    out[key] = dateFields.includes(key) ? iso(v) : v;
  }
  return out as T;
}

/** camelCase obyekt → snake_case sətir; `id`, `createdAt`, undefined və boş tarixlər yazılmır. */
export function toRow(data: Record<string, unknown>, dateFields: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === 'id' || k === 'createdAt' || v === undefined) continue;
    if (dateFields.includes(k)) {
      if (typeof v === 'string' && v) out[toSnake(k)] = new Date(v).toISOString();
      continue;
    }
    out[toSnake(k)] = v;
  }
  return out;
}
