import { supabase, isConfigured } from '@/lib/supabase';
import type { Announcement, EventItem, FaqItem, FooterLink, Material, TeamMember } from '@/types';
import { sampleAnnouncements, sampleEvents, sampleMaterials } from '@/data/sample';
import { faq as defaultFaq } from '@/data/content';
import { removeStoredFile } from './files';
import { expectRows, fromRow, isUuid, need, toRow, unwrap } from './db';

type WithId = { id: string };

export interface Resource<T extends WithId> {
  list: (opts?: { includeDrafts?: boolean }) => Promise<T[]>;
  get: (id: string) => Promise<T | null>;
  create: (data: Omit<T, 'id'>) => Promise<string>;
  update: (id: string, data: Partial<Omit<T, 'id'>>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function makeResource<T extends WithId>(
  table: string,
  dateFields: string[],
  sample: T[],
  sort: (a: T, b: T) => number,
  publicFilter?: { column: string; value: unknown },
): Resource<T> {
  const dates = [...dateFields, 'createdAt'];
  const map = (row: Record<string, unknown>) => fromRow<T>(row, dates);
  return {
    async list(opts) {
      if (!isConfigured) return [...sample].sort(sort);
      let q = supabase.from(table).select('*');
      if (publicFilter && !opts?.includeDrafts) q = q.eq(publicFilter.column, publicFilter.value);
      const rows = unwrap(await q) as Record<string, unknown>[];
      // Sıralama əvvəlki kimi istemci tərəfdə aparılır (davranış dəyişmir).
      return rows.map(map).sort(sort);
    },
    async get(id) {
      if (!isConfigured) return sample.find((s) => s.id === id) ?? null;
      if (!isUuid(id)) return null;
      const row = unwrap(await supabase.from(table).select('*').eq('id', id).maybeSingle());
      return row ? map(row as Record<string, unknown>) : null;
    },
    async create(data) {
      need();
      const row = unwrap(await supabase.from(table).insert(toRow(data as Record<string, unknown>, dateFields)).select('id').single());
      return (row as { id: string }).id;
    },
    async update(id, data) {
      need();
      const rows = unwrap(await supabase.from(table).update(toRow(data as Record<string, unknown>, dateFields)).eq('id', id).select('id'));
      expectRows(rows);
    },
    async remove(id) {
      need();
      const rows = unwrap(await supabase.from(table).delete().eq('id', id).select('id'));
      expectRows(rows);
    },
  };
}

const byNewest = <T extends { createdAt: string }>(a: T, b: T) => b.createdAt.localeCompare(a.createdAt);

export const announcementsApi = makeResource<Announcement>(
  'announcements', [], sampleAnnouncements, byNewest, { column: 'published', value: true },
);
const baseMaterials = makeResource<Material>('materials', [], sampleMaterials, byNewest);
/** Material silinəndə (və ya fayl dəyişəndə) Storage obyekti də təmizlənir; sətir silinməsə fayla toxunulmur. */
export const materialsApi: Resource<Material> = {
  ...baseMaterials,
  async remove(id) {
    need();
    const row = unwrap(await supabase.from('materials').select('file_path').eq('id', id).maybeSingle()) as { file_path?: string | null } | null;
    await baseMaterials.remove(id);
    if (row?.file_path) await removeStoredFile('materials', row.file_path);
  },
};
export const eventsApi = makeResource<EventItem>(
  'events', ['startsAt', 'endsAt'], sampleEvents, (a, b) => a.startsAt.localeCompare(b.startsAt),
);
export const isSampleMode = !isConfigured;

const bySort = <T extends { sortOrder: number; createdAt: string }>(a: T, b: T) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt);

const sampleFaq: FaqItem[] = defaultFaq.map((f, i) => ({ id: `sample-faq-${i}`, question: f.q, answer: f.a, sortOrder: i + 1, active: true, createdAt: new Date(0).toISOString() }));
export const faqApi = makeResource<FaqItem>('faq_items', [], sampleFaq, bySort, { column: 'active', value: true });

export const defaultFooterLinks: FooterLink[] = [
  ['Elanlar', '/announcements'], ['Materiallar', '/materials'], ['Dərs cədvəli', '/schedule'], ['Tədbirlər', '/events'],
  ['İxtisaslar', '/about'], ['Şöbə əməkdaşları', '/staff'], ['Əlaqə', '/contact'],
].map(([label, url], i) => ({ id: `default-${i}`, label, url, sortOrder: i + 1, active: true, createdAt: new Date(0).toISOString() }));
export const footerLinksApi = makeResource<FooterLink>('footer_links', [], defaultFooterLinks, bySort, { column: 'active', value: true });

export const teamApi = makeResource<TeamMember>('team_members', [], [], bySort, { column: 'active', value: true });
