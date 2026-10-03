import { useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { Resource } from '@/services/content';
import { useAsync } from '@/hooks/useAsync';
import { useToast } from '@/components/Toast';
import { Button, Card, CheckField, ConfirmDialog, EmptyState, ErrorBanner, ErrorState, ListSkeleton, Modal, PageHeader, SelectField, TextArea, TextField } from '@/components/ui';
import { friendlyError } from '@/utils/errors';
import { matchesQuery, toLocalInput } from '@/utils/format';

export interface FieldDef {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'datetime' | 'url' | 'time';
  options?: { value: string | number; label: string }[];
  required?: boolean;
  min?: number;
  max?: number;
  hint?: string;
  numeric?: boolean;
  default?: unknown;
}

type Rec = { id: string };
const get = (r: unknown, k: string): unknown => (r as Record<string, unknown> | null | undefined)?.[k];
const PAGE = 8;

export function CrudPage<T extends Rec>({ title, text, singular, api, fields, columns, searchKeys, filter, validate, includeDrafts }: {
  title: string; text: string; singular: string; api: Resource<T>; fields: FieldDef[];
  columns: { header: string; cell: (r: T) => ReactNode; className?: string }[];
  searchKeys: string[];
  filter?: { label: string; key: string; options: { value: string; label: string }[] };
  validate?: (v: Record<string, unknown>) => string | null;
  includeDrafts?: boolean;
}) {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => api.list({ includeDrafts }), []);
  const [q, setQ] = useState('');
  const [f, setF] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<T | 'new' | null>(null);
  const [deleting, setDeleting] = useState<T | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  const rows = useMemo(() => (data ?? []).filter((r) => (!filter || !f || String(get(r, filter.key)) === f) && matchesQuery(q, ...searchKeys.map((k) => String(get(r, k) ?? '')))), [data, q, f, filter, searchKeys]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const cur = Math.min(page, pages);
  const slice = rows.slice((cur - 1) * PAGE, cur * PAGE);

  const confirmDelete = async () => {
    if (!deleting) return;
    setDelBusy(true);
    try { await api.remove(deleting.id); toast.success(`${singular} silindi`); setDeleting(null); reload(); }
    catch (e) { toast.error(friendlyError(e)); } finally { setDelBusy(false); }
  };

  return (
    <>
      <PageHeader title={title} text={text} actions={<Button onClick={() => setEditing('new')}><Plus className="size-4" aria-hidden />Əlavə et</Button>} />
      <div className={`mb-4 grid gap-3 ${filter ? 'sm:grid-cols-[1fr_14rem]' : ''}`} role="search">
        <div className="relative"><TextField label="Axtarış" type="search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="pl-10" /><Search className="pointer-events-none absolute bottom-3 left-3 size-5 text-muted" aria-hidden /></div>
        {filter && <SelectField label={filter.label} value={f} onChange={(e) => { setF(e.target.value); setPage(1); }}><option value="">Hamısı</option>{filter.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>}
      </div>

      {loading ? <ListSkeleton rows={4} /> : error ? <ErrorState message={error} onRetry={reload} /> :
        !rows.length ? <EmptyState title={data?.length ? 'Uyğun nəticə tapılmadı' : `Hələ ${singular.toLowerCase()} yoxdur`} text={data?.length ? 'Axtarışı və ya filtri dəyişin.' : '“Əlavə et” düyməsi ilə ilk qeydi yaradın.'} /> : (
          <Card className="overflow-hidden">
            <div className="scroll-x">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <caption className="sr-only">{title}</caption>
                <thead className="bg-surface-2 text-muted"><tr>{columns.map((c) => <th key={c.header} scope="col" className="px-4 py-3 font-semibold">{c.header}</th>)}<th scope="col" className="px-4 py-3 text-right font-semibold">Əməliyyat</th></tr></thead>
                <tbody>
                  {slice.map((r) => (
                    <tr key={r.id} className="border-t border-line">
                      {columns.map((c) => <td key={c.header} className={`px-4 py-3 align-top ${c.className ?? ''}`}>{c.cell(r)}</td>)}
                      <td className="px-4 py-3"><div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(r)} aria-label={`Redaktə et: ${String(get(r, 'title') ?? get(r, 'subject') ?? '')}`}><Pencil className="size-4" /></Button>
                        <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting(r)} aria-label={`Sil: ${String(get(r, 'title') ?? get(r, 'subject') ?? '')}`}><Trash2 className="size-4" /></Button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-muted">
              <span>{rows.length} nəticə</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" disabled={cur <= 1} onClick={() => setPage(cur - 1)} aria-label="Əvvəlki səhifə"><ChevronLeft className="size-4" /></Button>
                <span aria-live="polite">{cur} / {pages}</span>
                <Button size="sm" variant="secondary" disabled={cur >= pages} onClick={() => setPage(cur + 1)} aria-label="Növbəti səhifə"><ChevronRight className="size-4" /></Button>
              </div>
            </div>
          </Card>
        )}

      {editing && <RecordForm key={editing === 'new' ? 'new' : editing.id} singular={singular} record={editing === 'new' ? null : editing} fields={fields} validate={validate}
        onClose={() => setEditing(null)}
        onSave={async (v) => {
          if (editing === 'new') await api.create(v as Omit<T, 'id'>); else await api.update(editing.id, v as Partial<Omit<T, 'id'>>);
          toast.success(editing === 'new' ? `${singular} əlavə olundu` : `${singular} yeniləndi`);
          setEditing(null); reload();
        }} />}
      <ConfirmDialog open={!!deleting} title={`${singular} silinsin?`} text={`“${String(get(deleting, 'title') ?? get(deleting, 'subject') ?? '')}” həmişəlik silinəcək. Bu əməliyyatı geri qaytarmaq mümkün deyil.`} loading={delBusy} onConfirm={confirmDelete} onClose={() => setDeleting(null)} />
    </>
  );
}

function RecordForm({ singular, record, fields, validate, onClose, onSave }: {
  singular: string; record: Rec | null; fields: FieldDef[]; validate?: (v: Record<string, unknown>) => string | null;
  onClose: () => void; onSave: (v: Record<string, unknown>) => Promise<void>;
}) {
  const defaults = useMemo(() => Object.fromEntries(fields.map((fl) => {
    const raw = record ? get(record, fl.name) : fl.default;
    if (fl.type === 'datetime') return [fl.name, toLocalInput(raw as string | undefined)];
    if (fl.type === 'checkbox') return [fl.name, Boolean(raw)];
    return [fl.name, raw ?? ''];
  })), [fields, record]);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Record<string, unknown>>({ defaultValues: defaults });
  const [err, setErr] = useState('');

  const submit = handleSubmit(async (raw) => {
    setErr('');
    const out: Record<string, unknown> = {};
    for (const fl of fields) {
      let v = raw[fl.name];
      if (fl.type === 'datetime') v = v ? new Date(String(v)).toISOString() : undefined;
      else if (fl.numeric) v = Number(v);
      else if (typeof v === 'string') v = v.trim();
      out[fl.name] = v === '' ? undefined : v;
    }
    const bad = validate?.(out);
    if (bad) return setErr(bad);
    try { await onSave(out); } catch (e) { setErr(friendlyError(e)); }
  });

  return (
    <Modal open onClose={onClose} title={record ? `${singular}: redaktə` : `${singular}: yeni`} wide>
      <form onSubmit={submit} noValidate className="grid gap-4">
        {fields.map((fl) => {
          const rules = {
            required: fl.required ? 'Bu sahə məcburidir' : false,
            ...(fl.min ? { minLength: { value: fl.min, message: `Ən azı ${fl.min} simvol yazın` } } : {}),
            ...(fl.max ? { maxLength: { value: fl.max, message: `Ən çox ${fl.max} simvol ola bilər` } } : {}),
            ...(fl.type === 'url' ? { validate: (x: unknown) => !x || /^https:\/\/.+\..+/.test(String(x)) || 'Keçid https:// ilə başlamalıdır' } : {}),
            ...(fl.type === 'time' ? { validate: (x: unknown) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(x)) || 'Saatı SS:DD formatında yazın (məs. 09:00)' } : {}),
          };
          const e = errors[fl.name]?.message as string | undefined;
          if (fl.type === 'checkbox') return <CheckField key={fl.name} label={fl.label} {...register(fl.name)} />;
          if (fl.type === 'textarea') return <TextArea key={fl.name} label={fl.label} hint={fl.hint} error={e} {...register(fl.name, rules)} />;
          if (fl.type === 'select') return <SelectField key={fl.name} label={fl.label} error={e} {...register(fl.name, rules)}>{fl.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>;
          return <TextField key={fl.name} label={fl.label} hint={fl.hint} error={e} type={fl.type === 'datetime' ? 'datetime-local' : fl.type === 'url' ? 'url' : 'text'} placeholder={fl.type === 'time' ? '09:00' : undefined} {...register(fl.name, rules)} />;
        })}
        {err && <ErrorBanner>{err}</ErrorBanner>}
        <div className="flex justify-end gap-3 pt-2"><Button variant="secondary" onClick={onClose}>Ləğv et</Button><Button type="submit" loading={isSubmitting}>Saxla</Button></div>
      </form>
    </Modal>
  );
}
