import { supabase } from '@/lib/supabase';
import type { TeamMember } from '@/types';
import { teamApi, type Resource } from './content';
import { expectRows, need, toRow, unwrap } from './db';
import { removeStoredFile, uploadFile } from './files';
import { checkPhotoFile } from '@/utils/upload';

type Draft = Partial<Omit<TeamMember, 'id'>> & { photo?: File; removePhoto?: boolean };

/** Komanda üzvü: şəkil yoxlanılır (uzantı, MIME, ilk baytlar, ≤2 MB), `team-photos` bucket-inə yüklənir; xəta olarsa geri silinir. */
export const teamAdminApi: Resource<TeamMember> = {
  list: (o) => teamApi.list(o),
  get: (id) => teamApi.get(id),

  async create(data) {
    need();
    const { photo, removePhoto, ...rest } = data as Draft;
    void removePhoto;
    let uploaded: string | null = null;
    try {
      if (photo) { const c = await checkPhotoFile(photo); uploaded = await uploadFile('team-photos', photo, c.ext); }
      const row = unwrap(await supabase.from('team_members').insert(toRow({ ...rest, photoPath: uploaded ?? undefined } as Record<string, unknown>)).select('id').single());
      return (row as { id: string }).id;
    } catch (e) {
      await removeStoredFile('team-photos', uploaded);
      throw e;
    }
  },

  async update(id, data) {
    need();
    const { photo, removePhoto, ...rest } = data as Draft;
    const old = unwrap(await supabase.from('team_members').select('photo_path').eq('id', id).maybeSingle()) as { photo_path?: string | null } | null;
    let uploaded: string | null = null;
    try {
      if (photo) { const c = await checkPhotoFile(photo); uploaded = await uploadFile('team-photos', photo, c.ext); }
      const patch: Record<string, unknown> = { ...rest };
      if (uploaded) patch.photoPath = uploaded;
      else if (removePhoto) patch.photoPath = null;
      expectRows(unwrap(await supabase.from('team_members').update(toRow(patch)).eq('id', id).select('id')));
    } catch (e) {
      await removeStoredFile('team-photos', uploaded);
      throw e;
    }
    if (old?.photo_path && (uploaded || removePhoto)) await removeStoredFile('team-photos', old.photo_path);
  },

  async remove(id) {
    need();
    const old = unwrap(await supabase.from('team_members').select('photo_path').eq('id', id).maybeSingle()) as { photo_path?: string | null } | null;
    expectRows(unwrap(await supabase.from('team_members').delete().eq('id', id).select('id')));
    if (old?.photo_path) await removeStoredFile('team-photos', old.photo_path);
  },
};
