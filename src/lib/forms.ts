/**
 * Formlar: tiplər və təmiz məntiq (React/Supabase asılılığı yoxdur, ona görə asan test olunur).
 * Qaydalar `supabase/migrations/20261004000003_native_forms.sql` ilə eyni saxlanılmalıdır:
 * həqiqi yoxlama serverdə (trigger + submit_form) aparılır, buradakı yoxlama yalnız tez və aydın geri bildirim üçündür.
 */

export type FieldType = 'text' | 'textarea' | 'number' | 'email' | 'date' | 'radio' | 'select' | 'checkbox' | 'scale';
export type FormStatus = 'draft' | 'published' | 'closed';
export type AnswerValue = string | number | string[];
export type Answers = Record<string, AnswerValue | undefined>;

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  help?: string;
  options?: string[];
}

export interface FormAudience { mode: 'all' | 'restricted'; specialties: string[]; groups: string[] }

export const FIELD_TYPES: { type: FieldType; label: string }[] = [
  { type: 'text', label: 'Qısa mətn' },
  { type: 'textarea', label: 'Uzun mətn' },
  { type: 'number', label: 'Ədəd' },
  { type: 'email', label: 'E-poçt' },
  { type: 'date', label: 'Tarix' },
  { type: 'radio', label: 'Bir seçim (düymələr)' },
  { type: 'select', label: 'Bir seçim (siyahı)' },
  { type: 'checkbox', label: 'Çox seçim' },
  { type: 'scale', label: 'Qiymət (1–5)' },
];
export const fieldTypeLabel = (t: FieldType) => FIELD_TYPES.find((x) => x.type === t)?.label ?? t;

export const STATUS_LABELS: Record<FormStatus, string> = { draft: 'Qaralama', published: 'Dərc olunub', closed: 'Bağlanıb' };

export const CHOICE_TYPES: FieldType[] = ['radio', 'select', 'checkbox'];
export const isChoice = (t: FieldType) => CHOICE_TYPES.includes(t);

export const LIMITS = { fields: 60, title: [3, 160], description: 2000, label: 200, help: 500, options: 50, option: 200, text: 500, textarea: 4000, scaleMax: 5 } as const;

const FIELD_ID_RE = /^[a-z][a-z0-9_]{0,39}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `q1`, `q2`, … : mövcud olmayan ilk açar. Açar sualın ömrü boyu dəyişmir ki, köhnə cavablar uyğun qalsın. */
export function newFieldId(existing: Pick<FormField, 'id'>[]): string {
  const used = new Set(existing.map((f) => f.id));
  let n = 1;
  while (used.has(`q${n}`)) n += 1;
  return `q${n}`;
}

export function newField(type: FieldType, existing: Pick<FormField, 'id'>[]): FormField {
  return {
    id: newFieldId(existing), type, label: '', required: false,
    ...(isChoice(type) ? { options: ['Variant 1', 'Variant 2'] } : {}),
  };
}

/** Saxlamazdan əvvəl: mətnləri təmizləyir, seçim sahələri üçün variantları, digərləri üçün isə heç nəyi saxlamır. */
export function cleanField(f: FormField): FormField {
  const out: FormField = { id: f.id, type: f.type, label: f.label.trim(), required: Boolean(f.required) };
  const help = f.help?.trim();
  if (help) out.help = help;
  if (isChoice(f.type)) out.options = (f.options ?? []).map((o) => o.trim()).filter(Boolean);
  return out;
}

export interface FormDraft {
  title: string; description: string; status: FormStatus;
  audience: FormAudience; fields: FormField[];
}

/** Form təyininin yoxlanması. Xəta varsa Azərbaycan dilində mesaj, yoxdursa null. */
export function validateDefinition(d: FormDraft): string | null {
  const title = d.title.trim();
  if (title.length < LIMITS.title[0] || title.length > LIMITS.title[1]) return `Başlıq ${LIMITS.title[0]}–${LIMITS.title[1]} simvol olmalıdır.`;
  if (d.description.trim().length > LIMITS.description) return `Təsvir ən çox ${LIMITS.description} simvol ola bilər.`;
  if (d.fields.length > LIMITS.fields) return `Bir formda ən çox ${LIMITS.fields} sual ola bilər.`;
  if (d.status === 'published' && d.fields.length === 0) return 'Dərc etmək üçün ən azı bir sual əlavə edin.';
  if (d.audience.mode === 'restricted' && d.audience.specialties.length + d.audience.groups.length === 0) {
    return 'Auditoriya “məhdud” seçilibsə, ən azı bir ixtisas və ya qrup seçin.';
  }
  const ids = new Set<string>();
  for (const [i, raw] of d.fields.entries()) {
    const f = cleanField(raw);
    const where = `Sual ${i + 1}`;
    if (!FIELD_ID_RE.test(f.id) || ids.has(f.id)) return `${where}: daxili açar yanlışdır.`;
    ids.add(f.id);
    if (!f.label) return `${where}: sual mətni boş ola bilməz.`;
    if (f.label.length > LIMITS.label) return `${where}: sual mətni ən çox ${LIMITS.label} simvol ola bilər.`;
    if ((f.help?.length ?? 0) > LIMITS.help) return `${where}: izah ən çox ${LIMITS.help} simvol ola bilər.`;
    if (isChoice(f.type)) {
      const o = f.options ?? [];
      if (o.length < 2) return `${where}: ən azı 2 variant yazın (hər sətirdə bir variant).`;
      if (o.length > LIMITS.options) return `${where}: ən çox ${LIMITS.options} variant ola bilər.`;
      if (o.some((x) => x.length > LIMITS.option)) return `${where}: variant ən çox ${LIMITS.option} simvol ola bilər.`;
      if (new Set(o).size !== o.length) return `${where}: variantlar təkrarlanmamalıdır.`;
    }
  }
  return null;
}

const isEmptyAnswer = (v: unknown) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

function validDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return false;
  const y = d.getUTCFullYear();
  return y >= 1900 && y <= 2100;
}

/** Hər sual üçün xəta mesajı (xətasız suallar nəticədə yoxdur). */
export function validateAnswers(fields: FormField[], answers: Answers): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const v = answers[f.id];
    if (isEmptyAnswer(v)) { if (f.required) errors[f.id] = 'Bu sual məcburidir.'; continue; }
    switch (f.type) {
      case 'text': case 'textarea': case 'email': {
        if (typeof v !== 'string') { errors[f.id] = 'Mətn daxil edin.'; break; }
        const t = v.trim();
        const max = f.type === 'textarea' ? LIMITS.textarea : LIMITS.text;
        if (t.length > max) errors[f.id] = `Ən çox ${max} simvol ola bilər.`;
        else if (f.type === 'email' && !EMAIL_RE.test(t)) errors[f.id] = 'E-poçt ünvanı düzgün deyil.';
        break;
      }
      case 'number': {
        const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.trim().replace(',', '.')) : NaN;
        if (!Number.isFinite(n) || Math.abs(n) > 1e12) errors[f.id] = 'Ədəd daxil edin.';
        break;
      }
      case 'scale': {
        const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
        if (!Number.isInteger(n) || n < 1 || n > LIMITS.scaleMax) errors[f.id] = `1 ilə ${LIMITS.scaleMax} arasında qiymət seçin.`;
        break;
      }
      case 'date':
        if (typeof v !== 'string' || !validDate(v)) errors[f.id] = 'Tarix düzgün deyil.';
        break;
      case 'radio': case 'select':
        if (typeof v !== 'string' || !(f.options ?? []).includes(v)) errors[f.id] = 'Variantlardan birini seçin.';
        break;
      case 'checkbox': {
        const opts = f.options ?? [];
        if (!Array.isArray(v) || v.some((x) => !opts.includes(x)) || new Set(v).size !== v.length) errors[f.id] = 'Variantlardan seçin.';
        break;
      }
    }
  }
  return errors;
}

/** Serverə göndəriləcək təmiz cavab: yalnız təyindəki suallar, boşlar atılır, tiplər çevrilir. */
export function cleanAnswers(fields: FormField[], answers: Answers): Record<string, AnswerValue> {
  const out: Record<string, AnswerValue> = {};
  for (const f of fields) {
    const v = answers[f.id];
    if (isEmptyAnswer(v)) continue;
    switch (f.type) {
      case 'text': case 'textarea': case 'email': out[f.id] = String(v).trim(); break;
      case 'number': out[f.id] = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.')); break;
      case 'scale': out[f.id] = Number(v); break;
      case 'checkbox': out[f.id] = (v as string[]).slice(); break;
      default: out[f.id] = String(v);
    }
  }
  return out;
}

/** Vaxtı bitibsə (status «bağlanıb» və ya son tarix keçib) true. */
export function isClosed(form: { status: FormStatus; closesAt?: string }, now = Date.now()): boolean {
  if (form.status === 'closed') return true;
  if (!form.closesAt) return false;
  const t = new Date(form.closesAt).getTime();
  return Number.isFinite(t) && t <= now;
}

/** Yalnız interfeys üçün (həqiqi yoxlama RLS-də). */
export function audienceMatches(a: FormAudience, p: { specialty?: string; group?: string } | null | undefined): boolean {
  if (a.mode === 'all') return true;
  return Boolean((p?.specialty && a.specialties.includes(p.specialty)) || (p?.group && a.groups.includes(p.group)));
}

export function audienceLabel(a: FormAudience): string {
  if (a.mode === 'all') return 'Bütün tələbələr';
  const parts = [...a.specialties, ...a.groups];
  return parts.length ? parts.join(', ') : 'Heç kim';
}

/** Tələbələrə göndəriləcək paylaşım linki: portal ünvanındadır, giriş tələb edir. */
export const shareLink = (slug: string, origin = typeof window !== 'undefined' ? window.location.origin : '') => `${origin}/f/${encodeURIComponent(slug)}`;

/** Bir cavabın oxunaqlı mətni (cədvəl və CSV üçün). */
export function answerText(v: unknown): string {
  if (isEmptyAnswer(v)) return '';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

const NUMERIC_TYPES: FieldType[] = ['number', 'scale'];

/** CSV xanası: həmişə dırnaqda; Excel düstur inyeksiyasına qarşı (=, +, -, @) başlayan mətnin əvvəlinə ' qoyulur. */
export function csvCell(value: string, guard = true): string {
  const safe = guard && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

const stamp = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:00`;
};

export interface ResponseRow { id: string; submittedAt: string; answers: Record<string, unknown> }

/** UTF-8 BOM + `;` ayırıcı: Azərbaycan lokalında Excel-də düzgün açılır. */
export function responsesToCsv(fields: FormField[], rows: ResponseRow[]): string {
  const head = ['№', 'Tarix', ...fields.map((f) => f.label)];
  const body = rows.map((r, i) => [
    String(i + 1), stamp(r.submittedAt),
    ...fields.map((f) => {
      const t = answerText(r.answers[f.id]);
      // Ədəd/qiymət sahələri yalnız rəqəm ola bilər (mənfi ədəd "-5" düstur sayılmasın)
      return NUMERIC_TYPES.includes(f.type) ? csvCell(t, false) : csvCell(t);
    }),
  ]);
  const lines = [head.map((h) => csvCell(h)), ...body].map((l) => l.join(';'));
  return '\ufeff' + lines.join('\r\n');
}

export type FieldSummary =
  | { field: FormField; kind: 'choice'; total: number; counts: { label: string; count: number }[] }
  | { field: FormField; kind: 'scale'; total: number; average: number; counts: { label: string; count: number }[] }
  | { field: FormField; kind: 'other'; total: number };

/** Hər sual üzrə qısa xülasə (seçim sahələrində sayğac, qiymətdə orta). */
export function summarize(fields: FormField[], rows: ResponseRow[]): FieldSummary[] {
  return fields.map((field): FieldSummary => {
    const vals = rows.map((r) => r.answers[field.id]).filter((v) => !isEmptyAnswer(v));
    if (field.type === 'radio' || field.type === 'select' || field.type === 'checkbox') {
      const counts = (field.options ?? []).map((label) => ({
        label,
        count: vals.filter((v) => (Array.isArray(v) ? v.includes(label) : v === label)).length,
      }));
      return { field, kind: 'choice', total: vals.length, counts };
    }
    if (field.type === 'scale') {
      const nums = vals.map(Number).filter((n) => Number.isFinite(n));
      const counts = Array.from({ length: LIMITS.scaleMax }, (_, i) => ({ label: String(i + 1), count: nums.filter((n) => n === i + 1).length }));
      const average = nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100 : 0;
      return { field, kind: 'scale', total: nums.length, average, counts };
    }
    return { field, kind: 'other', total: vals.length };
  });
}
