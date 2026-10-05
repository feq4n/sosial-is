import { ArrowLeft, ClipboardList } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Badge, ButtonLink, Card, EmptyState, ErrorState, ListSkeleton } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { useSeo } from '@/hooks/useSeo';
import { formatDateTime } from '@/utils/format';
import { answerText } from '@/lib/forms';
import { formsApi } from '@/services/forms';

/**
 * /dashboard/forms/:formId — tələbənin öz göndərdiyi cavab. YALNIZ OXUMAQ: redaktə, silmə və yenidən göndərmə yoxdur.
 * Serverdə my_form_responses() yalnız çağıranın cavablarını qaytarır; başqa tələbənin cavabına çıxış mümkün deyil.
 */
export default function FormSubmission() {
  useSeo('Form cavabım', undefined, { noindex: true });
  const { formId = '' } = useParams();
  const { data, loading, error, reload } = useAsync(async () => (await formsApi.myResponses()).filter((r) => r.formId === formId), [formId]);
  const back = <Link to="/dashboard/forms" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"><ArrowLeft className="size-4" aria-hidden />Formlar</Link>;

  if (loading) return <>{back}<ListSkeleton rows={2} /></>;
  if (error) return <>{back}<ErrorState message={error} onRetry={reload} /></>;
  if (!data?.length) {
    return <>{back}<EmptyState icon={<ClipboardList className="size-7" aria-hidden />} title="Cavab tapılmadı" text="Bu form üçün göndərilmiş cavabınız yoxdur." action={<ButtonLink to="/dashboard/forms" variant="secondary">Formlar</ButtonLink>} /></>;
  }
  return (
    <>
      {back}
      <div className="grid gap-6">
        {data.map((r) => (
          <Card key={r.id} className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="break-words text-2xl font-extrabold sm:text-3xl">{r.title || 'Adsız form'}</h1>
                <p className="mt-1 text-sm text-muted">Göndərilmə tarixi: {formatDateTime(r.submittedAt)}</p>
              </div>
              <Badge tone="success">Göndərilib</Badge>
            </div>
            <dl className="mt-6 grid gap-5">
              {r.fields.map((f) => (
                <div key={f.id}>
                  <dt className="text-sm font-semibold text-muted">{f.label}</dt>
                  <dd className="mt-1 whitespace-pre-line break-words">{answerText(r.answers[f.id]) || '—'}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ))}
      </div>
    </>
  );
}
