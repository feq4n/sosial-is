import { Check, Star } from 'lucide-react';
import { announcementsApi, eventsApi } from '@/services/content';
import { materialsAdminApi } from '@/services/materialsAdmin';
import { useSpecialties } from '@/services/specialties';
import { groupsOfSpecialty, isValidPlacement, specialtyFullLabel, specialtyLabel } from '@/data/timetable';
import { formatBytes, MATERIAL_ACCEPT, MATERIAL_FORMATS_LABEL } from '@/utils/upload';
import { CrudPage, type FieldDef } from '@/components/admin/CrudPage';
import { Badge } from '@/components/ui';
import { announcementCategories, eventCategories, materialTypes } from '@/utils/labels';
import { formatDate, formatDateTime, isSafeHttpsUrl } from '@/utils/format';
import { useSeo } from '@/hooks/useSeo';
import type { Announcement, EventItem, Material } from '@/types';

const opts = (o: Record<string, string>) => Object.entries(o).map(([value, label]) => ({ value, label }));

export function AdminAnnouncements() {
  useSeo('Elanlar (admin)', undefined, { noindex: true });
  const fields: FieldDef[] = [
    { name: 'title', label: 'Başlıq', type: 'text', required: true, min: 3, max: 160 },
    { name: 'summary', label: 'Qısa xülasə', type: 'text', required: true, max: 240, hint: 'Siyahıda göstərilir' },
    { name: 'body', label: 'Mətn', type: 'textarea', required: true, max: 8000, hint: 'Abzaslar arasında boş sətir buraxın' },
    { name: 'category', label: 'Kateqoriya', type: 'select', options: opts(announcementCategories), default: 'umumi' },
    { name: 'important', label: 'Vacib elan kimi fərqləndir', type: 'checkbox' },
    { name: 'published', label: 'Dərc olunub (saytda görünür)', type: 'checkbox', default: true },
  ];
  return <CrudPage<Announcement> title="Elanlar" text="Elan əlavə edin, redaktə edin və ya silin." singular="Elan" api={announcementsApi} fields={fields} includeDrafts
    searchKeys={['title', 'summary']} filter={{ label: 'Kateqoriya', key: 'category', options: opts(announcementCategories) }}
    columns={[
      { header: 'Başlıq', cell: (r) => <span className="flex items-center gap-1.5 font-semibold">{r.important && <Star className="size-4 text-accent" aria-label="Vacib" />}{r.title}</span> },
      { header: 'Kateqoriya', cell: (r) => <Badge tone="brand">{announcementCategories[r.category]}</Badge> },
      { header: 'Status', cell: (r) => r.published ? <Badge tone="success"><Check className="size-3" aria-hidden />Dərc olunub</Badge> : <Badge>Qaralama</Badge> },
      { header: 'Tarix', cell: (r) => formatDate(r.createdAt) },
    ]} />;
}

export function AdminMaterials() {
  useSeo('Materiallar (admin)', undefined, { noindex: true });
  const specs = useSpecialties();
  const fields: FieldDef[] = [
    { name: 'title', label: 'Ad', type: 'text', required: true, min: 3, max: 160 },
    { name: 'subject', label: 'Fənn', type: 'text', required: true, min: 2, max: 120 },
    { name: 'author', label: 'Müəllif', type: 'text', required: true, max: 120, blank: true },
    { name: 'file', label: 'Fayl yüklə', type: 'file', accept: MATERIAL_ACCEPT, hint: `${MATERIAL_FORMATS_LABEL}; ən çox 25 MB. Redaktə zamanı yeni fayl seçsəniz köhnəsi əvəz olunur.` },
    { name: 'url', label: 'Və ya xarici keçid', type: 'url', max: 1000, nullable: true, hint: 'Fayl yükləmirsinizsə: yalnız https:// ilə başlayan keçid (məs. Google Drive). Fayl və keçid birlikdə olmaz.' },
    { name: 'fileType', label: 'Növ (yalnız keçid üçün)', type: 'select', options: opts(materialTypes), default: 'link' },
    { name: 'specialty', label: 'İxtisas', type: 'select', nullable: true, hint: 'Könüllü. Boşdursa material hamıya aiddir.',
      options: [{ value: '', label: 'Hamısı (məhdudiyyət yoxdur)' }, ...specs.map((s) => ({ value: s.code, label: specialtyFullLabel(s.code) }))] },
    { name: 'groupName', label: 'Qrup', type: 'select', nullable: true, showIf: (v) => Boolean(v.specialty),
      options: (v) => [{ value: '', label: 'Bütün qruplar' }, ...groupsOfSpecialty(String(v.specialty ?? '')).map((g) => ({ value: g.code, label: g.code }))] },
    { name: 'description', label: 'Təsvir', type: 'textarea', max: 1500, blank: true },
  ];
  return <CrudPage<Material> title="Tədris materialları" text="Faylı birbaşa yükləyin (PDF, Word, PowerPoint, Excel, TXT, ZIP) və ya xarici keçid əlavə edin." singular="Material" api={materialsAdminApi} fields={fields}
    searchKeys={['title', 'subject', 'author', 'fileName']} filter={{ label: 'Növ', key: 'fileType', options: opts(materialTypes) }}
    validate={(v, rec) => {
      const hasFile = v.file instanceof File;
      const hasUrl = Boolean(v.url);
      if (hasFile && hasUrl) return 'Ya fayl yükləyin, ya da keçid yazın; ikisi birlikdə olmaz';
      if (!hasFile && !hasUrl && !rec?.filePath) return 'Fayl yükləyin və ya https:// keçidi yazın';
      if (hasUrl && !isSafeHttpsUrl(String(v.url))) return 'Keçid düzgün https:// ünvanı deyil';
      if (v.specialty && v.groupName && !isValidPlacement(String(v.specialty), String(v.groupName))) return 'Seçilmiş qrup bu ixtisasa aid deyil';
      return null;
    }}
    columns={[
      { header: 'Ad', cell: (r) => <span className="font-semibold">{r.title}</span> },
      { header: 'Fənn', cell: (r) => r.subject },
      { header: 'Növ', cell: (r) => <Badge>{materialTypes[r.fileType]}</Badge> },
      { header: 'Mənbə', cell: (r) => (r.filePath ? <span className="break-all text-sm">{r.fileName}{r.fileSize ? <span className="block text-xs text-muted">{formatBytes(r.fileSize)}</span> : null}</span> : <span className="text-sm text-muted">Xarici keçid</span>) },
      { header: 'İxtisas / qrup', cell: (r) => (r.specialty ? `${specialtyLabel(r.specialty)}${r.groupName ? ` · ${r.groupName}` : ''}` : <span className="text-muted">Hamısı</span>) },
      { header: 'Tarix', cell: (r) => formatDate(r.createdAt) },
    ]} />;
}

export function AdminEvents() {
  useSeo('Tədbirlər (admin)', undefined, { noindex: true });
  const fields: FieldDef[] = [
    { name: 'title', label: 'Ad', type: 'text', required: true, min: 3, max: 160 },
    { name: 'description', label: 'Təsvir', type: 'textarea', required: true, max: 4000 },
    { name: 'category', label: 'Kateqoriya', type: 'select', options: opts(eventCategories), default: 'seminar' },
    { name: 'location', label: 'Yer', type: 'text', required: true, min: 2, max: 200 },
    { name: 'startsAt', label: 'Başlama vaxtı', type: 'datetime', required: true },
    { name: 'endsAt', label: 'Bitmə vaxtı (könüllü)', type: 'datetime' },
    { name: 'registrationOpen', label: 'İştirak üçün qeydiyyat açıqdır', type: 'checkbox' },
  ];
  return <CrudPage<EventItem> title="Tədbirlər" text="Tədbir yaradın və ya redaktə edin." singular="Tədbir" api={eventsApi} fields={fields}
    searchKeys={['title', 'location']} filter={{ label: 'Kateqoriya', key: 'category', options: opts(eventCategories) }}
    validate={(v) => (v.endsAt && v.startsAt && String(v.endsAt) < String(v.startsAt) ? 'Bitmə vaxtı başlama vaxtından əvvəl ola bilməz' : null)}
    columns={[
      { header: 'Ad', cell: (r) => <span className="font-semibold">{r.title}</span> },
      { header: 'Kateqoriya', cell: (r) => <Badge tone="brand">{eventCategories[r.category]}</Badge> },
      { header: 'Vaxt', cell: (r) => formatDateTime(r.startsAt) },
      { header: 'Yer', cell: (r) => r.location },
      { header: 'Qeydiyyat', cell: (r) => (r.registrationOpen ? <Badge tone="success">Açıq</Badge> : <Badge>Yox</Badge>) },
    ]} />;
}
