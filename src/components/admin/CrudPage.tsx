import { useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { Resource } from '@/services/content';
import { useAsync } from '@/hooks/useAsync';
import { useToast } from '@/components/Toast';
import { Button, Card, CheckField, ConfirmDialog, EmptyState, ErrorBanner, ErrorState, ListSkeleton, Modal, PageHeader, SelectField, TextArea, TextField } from '@/components/ui';
import { friendlyError } from '@/utils/errors';
import { matchesQuery, toLocalInput } from '@/utils/format';

export interface FieldDef {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'datetime' | 'url' | 'time' | 'file';
  options?: { value: string | number; label: string }[] | ((v: Record<string, unknown>) => { value: string | number; label: string }[]);
  required?: boolean;
  min?: number;
  max?: number;
  hint?: string;
  numeric?: boolean;
  default?: unknown;
  /** type='file': brauzerin fayl seçimi süzgəci (məs. ".pdf,.docx"). Seçilən File dəyər kimi api-yə ötürülür. */
  accept?: string;
  /** Redaktə zamanı boş buraxılan sahə verilənlər bazasında NULL-a çevrilsin (boş mətn yox). */
  nullable?: boolean;
  /** Boş dəyər boş mətn kimi yazılsın (NOT NULL sütunlar üçün; redaktədə sahəni təmizləməyə imkan verir). */
  blank?: boolean;
  /** Yalnız bu şərt ödənəndə sahə göstərilir (məs. ixtisas seçilibsə qrup). */
  showIf?: (v: Record<string, unknown>) => boolean;
}

type Rec = { id: string };
const get = (r: unknown, k: string): unknown => (r as Record<string, unknown> | null)?.[k];
const PAGE = 8;

export function CrudPage<T extends Rec>({ title, text, singular, api, fields, columns, searchKeys, filter, validate, includeDrafts, canCreate = true, canDelete = true, sortKey }: {
  title: string; text: string; singular: string; api: Resource<T>; fields: FieldDef[];
  columns: { header: string; cell: (r: T) => ReactNode; className?: string }[];
  searchKeys: string[];
  filter?: { label: string; key: string; options: { value: string; label: string }[] };
  validate?: (v: Record<string, unknown>, record: T | null) => string | null;
  includeDrafts?: boolean;
  /** Verilərsə (məs. 'sortOrder') sətirlər bu sahə üzrə sıralanır və yuxarı/aşağı düymələri göstərilir. */
  sortKey?: string;
  /** false olduqda “Əlavə et” düyməsi gizlədilir (məs. ixtisaslar yalnız redaktə olunur). */
  canCreate?: boolean;
  canDelete?: boolean;
}) {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => api.list({ includeDrafts }), []);
  const [q, setQ] = useState('');
  const [f, setF] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<T | 'new' | null>(null);
  const [deleting, setDeleting] = useState<T | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  const ordered = useMemo(() => (sortKey ? [...(data ?? [])].sort((a, b) => Number(get(a, sortKey) ?? 0) - Number(get(b, sortKey) ?? 0)) : (data ?? [])), [data, sortKey]);
  const rows = useMemo(() => ordered.filter((r) => (!filter || !f || String(get(r, filter.key)) === f) && matchesQuery(q, ...searchKeys.map((k) => String(get(r, k) ?? '')))), [ordered, q, f, filter, searchKeys]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const cur = Math.min(page, pages);
  const slice = rows.slice((cur - 1) * PAGE, cur * PAGE);

  const [moving, setMoving] = useState(false);
  const move = async (id: string, dir: -1 | 1) => {
    if (!sortKey || moving) return;
    const list = [...ordered];
    const i = list.findIndex((r) => r.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setMoving(true);
    try {
      await Promise.all(list.map((r, idx) => (Number(get(r, sortKey) ?? 0) === (idx + 1) * 10 ? null : api.update(r.id, { [sortKey]: (idx + 1) * 10 } as Partial<Omit<T, 'id'>>))));
      reload();
    } catch (e) { toast.error(friendlyError(e)); reload(); } finally { setMoving(false); }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDelBusy(true);
    try { await api.remove(deleting.id); toast.success(`${singular} silindi`); setDeleting(null); reload(); }
    catch (e) { toast.error(friendlyError(e)); } finally { setDelBusy(false); }
  };

  return (
    <>
      <PageHeader title={title} text={text} actions={canCreate ? <Button onClick={() => setEditing('new')}><Plus className="size-4" aria-hidden />Əlavə et</Button> : undefined} />
      <div className={`mb-4 grid gap-3 ${filter ? 'sm:grid-cols-[1fr_14rem]' : ''}`} role="search">
        <div className="relative"><TextField label="Axtarış" type="search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="pl-10" /><Search className="pointer-events-none absolute bottom-3 left-3 size-5 text-muted" aria-hidden /></div>
        {filter && <SelectField label={filter.label} value={f} onChange={(e) => { setF(e.target.value); setPage(1); }}><option value="">Hamısı</option>{filter.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>}
      </div>

      {loading ? <ListSkeleton rows={4} /> : error ? <ErrorState message={error} onRetry={reload} /> :
        !rows.length ? <EmptyState title={data?.length ? 'Uyğun nəticə tapılmadı' : `Hələ ${singular.toLowerCase()} yoxdur`} text={data?.length ? 'Axtarışı və ya filtri dəyişin.' : canCreate ? '“Əlavə et” düyməsi ilə ilk qeydi yaradın.' : undefined} /> : (
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
                        {sortKey && !q && !f && <>
                          <Button size="sm" variant="ghost" disabled={moving || ordered[0]?.id === r.id} onClick={() => move(r.id, -1)} aria-label={`Yuxarı: ${String(get(r, 'title') ?? get(r, 'question') ?? get(r, 'label') ?? get(r, 'fullName') ?? '')}`}><ArrowUp className="size-4" /></Button>
                          <Button size="sm" variant="ghost" disabled={moving || ordered[ordered.length - 1]?.id === r.id} onClick={() => move(r.id, 1)} aria-label={`Aşağı: ${String(get(r, 'title') ?? get(r, 'question') ?? get(r, 'label') ?? get(r, 'fullName') ?? '')}`}><ArrowDown className="size-4" /></Button>
                        </>}
                        <Button size="sm" variant="ghost" onClick={() => setEditing(r)} aria-label={`Redaktə et: ${String(get(r, 'title') ?? get(r, 'subject') ?? get(r, 'name') ?? get(r, 'question') ?? get(r, 'label') ?? get(r, 'fullName') ?? '')}`}><Pencil className="size-4" /></Button>
                        {canDelete && <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting(r)} aria-label={`Sil: ${String(get(r, 'title') ?? get(r, 'subject') ?? get(r, 'name') ?? get(r, 'question') ?? get(r, 'label') ?? get(r, 'fullName') ?? '')}`}><Trash2 className="size-4" /></Button>}
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
      <ConfirmDialog open={!!deleting} title={`${singular} silinsin?`} text={`“${String(get(deleting, 'title') ?? get(deleting, 'subject') ?? get(deleting, 'question') ?? get(deleting, 'label') ?? get(deleting, 'fullName') ?? '')}” həmişəlik silinəcək. Bu əməliyyatı geri qaytarmaq mümkün deyil.`} loading={delBusy} onConfirm={confirmDelete} onClose={() => setDeleting(null)} />
    </>
  );
}

function RecordForm<T extends Rec>({ singular, record, fields, validate, onClose, onSave }: {
  singular: string; record: T | null; fields: FieldDef[]; validate?: (v: Record<string, unknown>, record: T | null) => string | null;
  onClose: () => void; onSave: (v: Record<string, unknown>) => Promise<void>;
}) {
  const defaults = useMemo(() => Object.fromEntries(fields.filter((fl) => fl.type !== 'file').map((fl) => {
    const raw = record ? get(record, fl.name) : fl.default;
    if (fl.type === 'datetime') return [fl.name, toLocalInput(raw as string | undefined)];
    if (fl.type === 'checkbox') return [fl.name, Boolean(raw)];
    return [fl.name, raw ?? ''];
  })), [fields, record]);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<Record<string, unknown>>({ defaultValues: defaults });
  const live = watch();
  const [err, setErr] = useState('');

  const submit = handleSubmit(async (raw) => {
    setErr('');
    const out: Record<string, unknown> = {};
    for (const fl of fields) {
      if (fl.showIf && !fl.showIf(raw)) { if (record && fl.nullable) out[fl.name] = null; continue; }
      let v = raw[fl.name];
      if (fl.type === 'file') { const f = (v as FileList | undefined)?.[0]; out[fl.name] = f ?? undefined; continue; }
      if (fl.type === 'datetime') v = v ? new Date(String(v)).toISOString() : undefined;
      else if (fl.numeric) v = Number(v);
      else if (typeof v === 'string') v = v.trim();
      out[fl.name] = v === '' ? (fl.blank ? '' : record && fl.nullable ? null : undefined) : v;
    }
    const bad = validate?.(out, record);
    if (bad) return setErr(bad);
    try { await onSave(out); } catch (e) { setErr(friendlyError(e)); }
  });

  return (
    <Modal open onClose={onClose} title={record ? `${singular}: redaktə` : `${singular}: yeni`} wide>
      <form onSubmit={submit} noValidate className="grid gap-4">
        {fields.filter((fl) => !fl.showIf || fl.showIf(live)).map((fl) => {
          const rules = {
            required: fl.required ? 'Bu sahə məcburidir' : false,
            ...(fl.min ? { minLength: { value: fl.min, message: `Ən azı ${fl.min} simvol yazın` } } : {}),
            ...(fl.max ? { maxLength: { value: fl.max, message: `Ən çox ${fl.max} simvol ola bilər` } } : {}),
            ...(fl.type === 'url' ? { validate: (x: unknown) => !x || /^https:\/\/.+\..+/.test(String(x)) || 'Keçid https:// ilə başlamalıdır' } : {}),
            ...(fl.type === 'time' ? { validate: (x: unknown) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(x)) || 'Saatı SS:DD formatında yazın (məs. 09:00)' } : {}),
          };
          const e = errors[fl.name]?.message as string | undefined;
          if (fl.type === 'file') return <TextField key={fl.name} label={fl.label} hint={fl.hint} error={e} type="file" accept={fl.accept} {...register(fl.name)} />;
          if (fl.type === 'checkbox') return <CheckField key={fl.name} label={fl.label} {...register(fl.name)} />;
          if (fl.type === 'textarea') return <TextArea key={fl.name} label={fl.label} hint={fl.hint} error={e} {...register(fl.name, rules)} />;
          if (fl.type === 'select') return <SelectField key={fl.name} label={fl.label} error={e} {...register(fl.name, rules)}>{(typeof fl.options === 'function' ? fl.options(live) : fl.options)?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</SelectField>;
          return <TextField key={fl.name} label={fl.label} hint={fl.hint} error={e} type={fl.type === 'datetime' ? 'datetime-local' : fl.type === 'url' ? 'url' : 'text'} placeholder={fl.type === 'time' ? '09:00' : undefined} {...register(fl.name, rules)} />;
        })}
        {isSubmitting && fields.some((fl) => fl.type === 'file' && (live[fl.name] as FileList | undefined)?.length) && <p role="status" className="text-sm font-semibold text-brand">Fayl yüklənir, gözləyin…</p>}
        {err && <ErrorBanner>{err}</ErrorBanner>}
        <div className="flex justify-end gap-3 pt-2"><Button variant="secondary" onClick={onClose}>Ləğv et</Button><Button type="submit" loading={isSubmitting}>Saxla</Button></div>
      </form>
    </Modal>
  );
}
