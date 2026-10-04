import { Check, Star } from 'lucide-react';
import { announcementsApi, eventsApi, materialsApi } from '@/services/content';
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
  const fields: FieldDef[] = [
    { name: 'title', label: 'Ad', type: 'text', required: true, min: 3, max: 160 },
    { name: 'subject', label: 'Fənn', type: 'text', required: true, min: 2, max: 120 },
    { name: 'author', label: 'Müəllif', type: 'text', required: true, max: 120 },
    { name: 'fileType', label: 'Növ', type: 'select', options: opts(materialTypes), default: 'pdf' },
    { name: 'url', label: 'Fayl və ya səhifə keçidi', type: 'url', required: true, max: 1000, hint: 'Yalnız https:// ilə başlayan keçid qəbul edilir (məs. Google Drive)' },
    { name: 'description', label: 'Təsvir', type: 'textarea', max: 1500 },
  ];
  return <CrudPage<Material> title="Tədris materialları" text="Fayllar xarici keçid kimi əlavə olunur; saytda yalnız https:// keçidlər açılır." singular="Material" api={materialsApi} fields={fields}
    searchKeys={['title', 'subject', 'author']} filter={{ label: 'Növ', key: 'fileType', options: opts(materialTypes) }}
    validate={(v) => (v.url && !isSafeHttpsUrl(String(v.url)) ? 'Keçid düzgün https:// ünvanı deyil' : null)}
    columns={[
      { header: 'Ad', cell: (r) => <span className="font-semibold">{r.title}</span> },
      { header: 'Fənn', cell: (r) => r.subject },
      { header: 'Növ', cell: (r) => <Badge>{materialTypes[r.fileType]}</Badge> },
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
