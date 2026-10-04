import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Check } from 'lucide-react';
import { CrudPage, type FieldDef } from '@/components/admin/CrudPage';
import { useToast } from '@/components/Toast';
import { Badge, Button, Card, ErrorBanner, PageHeader, TextArea, TextField } from '@/components/ui';
import { DEVELOPER } from '@/config/site';
import { faqApi, footerLinksApi, type Resource } from '@/services/content';
import { isSafeFooterUrl, reloadFooterLinks, saveSiteSettings, useSiteSettings, type SiteSettings } from '@/services/site';
import { useSeo } from '@/hooks/useSeo';
import { friendlyError } from '@/utils/errors';
import type { FaqItem, FooterLink } from '@/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AdminSite() {
  useSeo('Sayt parametrləri (admin)', undefined, { noindex: true });
  const current = useSiteSettings();
  const toast = useToast();
  const [err, setErr] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty } } = useForm<SiteSettings>({ values: current });

  const save = handleSubmit(async (v) => {
    setErr('');
    try { await saveSiteSettings(v); toast.success('Sayt parametrləri yadda saxlanıldı'); }
    catch (e) { setErr(friendlyError(e)); }
  });

  return (
    <>
      <PageHeader title="Sayt parametrləri" text="Saytın adı, ana səhifə mətnləri, əlaqə məlumatları və footer mətni. Dəyişikliklər kodu redaktə etmədən dərhal saytda görünür." />
      <form onSubmit={save} noValidate className="grid gap-6 lg:grid-cols-2">
        <Card className="grid h-fit gap-4 p-6">
          <h2 className="text-lg font-bold">Ümumi və ana səhifə</h2>
          <TextField label="Saytın adı" error={errors.siteName?.message} {...register('siteName', { required: 'Saytın adını yazın', maxLength: { value: 60, message: 'Ən çox 60 simvol' }, validate: (x) => x.trim().length > 0 || 'Saytın adını yazın' })} />
          <TextField label="Ana səhifə başlığı" error={errors.homeTitle?.message} {...register('homeTitle', { required: 'Başlığı yazın', maxLength: { value: 160, message: 'Ən çox 160 simvol' } })} />
          <TextArea label="Ana səhifə alt başlığı / mətni" rows={4} error={errors.homeText?.message} {...register('homeText', { maxLength: { value: 1000, message: 'Ən çox 1000 simvol' } })} />
          <TextField label="“Məqsəd” bölməsinin başlığı" error={errors.aboutTitle?.message} {...register('aboutTitle', { required: 'Başlığı yazın', maxLength: { value: 120, message: 'Ən çox 120 simvol' } })} />
          <TextArea label="“Məqsəd” bölməsinin mətni" rows={5} error={errors.aboutText?.message} {...register('aboutText', { maxLength: { value: 1000, message: 'Ən çox 1000 simvol' } })} />
        </Card>
        <div className="grid h-fit gap-6">
          <Card className="grid gap-4 p-6">
            <h2 className="text-lg font-bold">Əlaqə məlumatları</h2>
            <TextField label="E-poçt" type="email" hint="Boş buraxılsa, göstərilmir" error={errors.contactEmail?.message} {...register('contactEmail', { maxLength: { value: 160, message: 'Çox uzundur' }, validate: (x) => !x.trim() || EMAIL_RE.test(x.trim()) || 'E-poçt ünvanı düzgün deyil' })} />
            <TextField label="Telefon" error={errors.contactPhone?.message} {...register('contactPhone', { maxLength: { value: 40, message: 'Ən çox 40 simvol' } })} />
            <TextField label="Ünvan" error={errors.contactAddress?.message} {...register('contactAddress', { maxLength: { value: 300, message: 'Ən çox 300 simvol' } })} />
          </Card>
          <Card className="grid gap-4 p-6">
            <h2 className="text-lg font-bold">Footer</h2>
            <TextArea label="Footer təsviri" rows={3} error={errors.footerText?.message} {...register('footerText', { maxLength: { value: 500, message: 'Ən çox 500 simvol' } })} />
            <p className="text-sm text-muted">Footer keçidlərini “Footer” bölməsindən idarə edin. “{DEVELOPER.label} {DEVELOPER.name}” qeydi və <span className="break-all">{DEVELOPER.url}</span> keçidi kodda sabitdir və buradan dəyişdirilmir.</p>
          </Card>
          {err && <ErrorBanner>{err}</ErrorBanner>}
          <div><Button type="submit" size="lg" loading={isSubmitting} disabled={!isDirty}>Yadda saxla</Button></div>
        </div>
      </form>
    </>
  );
}

const faqFields: FieldDef[] = [
  { name: 'question', label: 'Sual', type: 'text', required: true, min: 3, max: 200 },
  { name: 'answer', label: 'Cavab', type: 'textarea', required: true, min: 3, max: 2000 },
  { name: 'sortOrder', label: 'Sıra nömrəsi', type: 'text', numeric: true, default: 1000, hint: 'Kiçik rəqəm əvvəldə görünür. Sıranı cədvəldəki oxlarla da dəyişə bilərsiniz.' },
  { name: 'active', label: 'Aktivdir (saytda göstərilsin)', type: 'checkbox', default: true },
];

export function AdminFaq() {
  useSeo('SSS (admin)', undefined, { noindex: true });
  return <CrudPage<FaqItem> title="Tez-tez verilən suallar" text="Sual-cavab əlavə edin, redaktə edin, sıralayın və ya silin." singular="Sual" api={faqApi} fields={faqFields} includeDrafts sortKey="sortOrder"
    searchKeys={['question', 'answer']}
    validate={(v) => (Number.isInteger(v.sortOrder) ? null : 'Sıra nömrəsi tam ədəd olmalıdır')}
    columns={[
      { header: 'Sual', cell: (r) => <span className="break-words font-semibold">{r.question}</span> },
      { header: 'Sıra', cell: (r) => r.sortOrder },
      { header: 'Status', cell: (r) => (r.active ? <Badge tone="success"><Check className="size-3" aria-hidden />Aktiv</Badge> : <Badge>Gizli</Badge>) },
    ]} />;
}

/** Footer keçidi dəyişəndə ictimai footer dərhal yenilənir. */
const footerAdminApi: Resource<FooterLink> = {
  list: (o) => footerLinksApi.list(o),
  get: (id) => footerLinksApi.get(id),
  async create(d) { const id = await footerLinksApi.create(d); await reloadFooterLinks(); return id; },
  async update(id, d) { await footerLinksApi.update(id, d); await reloadFooterLinks(); },
  async remove(id) { await footerLinksApi.remove(id); await reloadFooterLinks(); },
};

const footerFields: FieldDef[] = [
  { name: 'label', label: 'Mətn', type: 'text', required: true, min: 2, max: 60 },
  { name: 'url', label: 'Keçid', type: 'text', required: true, max: 500, hint: 'Daxili səhifə üçün /contact kimi, xarici üçün https:// ilə başlayan ünvan' },
  { name: 'sortOrder', label: 'Sıra nömrəsi', type: 'text', numeric: true, default: 1000 },
  { name: 'active', label: 'Aktivdir (footer-də göstərilsin)', type: 'checkbox', default: true },
];

export function AdminFooter() {
  useSeo('Footer (admin)', undefined, { noindex: true });
  return <CrudPage<FooterLink> title="Footer keçidləri" text="Saytın alt hissəsindəki naviqasiya keçidləri. Developer qeydi kodda sabitdir." singular="Keçid" api={footerAdminApi} fields={footerFields} includeDrafts sortKey="sortOrder"
    searchKeys={['label', 'url']}
    validate={(v) => {
      if (!isSafeFooterUrl(String(v.url ?? ''))) return 'Keçid /yol (daxili) və ya https:// ilə başlamalıdır';
      return Number.isInteger(v.sortOrder) ? null : 'Sıra nömrəsi tam ədəd olmalıdır';
    }}
    columns={[
      { header: 'Mətn', cell: (r) => <span className="font-semibold">{r.label}</span> },
      { header: 'Keçid', cell: (r) => <span className="break-all text-muted">{r.url}</span> },
      { header: 'Status', cell: (r) => (r.active ? <Badge tone="success">Aktiv</Badge> : <Badge>Gizli</Badge>) },
    ]} />;
}
