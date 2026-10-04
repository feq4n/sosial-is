import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Copy, Eye, Plus, Save, Download, Trash2 } from 'lucide-react';
import { Button, ButtonLink, Card, CheckField, EmptyState, ErrorBanner, ErrorState, ListSkeleton, Modal, PageHeader, SelectField, TextArea, TextField } from '@/components/ui';
import { FormRenderer } from '@/components/forms/FormRenderer';
import { useToast } from '@/components/Toast';
import { useAsync } from '@/hooks/useAsync';
import { useSeo } from '@/hooks/useSeo';
import { groupsOfSpecialty, specialties as specialtyList } from '@/data/timetable';
import {
  FIELD_TYPES, isChoice, newField, shareLink, STATUS_LABELS, validateDefinition,
  type FieldType, type FormAudience, type FormField, type FormStatus,
} from '@/lib/forms';
import { friendlyError } from '@/utils/errors';
import { toLocalInput } from '@/utils/format';
import { formsApi, type FormRecord } from '@/services/forms';

/** /admin/forms/new  və  /admin/forms/:id */
export function AdminFormEditor() {
  useSeo('Form redaktoru (admin)', undefined, { noindex: true });
  const { id } = useParams();
  const { data, loading, error, reload } = useAsync(async () => (id ? formsApi.getById(id) : null), [id]);

  if (loading) return <ListSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (id && !data) {
    return <EmptyState title="Form tapılmadı" text="Bu form silinib və ya mövcud deyil." action={<ButtonLink to="/admin/forms" variant="secondary">Formlara qayıt</ButtonLink>} />;
  }
  return <EditorForm key={data?.id ?? 'new'} initial={data ?? null} />;
}

function EditorForm({ initial }: { initial: FormRecord | null }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [saved, setSaved] = useState<FormRecord | null>(initial);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [status, setStatus] = useState<FormStatus>(initial?.status ?? 'draft');
  const [closesAt, setClosesAt] = useState(toLocalInput(initial?.closesAt));
  const [audience, setAudience] = useState<FormAudience>(initial?.audience ?? { mode: 'all', specialties: [], groups: [] });
  const [fields, setFields] = useState<FormField[]>(initial?.fields ?? []);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [preview, setPreview] = useState(false);

  const patchField = (i: number, p: Partial<FormField>) => setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...p } : f)));
  const move = (i: number, d: -1 | 1) => setFields((fs) => {
    const j = i + d;
    if (j < 0 || j >= fs.length) return fs;
    const next = fs.slice();
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const addField = (type: FieldType) => setFields((fs) => [...fs, newField(type, fs)]);
  const changeType = (i: number, type: FieldType) => setFields((fs) => fs.map((f, j) => {
    if (j !== i) return f;
    return { ...f, type, options: isChoice(type) ? (f.options?.length ? f.options : ['Variant 1', 'Variant 2']) : f.options };
  }));

  const toggle = (key: 'specialties' | 'groups', code: string) => setAudience((a) => ({
    ...a, [key]: a[key].includes(code) ? a[key].filter((x) => x !== code) : [...a[key], code],
  }));

  const save = async () => {
    setErr('');
    const problem = validateDefinition({ title, description, status, audience, fields });
    if (problem) { setErr(problem); return; }
    setSaving(true);
    try {
      const input = { title, description, status, closesAt: closesAt || null, audience, fields };
      if (saved) {
        const rec = await formsApi.update(saved.id, input);
        setSaved({ ...rec, responseCount: saved.responseCount });
        toast.success('Dəyişikliklər saxlanıldı');
      } else {
        const rec = await formsApi.create(input);
        toast.success('Form yaradıldı');
        navigate(`/admin/forms/${rec.id}`, { replace: true });
      }
    } catch (e) { setErr(friendlyError(e)); }
    finally { setSaving(false); }
  };

  const copyLink = async () => {
    if (!saved) return;
    try { await navigator.clipboard.writeText(shareLink(saved.slug)); toast.success('Paylaşım linki kopyalandı'); }
    catch { toast.error('Link kopyalanmadı: ' + shareLink(saved.slug)); }
  };

  const hasResponses = (saved?.responseCount ?? 0) > 0;

  return (
    <>
      <PageHeader title={saved ? 'Formu redaktə et' : 'Yeni form'} text="Başlıq, suallar və auditoriyanı seçin, sonra statusu “Dərc olunub” edin. Tələbələr yalnız dərc olunmuş və özlərinə aid formları görür."
        actions={saved && <ButtonLink to={`/admin/forms/${saved.id}/responses`} variant="secondary"><Download className="size-4" aria-hidden />Cavablar ({saved.responseCount ?? 0})</ButtonLink>} />

      {err && <div className="mb-4"><ErrorBanner>{err}</ErrorBanner></div>}
      {hasResponses && <p className="mb-4 rounded-xl bg-accent-soft p-3 text-sm font-semibold text-accent-ink dark:text-accent">Bu formun artıq cavabları var. Sualları silmək və ya mənasını dəyişmək köhnə cavabların düzgün göstərilməsinə mane ola bilər.</p>}

      <div className="grid gap-6">
        <Card className="grid gap-4 p-5">
          <h2 className="text-lg font-bold">Əsas məlumat</h2>
          <TextField label="Başlıq" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
          <TextArea label="Təsvir (istəyə görə)" rows={3} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value as FormStatus)}>
              {(Object.keys(STATUS_LABELS) as FormStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </SelectField>
            <TextField label="Son tarix (istəyə görə)" type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} hint="Bu vaxtdan sonra cavab qəbul olunmur." />
          </div>
        </Card>

        <Card className="grid gap-4 p-5">
          <h2 className="text-lg font-bold">Auditoriya</h2>
          <div className="grid gap-2.5">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
              <input type="radio" name="aud" className="size-4.5 accent-[var(--brand)]" checked={audience.mode === 'all'} onChange={() => setAudience((a) => ({ ...a, mode: 'all' }))} />Bütün tələbələr
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
              <input type="radio" name="aud" className="size-4.5 accent-[var(--brand)]" checked={audience.mode === 'restricted'} onChange={() => setAudience((a) => ({ ...a, mode: 'restricted' }))} />Yalnız seçilmiş ixtisas və qruplar
            </label>
          </div>
          {audience.mode === 'restricted' && (
            <div className="grid gap-3">
              <p className="text-sm text-muted">İxtisası seçsəniz, həmin ixtisasın bütün qrupları daxildir. Konkret qrup seçmək üçün ixtisası açın.</p>
              {specialtyList.map((s) => (
                <div key={s.code} className="rounded-xl border border-line p-3">
                  <CheckField label={`${s.code} (bütün qruplar)`} checked={audience.specialties.includes(s.code)} onChange={() => toggle('specialties', s.code)} />
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-semibold text-brand">Qruplar</summary>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {groupsOfSpecialty(s.code).map((g) => <CheckField key={g.code} label={g.code} checked={audience.groups.includes(g.code)} onChange={() => toggle('groups', g.code)} />)}
                    </div>
                  </details>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="grid gap-4 p-5">
          <h2 className="text-lg font-bold">Suallar</h2>
          {fields.length === 0 && <p className="text-sm text-muted">Hələ sual yoxdur. Aşağıdakı düymələrlə sual növü seçib əlavə edin.</p>}
          {fields.map((f, i) => (
            <div key={f.id} className="grid gap-3 rounded-xl border border-line p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-muted">Sual {i + 1}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" aria-label={`Sual ${i + 1} yuxarı`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-4" aria-hidden /></Button>
                  <Button variant="ghost" size="sm" aria-label={`Sual ${i + 1} aşağı`} disabled={i === fields.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-4" aria-hidden /></Button>
                  <Button variant="ghost" size="sm" aria-label={`Sual ${i + 1} sil`} onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))}><Trash2 className="size-4" aria-hidden /></Button>
                </div>
              </div>
              <TextField label="Sual mətni" value={f.label} maxLength={200} onChange={(e) => patchField(i, { label: e.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectField label="Növ" value={f.type} onChange={(e) => changeType(i, e.target.value as FieldType)}>
                  {FIELD_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
                </SelectField>
                <TextField label="İzah (istəyə görə)" value={f.help ?? ''} maxLength={500} onChange={(e) => patchField(i, { help: e.target.value })} />
              </div>
              {isChoice(f.type) && <OptionsEditor value={f.options ?? []} onChange={(options) => patchField(i, { options })} />}
              <CheckField label="Məcburi sual" checked={f.required} onChange={(e) => patchField(i, { required: e.target.checked })} />
            </div>
          ))}
          <div className="flex flex-wrap gap-2" role="group" aria-label="Sual əlavə et">
            {FIELD_TYPES.map((t) => (
              <Button key={t.type} variant="secondary" size="sm" onClick={() => addField(t.type)}><Plus className="size-4" aria-hidden />{t.label}</Button>
            ))}
          </div>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button size="lg" onClick={save} loading={saving}><Save className="size-4" aria-hidden />Saxla</Button>
          <Button size="lg" variant="secondary" onClick={() => setPreview(true)} disabled={fields.length === 0}><Eye className="size-4" aria-hidden />Önizləmə</Button>
          {saved && saved.status === 'published' && <Button size="lg" variant="ghost" onClick={copyLink}><Copy className="size-4" aria-hidden />Linki kopyala</Button>}
          <ButtonLink to="/admin/forms" size="lg" variant="ghost">Formlara qayıt</ButtonLink>
        </div>
      </div>

      <Modal open={preview} onClose={() => setPreview(false)} title={title.trim() || 'Önizləmə'} wide>
        {description.trim() && <p className="mb-4 whitespace-pre-line text-muted">{description.trim()}</p>}
        <FormRenderer fields={fields.map((f) => ({ ...f, label: f.label || '(boş sual)' }))} preview />
      </Modal>
    </>
  );
}

/** Hər sətirdə bir variant. Yazarkən boş sətirlər itmir deyə xam mətn ayrıca saxlanılır. */
function OptionsEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [raw, setRaw] = useState(value.join('\n'));
  return (
    <TextArea label="Variantlar (hər sətirdə bir variant)" rows={4} value={raw}
      onChange={(e) => { setRaw(e.target.value); onChange(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean)); }} />
  );
}
