import { Check } from 'lucide-react';
import { CrudPage, type FieldDef } from '@/components/admin/CrudPage';
import { Badge } from '@/components/ui';
import { specialtiesAdminApi, type SpecialtyRecord } from '@/services/specialties';
import { useSeo } from '@/hooks/useSeo';

const SCORE_RE = /^\d{1,3}([.,]\d{1,2})?$/;
const scoreKeys = ['scoreGeneralState', 'scoreGeneralPaid', 'scoreCompleteState', 'scoreCompletePaid', 'scoreCompletePaidPart'] as const;

const fields: FieldDef[] = [
  { name: 'name', label: 'Qısa ad', type: 'text', required: true, max: 80 },
  { name: 'fullName', label: 'Tam ad (açılış)', type: 'text', required: true, max: 160 },
  { name: 'programCode', label: 'İxtisas kodu', type: 'text', max: 10, hint: 'Yalnız rəqəmlər, məs. 040713. Rəsmi mənbədə təsdiqlənməyibsə boş buraxın.' },
  { name: 'description', label: 'Təsvir', type: 'textarea', required: true, max: 600 },
  { name: 'degree', label: 'Təhsil pilləsi', type: 'text', required: true, max: 60 },
  { name: 'duration', label: 'Təhsil müddəti (il)', type: 'text', max: 30, hint: 'Məs. 2-3 (saytda “il” əlavə olunur)' },
  { name: 'semesters', label: 'Semestr sayı', type: 'text', max: 30, hint: 'Məs. 4-6' },
  { name: 'credits', label: 'Kredit saatı', type: 'text', max: 30, hint: 'Məs. 120' },
  { name: 'scoreGeneralState', label: 'Ümumi orta bazası: Dövlət sifarişi (bal)', type: 'text', max: 6, hint: 'Məs. 100,7' },
  { name: 'scoreGeneralPaid', label: 'Ümumi orta bazası: Ödənişli (bal)', type: 'text', max: 6 },
  { name: 'scoreCompleteState', label: 'Tam orta bazası: Dövlət sifarişi (bal)', type: 'text', max: 6 },
  { name: 'scoreCompletePaid', label: 'Tam orta bazası: Ödənişli, əyani (bal)', type: 'text', max: 6 },
  { name: 'scoreCompletePaidPart', label: 'Tam orta bazası: Ödənişli, qiyabi (bal)', type: 'text', max: 6 },
  { name: 'admissionConfirmed', label: 'Qəbul məlumatları rəsmi mənbədə təsdiqlənib (saytda göstərilsin)', type: 'checkbox' },
  { name: 'sourceUrl', label: 'Rəsmi mənbə keçidi', type: 'url', max: 500 },
  { name: 'active', label: 'Aktivdir (saytda və qeydiyyatda görünür)', type: 'checkbox', default: true },
  { name: 'sortOrder', label: 'Sıra nömrəsi', type: 'text', numeric: true, default: 0 },
];

export function AdminSpecialties() {
  useSeo('İxtisaslar (admin)', undefined, { noindex: true });
  return <CrudPage<SpecialtyRecord> title="İxtisaslar" text="ADPK ixtisaslarının adı, kodu, təsviri, müddəti, krediti və təsdiqlənmiş qəbul məlumatları. Yeni ixtisas qrup cədvəlinə bağlı olduğu üçün yalnız SQL ilə əlavə olunur."
    singular="İxtisas" api={specialtiesAdminApi} fields={fields} canCreate={false} canDelete={false} searchKeys={['code', 'name', 'fullName', 'programCode']}
    validate={(v) => {
      if (v.programCode && !/^\d{4,10}$/.test(String(v.programCode))) return 'İxtisas kodu 4–10 rəqəmdən ibarət olmalıdır';
      if (scoreKeys.some((k) => v[k] && !SCORE_RE.test(String(v[k])))) return 'Qəbul balı rəqəm olmalıdır (məs. 100,7)';
      if (!Number.isInteger(v.sortOrder)) return 'Sıra nömrəsi tam ədəd olmalıdır';
      return null;
    }}
    columns={[
      { header: 'Kod', cell: (r) => <span className="font-semibold">{r.programCode ?? '—'}</span> },
      { header: 'İxtisas', cell: (r) => <span className="break-words font-semibold">{r.fullName}<span className="block text-xs font-normal text-muted">{r.code}</span></span> },
      { header: 'Qəbul məlumatı', cell: (r) => (r.admissionConfirmed ? <Badge tone="success"><Check className="size-3" aria-hidden />Təsdiqlənib</Badge> : <Badge>Gizli</Badge>) },
      { header: 'Status', cell: (r) => (r.active ? <Badge tone="success">Aktiv</Badge> : <Badge>Qeyri-aktiv</Badge>) },
    ]} />;
}
