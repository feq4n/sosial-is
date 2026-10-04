import { supabase } from '@/lib/supabase';
import type { Material } from '@/types';
import { materialsApi, type Resource } from './content';
import { expectRows, need, toRow, unwrap } from './db';
import { removeStoredFile, uploadFile } from './files';
import { checkMaterialFile } from '@/utils/upload';

type Draft = Partial<Omit<Material, 'id'>> & { file?: File };

async function withFile(file: File) {
  const checked = await checkMaterialFile(file);
  const path = await uploadFile('materials', file, checked.ext);
  return {
    path,
    fields: { filePath: path, fileName: file.name, fileSize: file.size, mimeType: checked.mime, fileType: checked.fileType, url: null },
  };
}

const NO_FILE = { filePath: null, fileName: null, fileSize: null, mimeType: null };

/**
 * Admin üçün material API: fayl yoxlanılır (uzantı + MIME + ilk baytlar), Storage-ə yüklənir, sonra DB sətri yazılır.
 * DB yazısı uğursuz olarsa yüklənmiş fayl geri silinir; köhnə fayl yalnız yeni sətir uğurla yazıldıqdan sonra silinir.
 * Server tərəfində ölçü/MIME/uzantı/rol yenə də Storage bucket, storage siyasətləri və materials tətiyi ilə yoxlanılır.
 */
export const materialsAdminApi: Resource<Material> = {
  list: (opts) => materialsApi.list(opts),
  get: (id) => materialsApi.get(id),
  remove: (id) => materialsApi.remove(id),

  async create(data) {
    need();
    const { file, ...rest } = data as Draft;
    let uploaded: string | null = null;
    try {
      const extra: Record<string, unknown> = file ? (await withFile(file)).fields : {};
      if (file) uploaded = String(extra.filePath);
      const row = unwrap(await supabase.from('materials').insert(toRow({ ...rest, ...extra, ...(file ? {} : NO_FILE) } as Record<string, unknown>)).select('id').single());
      return (row as { id: string }).id;
    } catch (e) {
      await removeStoredFile('materials', uploaded);
      throw e;
    }
  },

  async update(id, data) {
    need();
    const { file, ...rest } = data as Draft;
    const old = unwrap(await supabase.from('materials').select('file_path').eq('id', id).maybeSingle()) as { file_path?: string | null } | null;
    let uploaded: string | null = null;
    try {
      let extra: Record<string, unknown> = {};
      if (file) { const up = await withFile(file); uploaded = up.path; extra = up.fields; }
      else if (rest.url) extra = { ...NO_FILE };
      const rows = unwrap(await supabase.from('materials').update(toRow({ ...rest, ...extra } as Record<string, unknown>)).eq('id', id).select('id'));
      expectRows(rows);
    } catch (e) {
      await removeStoredFile('materials', uploaded);
      throw e;
    }
    if (old?.file_path && (file || rest.url)) await removeStoredFile('materials', old.file_path);
  },
};
