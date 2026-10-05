import { supabase } from '@/lib/supabase';
import {
  cleanField, isChoice,
  type AnswerValue, type FieldType, type FormAudience, type FormField, type FormStatus, type ResponseRow,
} from '@/lib/forms';
import { expectRows, iso, isUuid, need, unwrap } from './db';

/** Formlar Supabase-də saxlanılır (public.forms / form_responses / form_submissions) və RLS ilə qorunur. Ayrıca xidmət yoxdur. */

export interface FormRecord {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: FormStatus;
  closesAt?: string;
  audience: FormAudience;
  fields: FormField[];
  createdAt: string;
  /** Yalnız admin siyahısında doldurulur */
  responseCount?: number;
}

export interface FormInput {
  title: string;
  description: string;
  status: FormStatus;
  closesAt?: string | null;
  audience: FormAudience;
  fields: FormField[];
}

/** Tələbənin öz göndərdiyi cavab (READ-ONLY). Mənbə: RPC `my_form_responses` — yalnız çağıranın cavabları. */
export interface MyResponse {
  id: string;
  formId: string;
  slug: string;
  title: string;
  description: string;
  fields: FormField[];
  answers: Record<string, unknown>;
  submittedAt: string;
}

const BASE = 'id,slug,title,description,status,closes_at,audience_mode,audience_specialties,audience_groups,fields,created_at';
const WITH_COUNT = `${BASE},form_responses(count)`;

const TYPES: FieldType[] = ['text', 'textarea', 'number', 'email', 'date', 'radio', 'select', 'checkbox', 'scale'];
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Bazadakı jsonb-ni tipli suallara çevirir; pozulmuş element varsa atılır (səhifə çökməsin). */
export function parseFields(raw: unknown): FormField[] {
  if (!Array.isArray(raw)) return [];
  const out: FormField[] = [];
  for (const x of raw) {
    const r = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.label !== 'string' || !TYPES.includes(r.type as FieldType)) continue;
    const type = r.type as FieldType;
    out.push({
      id: r.id, type, label: r.label, required: r.required === true,
      ...(typeof r.help === 'string' && r.help ? { help: r.help } : {}),
      ...(isChoice(type) ? { options: strs(r.options) } : {}),
    });
  }
  return out;
}

export function rowToForm(row: Record<string, unknown>): FormRecord {
  const rc = row.form_responses as Array<{ count?: number }> | undefined;
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    status: (['draft', 'published', 'closed'].includes(String(row.status)) ? row.status : 'draft') as FormStatus,
    ...(typeof row.closes_at === 'string' && row.closes_at ? { closesAt: iso(row.closes_at) } : {}),
    audience: {
      mode: row.audience_mode === 'restricted' ? 'restricted' : 'all',
      specialties: strs(row.audience_specialties),
      groups: strs(row.audience_groups),
    },
    fields: parseFields(row.fields),
    createdAt: iso(row.created_at),
    ...(Array.isArray(rc) ? { responseCount: Number(rc[0]?.count ?? 0) } : {}),
  };
}

export function toFormRow(i: FormInput): Record<string, unknown> {
  const restricted = i.audience.mode === 'restricted';
  return {
    title: i.title.trim(),
    description: i.description.trim(),
    status: i.status,
    closes_at: i.closesAt ? new Date(i.closesAt).toISOString() : null,
    audience_mode: i.audience.mode,
    audience_specialties: restricted ? i.audience.specialties : [],
    audience_groups: restricted ? i.audience.groups : [],
    fields: i.fields.map(cleanField),
  };
}

const PAGE = 1000;

export const formsApi = {
  /** Admin: bütün formlar + cavab sayı. */
  async listAdmin(): Promise<FormRecord[]> {
    need();
    const rows = unwrap<Array<Record<string, unknown>>>(await supabase.from('forms').select(WITH_COUNT).order('created_at', { ascending: false }));
    return rows.map(rowToForm);
  },

  /** Tələbə: yalnız dərc olunmuş və öz auditoriyasına aid formlar (RLS) + özünün doldurduqları. */
  async listForStudent(): Promise<{ forms: FormRecord[]; submitted: Set<string> }> {
    need();
    const rows = unwrap<Array<Record<string, unknown>>>(await supabase.from('forms').select(BASE).eq('status', 'published').order('created_at', { ascending: false }));
    const subs = unwrap<Array<{ form_id: string }>>(await supabase.from('form_submissions').select('form_id'));
    return { forms: rows.map(rowToForm), submitted: new Set(subs.map((s) => s.form_id)) };
  },

  /** Admin redaktoru üçün (cavab sayı ilə). */
  async getById(id: string): Promise<FormRecord | null> {
    need();
    if (!isUuid(id)) return null;
    const row = unwrap<Record<string, unknown> | null>(await supabase.from('forms').select(WITH_COUNT).eq('id', id).maybeSingle());
    return row ? rowToForm(row) : null;
  },

  /** Paylaşım linki üçün. RLS: tələbə yalnız özünə açıq dərc olunmuş formu görür, admin hamısını. */
  async getBySlug(slug: string): Promise<FormRecord | null> {
    need();
    if (!/^[a-z0-9]{6,40}$/.test(slug)) return null;
    const row = unwrap<Record<string, unknown> | null>(await supabase.from('forms').select(BASE).eq('slug', slug).maybeSingle());
    return row ? rowToForm(row) : null;
  },

  /** Tələbə: yalnız öz göndərdiyi cavablar (ən yenisi birinci). Redaktə/silmə yoxdur. */
  async myResponses(): Promise<MyResponse[]> {
    need();
    const rows = unwrap<Array<Record<string, unknown>>>(await supabase.rpc('my_form_responses'));
    return rows.map((r) => ({
      id: String(r.response_id),
      formId: String(r.form_id),
      slug: String(r.slug ?? ''),
      title: String(r.title ?? ''),
      description: String(r.description ?? ''),
      fields: parseFields(r.fields),
      answers: (r.answers && typeof r.answers === 'object' ? r.answers : {}) as Record<string, unknown>,
      submittedAt: iso(r.submitted_at),
    }));
  },

  async hasSubmitted(formId: string): Promise<boolean> {
    need();
    const row = unwrap<{ form_id: string } | null>(await supabase.from('form_submissions').select('form_id').eq('form_id', formId).maybeSingle());
    return Boolean(row);
  },

  async create(input: FormInput): Promise<FormRecord> {
    need();
    const row = unwrap<Record<string, unknown>>(await supabase.from('forms').insert(toFormRow(input)).select(BASE).single());
    return rowToForm(row);
  },

  async update(id: string, input: FormInput): Promise<FormRecord> {
    need();
    const row = unwrap<Record<string, unknown>>(await supabase.from('forms').update(toFormRow(input)).eq('id', id).select(BASE).single());
    return rowToForm(row);
  },

  async remove(id: string): Promise<void> {
    need();
    expectRows(unwrap(await supabase.from('forms').delete().eq('id', id).select('id')));
  },

  /**
   * Cavabı serverdə yoxlayıb yazır (RPC `submit_form`): auditoriya, son tarix, bir dəfə doldurma və sual qaydaları.
   * Giriş edibsə cavab ad/e-poçtla (profildən, serverdə) yazılır; qonaq (giriş etməyən) cavabı anonimdir.
   */
  async submit(formId: string, answers: Record<string, AnswerValue>): Promise<void> {
    need();
    unwrap(await supabase.rpc('submit_form', { p_form_id: formId, p_answers: answers }));
  },

  /** Admin: bütün cavablar (1000-lik səhifələrlə), cavab verənin adı və e-poçtu ilə (yalnız girişli istifadəçilər). Qonaq və köhnə cavablar anonimdir. */
  async responses(formId: string): Promise<ResponseRow[]> {
    need();
    const out: ResponseRow[] = [];
    for (let from = 0; ; from += PAGE) {
      const rows = unwrap<Array<{ id: string; answers: unknown; submitted_at: string; respondent_id: string | null; respondent_name: string | null; respondent_email: string | null }>>(
        await supabase.from('form_responses').select('id,answers,submitted_at,respondent_id,respondent_name,respondent_email').eq('form_id', formId)
          .order('submitted_at', { ascending: true }).order('id', { ascending: true }).range(from, from + PAGE - 1),
      );
      for (const r of rows) {
        out.push({
          id: r.id, submittedAt: iso(r.submitted_at), answers: (r.answers && typeof r.answers === 'object' ? r.answers : {}) as Record<string, unknown>,
          ...(r.respondent_name ? { respondentName: r.respondent_name } : {}),
          ...(r.respondent_email ? { respondentEmail: r.respondent_email } : {}),
          respondentKind: r.respondent_id ? 'student' : 'anonymous',
        });
      }
      if (rows.length < PAGE) break;
    }
    return out;
  },
};
