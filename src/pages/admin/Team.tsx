import { useMemo } from 'react';
import { Check } from 'lucide-react';
import { CrudPage, type FieldDef } from '@/components/admin/CrudPage';
import { Badge } from '@/components/ui';
import { initials } from '@/components/TeamCard';
import { publicFileUrl } from '@/services/files';
import { teamAdminApi } from '@/services/teamAdmin';
import { listUsers } from '@/services/users';
import { useAsync } from '@/hooks/useAsync';
import { PHOTO_ACCEPT } from '@/utils/upload';
import { isSafeHttpsUrl } from '@/utils/format';
import { useSeo } from '@/hooks/useSeo';
import type { TeamMember } from '@/types';

const urlHint = 'Könüllü. Yalnız https:// ilə başlayan ünvan';
const baseFields: FieldDef[] = [
  { name: 'fullName', label: 'Ad və soyad', type: 'text', required: true, min: 2, max: 100 },
  { name: 'jobTitle', label: 'Vəzifə / rol', type: 'text', required: true, min: 2, max: 100 },
  { name: 'bio', label: 'Qısa bio', type: 'textarea', max: 600, blank: true },
  { name: 'photo', label: 'Şəkil', type: 'file', accept: PHOTO_ACCEPT, hint: 'JPG, PNG və ya WEBP, ən çox 2 MB. Redaktə zamanı yeni şəkil seçsəniz köhnəsi əvəz olunur.' },
  { name: 'removePhoto', label: 'Mövcud şəkli sil', type: 'checkbox' },
  { name: 'websiteUrl', label: 'Şəxsi sayt', type: 'url', max: 300, nullable: true, hint: urlHint },
  { name: 'linkedinUrl', label: 'LinkedIn', type: 'url', max: 300, nullable: true, hint: urlHint },
  { name: 'instagramUrl', label: 'Instagram', type: 'url', max: 300, nullable: true, hint: urlHint },
  { name: 'githubUrl', label: 'GitHub', type: 'url', max: 300, nullable: true, hint: urlHint },
  { name: 'telegramUrl', label: 'Telegram', type: 'url', max: 300, nullable: true, hint: urlHint },
  { name: 'profileId', label: 'Mesaj üçün hesab', type: 'select', nullable: true, hint: 'Könüllü. Seçilərsə, kartda «Mesaj göndər» düyməsi görünür və tələbə mesajları bu hesaba çatır. Yalnız admin və redaktor hesabları seçilə bilər.' },
  { name: 'sortOrder', label: 'Sıra nömrəsi', type: 'text', numeric: true, default: 1000, hint: 'Kiçik rəqəm əvvəldə görünür. Cədvəldəki oxlarla da dəyişə bilərsiniz.' },
  { name: 'active', label: 'Aktivdir (saytda göstərilsin)', type: 'checkbox', default: true },
];
const urlKeys = ['websiteUrl', 'linkedinUrl', 'instagramUrl', 'githubUrl', 'telegramUrl'] as const;

export function AdminTeam() {
  useSeo('Şöbə əməkdaşları (admin)', undefined, { noindex: true });
  const { data: users } = useAsync(() => listUsers(), []);
  const fields = useMemo<FieldDef[]>(() => {
    const accounts = (users ?? []).filter((u) => u.role === 'admin' || u.role === 'editor')
      .map((u) => ({ value: u.uid, label: `${u.firstName} ${u.lastName} (${u.email})` }));
    return baseFields.map((f) => (f.name !== 'profileId' ? f : {
      ...f,
      options: (v: Record<string, unknown>) => {
        const cur = typeof v.profileId === 'string' ? v.profileId : '';
        const known = !cur || accounts.some((a) => a.value === cur);
        return [{ value: '', label: 'Bağlı deyil (mesaj qəbul etmir)' }, ...(known ? [] : [{ value: cur, label: 'Cari hesab' }]), ...accounts];
      },
    }));
  }, [users]);
  return <CrudPage<TeamMember> title="Şöbə əməkdaşları" text="Şöbə rəhbərliyini, müəllimləri və əməkdaşları əlavə edin, redaktə edin, sıralayın, gizlədin və ya silin." singular="Əməkdaş" api={teamAdminApi} fields={fields} includeDrafts sortKey="sortOrder"
    searchKeys={['fullName', 'jobTitle']}
    validate={(v) => {
      if (urlKeys.some((k) => v[k] && !isSafeHttpsUrl(String(v[k])))) return 'Keçidlər düzgün https:// ünvanı olmalıdır';
      return Number.isInteger(v.sortOrder) ? null : 'Sıra nömrəsi tam ədəd olmalıdır';
    }}
    columns={[
      { header: 'Əməkdaş', cell: (r) => {
        const src = publicFileUrl('team-photos', r.photoPath);
        return (
          <span className="flex items-center gap-3">
            {src ? <img src={src} alt="" width={40} height={40} loading="lazy" className="size-10 rounded-full object-cover" /> : <span className="grid size-10 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand" aria-hidden>{initials(r.fullName)}</span>}
            <span className="min-w-0"><span className="block break-words font-semibold">{r.fullName}</span><span className="block text-xs text-muted">{r.jobTitle}</span></span>
          </span>
        );
      } },
      { header: 'Sıra', cell: (r) => r.sortOrder },
      { header: 'Mesaj', cell: (r) => (r.profileId ? <Badge tone="brand">Qəbul edir</Badge> : <Badge>Bağlı deyil</Badge>) },
      { header: 'Status', cell: (r) => (r.active ? <Badge tone="success"><Check className="size-3" aria-hidden />Aktiv</Badge> : <Badge>Gizli</Badge>) },
    ]} />;
}
