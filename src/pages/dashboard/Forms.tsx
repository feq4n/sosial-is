import { ClipboardList } from 'lucide-react';
import { Badge, ButtonLink, Card, EmptyState, ErrorState, ListSkeleton, PageHeader } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { useSeo } from '@/hooks/useSeo';
import { formatDateTime } from '@/utils/format';
import { isClosed } from '@/lib/forms';
import { formsApi } from '@/services/forms';

export default function StudentForms() {
  useSeo('Formlar', undefined, { noindex: true });
  const { data, loading, error, reload } = useAsync(async () => {
    const [open, mine] = await Promise.all([formsApi.listForStudent(), formsApi.myResponses()]);
    return { open, mine };
  }, []);
  // Doldurulmamış və vaxtı bitməmiş formlar.
  const todo = (data?.open.forms ?? []).filter((f) => !data?.open.submitted.has(f.id) && !isClosed(f));
  const mine = data?.mine ?? [];
  return (
    <>
      <PageHeader title="Formlar" text="Doldurmaq üçün açıq formlar və göndərdiyiniz cavablar." />
      {loading ? <ListSkeleton /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="grid gap-10">
          <section aria-labelledby="todo-h">
            <h2 id="todo-h" className="mb-3 text-xl font-bold">Açıq formlar</h2>
            {todo.length === 0 ? (
              <EmptyState icon={<ClipboardList className="size-7" aria-hidden />} title="Hazırda sizin üçün açıq form yoxdur" text="Yeni form dərc olunduqda burada görünəcək." />
            ) : (
              <div className="grid gap-3">
                {todo.map((f) => (
                  <Card key={f.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <div className="min-w-0">
                      <h3 className="break-words text-lg font-bold">{f.title || 'Adsız form'}</h3>
                      {f.closesAt && <p className="mt-1 text-sm text-muted">Son tarix: {formatDateTime(f.closesAt)}</p>}
                    </div>
                    <ButtonLink to={`/f/${encodeURIComponent(f.slug)}`}>Doldur</ButtonLink>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="mine-h">
            <h2 id="mine-h" className="mb-3 text-xl font-bold">Form cavablarım</h2>
            {mine.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-center text-muted">Hələ heç bir formu doldurmamısınız.</p>
            ) : (
              <div className="grid gap-3">
                {mine.map((r) => (
                  <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <div className="min-w-0">
                      <h3 className="break-words text-lg font-bold">{r.title || 'Adsız form'}</h3>
                      <p className="mt-1 text-sm text-muted">Göndərilmə tarixi: {formatDateTime(r.submittedAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge tone="success">Göndərilib</Badge>
                      <ButtonLink to={`/dashboard/forms/${r.formId}`} variant="secondary" size="sm">Bax</ButtonLink>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
