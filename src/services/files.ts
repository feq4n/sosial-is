import { supabase, isConfigured } from '@/lib/supabase';
import { need, unwrap } from './db';
import { friendlyUploadMessage, UploadError } from '@/utils/upload';

export type Bucket = 'materials' | 'team-photos';

const uuid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`);

/** Faylı təsadüfi UUID adı ilə yükləyir (orijinal ad yalnız metadata kimi saxlanılır). Qaytarılan yol DB sütununa yazılır. */
export async function uploadFile(bucket: Bucket, file: File, ext: string): Promise<string> {
  need();
  const path = `${uuid()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type || undefined, upsert: false, cacheControl: '3600' });
  if (error) throw new UploadError(friendlyUploadMessage(error));
  return path;
}

/** Təmizləmə üçün: xəta olarsa səssiz keçir (artıq obyekt qala bilər, sətir isə yazılmayıb). */
export async function removeStoredFile(bucket: Bucket, path: string | null | undefined) {
  if (!isConfigured || !path) return;
  try { await supabase.storage.from(bucket).remove([path]); } catch { /* sakit */ }
}

export function publicFileUrl(bucket: Bucket, path: string | null | undefined, downloadName?: string): string | undefined {
  if (!isConfigured || !path) return undefined;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path, downloadName ? { download: downloadName } : undefined);
  return data?.publicUrl;
}

export { unwrap };
