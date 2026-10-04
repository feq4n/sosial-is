import { useId, useState } from 'react';
import { Button, CheckField, ErrorBanner, SelectField, TextArea, TextField, cx } from '@/components/ui';
import { cleanAnswers, LIMITS, validateAnswers, type AnswerValue, type Answers, type FormField } from '@/lib/forms';
import { friendlyError } from '@/utils/errors';

interface Props {
  fields: FormField[];
  /** Verilməyibsə və ya `preview` aktivdirsə, göndərmə düyməsi işləmir (önizləmə). */
  onSubmit?: (answers: Record<string, AnswerValue>) => Promise<void>;
  preview?: boolean;
  submitLabel?: string;
}

/** Form təyinini göstərir, cavabı yoxlayır və `onSubmit`-ə təmizlənmiş cavab verir. Həm doldurma, həm önizləmə üçün. */
export function FormRenderer({ fields, onSubmit, preview, submitLabel = 'Göndər' }: Props) {
  const uid = useId();
  const [values, setValues] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const set = (id: string, v: Answers[string]) => {
    setValues((s) => ({ ...s, [id]: v }));
    setErrors((s) => { if (!s[id]) return s; const next = { ...s }; delete next[id]; return next; });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (preview || !onSubmit) return;
    setFormError('');
    const errs = validateAnswers(fields, values);
    setErrors(errs);
    if (Object.keys(errs).length) { setFormError('Qırmızı ilə işarələnmiş sahələri düzəldin.'); return; }
    setBusy(true);
    try { await onSubmit(cleanAnswers(fields, values)); }
    catch (err) { setFormError(friendlyError(err)); }
    finally { setBusy(false); }
  };

  const label = (f: FormField) => (f.required ? `${f.label} *` : f.label);

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      {fields.map((f) => {
        const err = errors[f.id];
        const v = values[f.id];
        switch (f.type) {
          case 'text': case 'email':
            return <TextField key={f.id} label={label(f)} hint={f.help} error={err} type={f.type === 'email' ? 'email' : 'text'} maxLength={LIMITS.text}
              value={typeof v === 'string' ? v : ''} onChange={(e) => set(f.id, e.target.value)} />;
          case 'textarea':
            return <TextArea key={f.id} label={label(f)} hint={f.help} error={err} maxLength={LIMITS.textarea}
              value={typeof v === 'string' ? v : ''} onChange={(e) => set(f.id, e.target.value)} />;
          case 'number':
            return <TextField key={f.id} label={label(f)} hint={f.help} error={err} type="number" inputMode="decimal" step="any"
              value={typeof v === 'string' || typeof v === 'number' ? String(v) : ''} onChange={(e) => set(f.id, e.target.value)} />;
          case 'date':
            return <TextField key={f.id} label={label(f)} hint={f.help} error={err} type="date"
              value={typeof v === 'string' ? v : ''} onChange={(e) => set(f.id, e.target.value)} />;
          case 'select':
            return (
              <SelectField key={f.id} label={label(f)} hint={f.help} error={err} value={typeof v === 'string' ? v : ''} onChange={(e) => set(f.id, e.target.value)}>
                <option value="">Seçin…</option>
                {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
              </SelectField>
            );
          case 'radio':
            return (
              <fieldset key={f.id} className="grid gap-2.5">
                <legend className="mb-1 text-sm font-semibold">{label(f)}</legend>
                {f.help && <p className="text-xs text-muted">{f.help}</p>}
                {(f.options ?? []).map((o) => (
                  <label key={o} className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
                    <input type="radio" name={`${uid}-${f.id}`} className="size-4.5 accent-[var(--brand)]" checked={v === o} onChange={() => set(f.id, o)} />{o}
                  </label>
                ))}
                {err && <p role="alert" className="text-xs font-semibold text-danger">{err}</p>}
              </fieldset>
            );
          case 'checkbox': {
            const chosen = Array.isArray(v) ? v : [];
            return (
              <fieldset key={f.id} className="grid gap-2.5">
                <legend className="mb-1 text-sm font-semibold">{label(f)}</legend>
                {f.help && <p className="text-xs text-muted">{f.help}</p>}
                {(f.options ?? []).map((o) => (
                  <CheckField key={o} label={o} checked={chosen.includes(o)}
                    onChange={(e) => set(f.id, e.target.checked ? [...chosen, o] : chosen.filter((x) => x !== o))} />
                ))}
                {err && <p role="alert" className="text-xs font-semibold text-danger">{err}</p>}
              </fieldset>
            );
          }
          case 'scale':
            return (
              <fieldset key={f.id} className="grid gap-2.5">
                <legend className="mb-1 text-sm font-semibold">{label(f)}</legend>
                {f.help && <p className="text-xs text-muted">{f.help}</p>}
                <div className="flex gap-2" role="group" aria-label={f.label}>
                  {Array.from({ length: LIMITS.scaleMax }, (_, i) => i + 1).map((n) => (
                    <button key={n} type="button" aria-pressed={v === n} aria-label={`${n} / ${LIMITS.scaleMax}`} onClick={() => set(f.id, n)}
                      className={cx('size-11 rounded-xl border text-base font-bold transition', v === n ? 'border-brand bg-brand text-brand-ink' : 'border-line bg-surface hover:bg-surface-2')}>{n}</button>
                  ))}
                </div>
                <p className="text-xs text-muted">1 — ən aşağı, {LIMITS.scaleMax} — ən yüksək</p>
                {err && <p role="alert" className="text-xs font-semibold text-danger">{err}</p>}
              </fieldset>
            );
        }
      })}
      {formError && <ErrorBanner>{formError}</ErrorBanner>}
      {preview
        ? <p className="text-sm font-semibold text-muted">Önizləmə rejimi: cavab göndərilmir.</p>
        : <div><Button type="submit" size="lg" loading={busy}>{submitLabel}</Button></div>}
    </form>
  );
}
