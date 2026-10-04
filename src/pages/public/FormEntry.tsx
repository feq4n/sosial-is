import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, ClipboardList, Clock, Eye } from 'lucide-react';
import { ButtonLink, Card, EmptyState, ErrorState } from '@/components/ui';
import { FormRenderer } from '@/components/forms/FormRenderer';
import { PageLoader } from '@/components/PageLoader';
import { useAuth } from '@/context/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { useSeo } from '@/hooks/useSeo';
import { formatDateTime } from '@/utils/format';
import { isClosed, type AnswerValue } from '@/lib/forms';
import { formsApi } from '@/services/forms';

/**
 * /f/:slug — paylaşım linki. Giriş (RequireAuth) tələb edir; form və auditoriya yoxlaması serverdədir (RLS + submit_form).
 * Admin formu önizləmə rejimində görür (cavab göndərilmir).
 */
export default function FormEntry() {
  useSeo('Form', undefined, { noindex: true });
  const { slug = '' } = useParams();
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const [done, setDone] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    const form = await formsApi.getBySlug(slug);
    if (!form) return { form: null, submitted: false };
    const submitted = isAdmin ? false : await formsApi.hasSubmitted(form.id);
    return { form, submitted };
  }, [slug]);

  if (loading) return <PageLoader />;
  const back = <ButtonLink to="/dashboard/forms" variant="secondary">Mənim formlarım</ButtonLink>;
  const wrap = (node: React.ReactNode) => <div className="mx-auto max-w-2xl px-4 py-12">{node}</div>;

  if (error) return wrap(<ErrorState message={error} onRetry={reload} />);
  const form = data?.form;
  if (!form) {
    return wrap(<EmptyState icon={<ClipboardList className="size-7" aria-hidden />} title="Form tapılmadı"
      text="Bu form mövcud deyil, bağlanıb və ya sizin ixtisas/qrupunuz üçün nəzərdə tutulmayıb." action={back} />);
  }
  if (done || data?.submitted) {
    return wrap(<EmptyState icon={<CheckCircle2 className="size-7" aria-hidden />} title={done ? 'Cavabınız qəbul edildi' : 'Siz bu formu artıq doldurmusunuz'}
      text={done ? 'Təşəkkür edirik! Cavabınız göndərildi.' : 'Hər form yalnız bir dəfə doldurula bilər.'} action={back} />);
  }
  if (!isAdmin && isClosed(form)) {
    return wrap(<EmptyState icon={<Clock className="size-7" aria-hidden />} title="Bu formun qəbul müddəti bitib" text="Yeni form dərc olunduqda “Formlar” bölməsində görünəcək." action={back} />);
  }

  const submit = async (answers: Record<string, AnswerValue>) => { await formsApi.submit(form.id, answers); setDone(true); };

  return wrap(
    <Card className="p-6 sm:p-8">
      {isAdmin && (
        <div role="note" className="mb-6 flex items-center gap-2 rounded-xl bg-surface-2 p-3 text-sm font-semibold text-muted"><Eye className="size-4 shrink-0" aria-hidden />Önizləmə: admin kimi cavab göndərə bilməzsiniz.</div>
      )}
      <h1 className="break-words text-2xl font-extrabold sm:text-3xl">{form.title}</h1>
      {form.description && <p className="mt-3 whitespace-pre-line text-muted">{form.description}</p>}
      {form.closesAt && <p className="mt-3 text-sm text-muted">Son tarix: {formatDateTime(form.closesAt)}</p>}
      <p className="mt-3 text-sm text-muted">Admin panelində cavab sizin adınızla göstərilmir.</p>
      <div className="mt-8"><FormRenderer fields={form.fields} onSubmit={submit} preview={isAdmin} /></div>
    </Card>,
  );
}
