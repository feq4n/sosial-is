import { Check } from 'lucide-react';
import { CrudPage, type FieldDef } from '@/components/admin/CrudPage';
import { Badge } from '@/components/ui';
import { initials } from '@/components/TeamCard';
import { publicFileUrl } from '@/services/files';
import { teamAdminApi } from '@/services/teamAdmin';
import { PHOTO_ACCEPT } from '@/utils/upload';
import { isSafeHttpsUrl } from '@/utils/format';
import { useSeo } from '@/hooks/useSeo';
import type { TeamMember } from '@/types';

const urlHint = 'Könüllü. Yalnız https:// ilə başlayan ünvan';
const fields: FieldDef[] = [
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
  { name: 'sortOrder', label: 'Sıra nömrəsi', type: 'text', numeric: true, default: 1000, hint: 'Kiçik rəqəm əvvəldə görünür. Cədvəldəki oxlarla da dəyişə bilərsiniz.' },
  { name: 'active', label: 'Aktivdir (saytda göstərilsin)', type: 'checkbox', default: true },
];
const urlKeys = ['websiteUrl', 'linkedinUrl', 'instagramUrl', 'githubUrl', 'telegramUrl'] as const;

export function AdminTeam() {
  useSeo('Komandamız (admin)', undefined, { noindex: true });
  return <CrudPage<TeamMember> title="Komandamız" text="Komanda üzvlərini əlavə edin, redaktə edin, sıralayın, gizlədin və ya silin." singular="Üzv" api={teamAdminApi} fields={fields} includeDrafts sortKey="sortOrder"
    searchKeys={['fullName', 'jobTitle']}
    validate={(v) => {
      if (urlKeys.some((k) => v[k] && !isSafeHttpsUrl(String(v[k])))) return 'Keçidlər düzgün https:// ünvanı olmalıdır';
      return Number.isInteger(v.sortOrder) ? null : 'Sıra nömrəsi tam ədəd olmalıdır';
    }}
    columns={[
      { header: 'Üzv', cell: (r) => {
        const src = publicFileUrl('team-photos', r.photoPath);
        return (
          <span className="flex items-center gap-3">
            {src ? <img src={src} alt="" width={40} height={40} loading="lazy" className="size-10 rounded-full object-cover" /> : <span className="grid size-10 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand" aria-hidden>{initials(r.fullName)}</span>}
            <span className="min-w-0"><span className="block break-words font-semibold">{r.fullName}</span><span className="block text-xs text-muted">{r.jobTitle}</span></span>
          </span>
        );
      } },
      { header: 'Sıra', cell: (r) => r.sortOrder },
      { header: 'Status', cell: (r) => (r.active ? <Badge tone="success"><Check className="size-3" aria-hidden />Aktiv</Badge> : <Badge>Gizli</Badge>) },
    ]} />;
}
