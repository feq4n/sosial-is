import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { isConfigured, supabase } from '@/lib/supabase';
import { defaultSpecialties, type SpecialtyInfo } from '@/data/specialties';
import { expectRows, fromRow, need, unwrap } from './db';
import type { Resource } from './content';

/** Admin CrudPage `id` tələb edir; ixtisasın açarı `code`-dur. */
export type SpecialtyRecord = SpecialtyInfo & { id: string };

const bySort = (a: SpecialtyInfo, b: SpecialtyInfo) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code, 'az');

export const rowToSpecialty = (row: Record<string, unknown>): SpecialtyInfo => {
  const s = fromRow<SpecialtyInfo>(row);
  return { ...s, description: s.description ?? '', degree: s.degree ?? '', admissionConfirmed: Boolean(s.admissionConfirmed), active: s.active !== false, sortOrder: Number(s.sortOrder ?? 0) };
};

/** Admin tərəfindən redaktə olunan sütunlar (code dəyişmir). Boş dəyər `null` kimi yazılır. */
const EDITABLE: [keyof SpecialtyInfo, string][] = [
  ['name', 'name'], ['fullName', 'full_name'], ['programCode', 'program_code'], ['description', 'description'], ['degree', 'degree'],
  ['duration', 'duration'], ['semesters', 'semesters'], ['credits', 'credits'],
  ['scoreGeneralState', 'score_general_state'], ['scoreGeneralPaid', 'score_general_paid'],
  ['scoreCompleteState', 'score_complete_state'], ['scoreCompletePaid', 'score_complete_paid'], ['scoreCompletePaidPart', 'score_complete_paid_part'],
  ['admissionConfirmed', 'admission_confirmed'], ['sourceUrl', 'source_url'], ['active', 'active'], ['sortOrder', 'sort_order'],
];
const REQUIRED_TEXT = new Set(['name', 'full_name', 'description', 'degree']);

export function toSpecialtyRow(data: Partial<SpecialtyInfo>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, col] of EDITABLE) {
    if (!(k in data)) continue;
    const v = data[k];
    out[col] = v === undefined || v === '' ? (REQUIRED_TEXT.has(col) ? '' : null) : v;
  }
  return out;
}

/** Bütün ixtisaslar (admin üçün qeyri-aktivlər də daxil). Supabase xətası zamanı ilkin məlumata qayıdır. */
async function fetchAll(): Promise<SpecialtyInfo[]> {
  if (!isConfigured) return defaultSpecialties;
  try {
    const rows = unwrap(await supabase.from('specialties').select('*')) as Record<string, unknown>[];
    return rows.length ? rows.map(rowToSpecialty).sort(bySort) : defaultSpecialties;
  } catch {
    // Miqrasiya hələ tətbiq olunmayıb və ya şəbəkə xətası: sayt ilkin məlumatla işləməyə davam edir.
    return defaultSpecialties;
  }
}

let current: SpecialtyInfo[] = defaultSpecialties;
let inflight: Promise<void> | null = null;
let loaded = false;
const listeners = new Set<() => void>();

export const getSpecialties = () => current;
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function loadSpecialties(force = false): Promise<void> {
  if (!force && (loaded || inflight)) return inflight ?? Promise.resolve();
  inflight = fetchAll().then((list) => { current = list; loaded = true; listeners.forEach((l) => l()); }).finally(() => { inflight = null; });
  return inflight;
}

/** Aktiv ixtisaslar (sıralanmış). İlk renderdə ilkin məlumat, sonra Supabase-dən gələn məlumat. */
export function useSpecialties(): SpecialtyInfo[] {
  const all = useSyncExternalStore(subscribe, getSpecialties, getSpecialties);
  useEffect(() => { void loadSpecialties(); }, []);
  return useMemo(() => all.filter((s) => s.active), [all]);
}

export const findSpecialty = (code: string | undefined | null) => (code ? current.find((s) => s.code === code) : undefined);

/** Admin paneli üçün Resource: yalnız siyahı + yeniləmə (yeni ixtisas/silmə SQL ilə, qruplara bağlı olduğu üçün). */
export const specialtiesAdminApi: Resource<SpecialtyRecord> = {
  async list() {
    const all = await (isConfigured ? (async () => {
      const rows = unwrap(await supabase.from('specialties').select('*')) as Record<string, unknown>[];
      return rows.map(rowToSpecialty).sort(bySort);
    })() : Promise.resolve(defaultSpecialties));
    return all.map((s) => ({ ...s, id: s.code }));
  },
  async get(id) { return (await this.list()).find((s) => s.id === id) ?? null; },
  async create() { throw new Error('Yeni ixtisas yalnız SQL vasitəsilə əlavə olunur'); },
  async update(id, data) {
    need();
    const rows = unwrap(await supabase.from('specialties').update(toSpecialtyRow(data)).eq('code', id).select('code'));
    expectRows(rows);
    await loadSpecialties(true);
  },
  async remove() { throw new Error('İxtisas silinmir; “Aktiv” seçimini söndürün'); },
};
