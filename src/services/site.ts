import { useEffect, useSyncExternalStore } from 'react';
import { isConfigured, supabase } from '@/lib/supabase';
import { contact as envContact, SITE_NAME } from '@/config/site';
import { defaultFooterLinks, footerLinksApi } from './content';
import { need, unwrap } from './db';
import type { FooterLink } from '@/types';

export interface SiteSettings {
  siteName: string;
  homeTitle: string;
  homeText: string;
  aboutTitle: string;
  aboutText: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  footerText: string;
}

export const defaultSettings: SiteSettings = {
  siteName: SITE_NAME,
  homeTitle: 'Kollec tələbəsinin gündəlik iş masası',
  homeText: 'Elanlar, dərs materialları, cədvəl və tədbirlər bir səhifədə. Daxil olun, materialları yadda saxlayın, bildirişləri qaçırmayın.',
  aboutTitle: 'Platformanın məqsədi',
  aboutText: '“Sosial İş” platforması Sosial İş, KŞATS və KŞŞİ ixtisaslarının tələbələrinin tədris həyatı ilə bağlı bütün məlumatlara bir yerdən, sürətli və rahat çıxışını təmin edir. Məzmunu administratorlar idarə edir.',
  contactEmail: '',
  contactPhone: '',
  contactAddress: '',
  footerText: 'Sosial İş, KŞATS və KŞŞİ ixtisaslarının tələbələri üçün elanlar, dərs materialları, cədvəl və tədbirlər bir yerdə.',
};

/** camelCase sahə → site_settings.key (DB-dəki CHECK yalnız bu açarlara icazə verir). */
export const SETTING_KEYS: Record<keyof SiteSettings, string> = {
  siteName: 'site_name', homeTitle: 'home_title', homeText: 'home_text', aboutTitle: 'about_title', aboutText: 'about_text',
  contactEmail: 'contact_email', contactPhone: 'contact_phone', contactAddress: 'contact_address', footerText: 'footer_text',
};

/** Kiçik paylaşılan yaddaş: səhifələr arasında bir dəfə yüklənir, admin saxlayanda yenilənir. */
function createStore<T>(initial: T, fetcher: () => Promise<T>) {
  let current = initial;
  let loaded = false;
  let inflight: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
  const get = () => current;
  const load = (force = false): Promise<void> => {
    if (!force && (loaded || inflight)) return inflight ?? Promise.resolve();
    inflight = fetcher().then((v) => { current = v; loaded = true; listeners.forEach((l) => l()); }).catch(() => { /* ilkin dəyərlə davam */ }).finally(() => { inflight = null; });
    return inflight;
  };
  const use = (): T => {
    const v = useSyncExternalStore(subscribe, get, get);
    useEffect(() => { void load(); }, []);
    return v;
  };
  return { get, load, use };
}

const settingsStore = createStore<SiteSettings>(defaultSettings, async () => {
  if (!isConfigured) return defaultSettings;
  const rows = unwrap(await supabase.from('site_settings').select('key, value')) as { key: string; value: string }[];
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const out = { ...defaultSettings };
  for (const [field, key] of Object.entries(SETTING_KEYS) as [keyof SiteSettings, string][]) {
    const v = byKey.get(key);
    if (typeof v === 'string') out[field] = v;
  }
  return out;
});

export const getSiteSettings = settingsStore.get;
export const loadSiteSettings = settingsStore.load;
export const useSiteSettings = settingsStore.use;

/** Sayt sahibinin əlaqə məlumatı: admin paneldəki dəyər, yoxdursa mühit dəyişəni (VITE_CONTACT_*). */
export function useContactInfo() {
  const s = useSiteSettings();
  const email = s.contactEmail.trim() || envContact.email || '';
  const phone = s.contactPhone.trim() || envContact.phone || '';
  const address = s.contactAddress.trim() || envContact.address || '';
  return { email, phone, address, has: Boolean(email || phone || address) };
}

export async function saveSiteSettings(patch: Partial<SiteSettings>) {
  need();
  const rows = (Object.entries(patch) as [keyof SiteSettings, string][]).map(([k, v]) => ({ key: SETTING_KEYS[k], value: String(v ?? '').trim() }));
  if (!rows.length) return;
  /* upsert işlətmirik: PostgREST `ON CONFLICT DO UPDATE SET key = ..., value = ...` yazır, `key` sütununa isə UPDATE icazəsi verilməyib (yalnız `value`).
     Ona görə əvvəl yalnız `value` yenilənir; sətir yoxdursa (köhnə baza) əlavə olunur. */
  for (const r of rows) {
    const updated = unwrap(await supabase.from('site_settings').update({ value: r.value }).eq('key', r.key).select('key')) as unknown[] | null;
    if (!updated?.length) unwrap(await supabase.from('site_settings').insert(r));
  }
  await loadSiteSettings(true);
}

const footerStore = createStore<FooterLink[]>(defaultFooterLinks, async () => {
  if (!isConfigured) return defaultFooterLinks;
  return footerLinksApi.list();
});
export const useFooterLinks = footerStore.use;
export const reloadFooterLinks = () => footerStore.load(true);

/** Footer keçidi: daxili yol ("/yol") və ya https://. "//", "javascript:" və s. rədd edilir. */
export const isSafeFooterUrl = (u: string) => /^\/([^/\s\\][^\s\\]*)?$/.test(u) || /^https:\/\/[^\s\\]+$/.test(u);
