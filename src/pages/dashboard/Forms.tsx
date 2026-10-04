import { ClipboardList } from 'lucide-react';
import { Badge, ButtonLink, Card, EmptyState, ErrorState, ListSkeleton, PageHeader } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { useSeo } from '@/hooks/useSeo';
import { formatDateTime } from '@/utils/format';
import { isClosed } from '@/lib/forms';
import { formsApi } from '@/services/forms';

export default function StudentForms() {
  useSeo('Formlar', undefined, { noindex: true });
  const { data, loading, error, reload } = useAsync(() => formsApi.listForStudent(), []);
  // Doldurulmuşlar həmişə görünür; doldurulmamışlardan yalnız vaxtı bitməyənlər.
  const forms = (data?.forms ?? []).filter((f) => data?.submitted.has(f.id) || !isClosed(f));
  return (
    <>
      <PageHeader title="Formlar" text="Sizin ixtisas və qrupunuz üçün açıq olan sorğu və formlar." />
      {loading ? <ListSkeleton /> : error ? <ErrorState message={error} onRetry={reload} /> : forms.length === 0 ? (
        <EmptyState icon={<ClipboardList className="size-7" aria-hidden />} title="Hazırda sizin üçün açıq form yoxdur" text="Yeni form dərc olunduqda burada görünəcək." />
      ) : (
        <div className="grid gap-4">
          {forms.map((f) => {
            const done = data?.submitted.has(f.id);
            return (
              <Card key={f.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div className="min-w-0">
                  <h2 className="break-words text-lg font-bold">{f.title || 'Adsız form'}</h2>
                  {f.closesAt && <p className="mt-1 text-sm text-muted">Son tarix: {formatDateTime(f.closesAt)}</p>}
                </div>
                {done
                  ? <Badge tone="success">Doldurulub</Badge>
                  : <ButtonLink to={`/f/${encodeURIComponent(f.slug)}`}>Doldur</ButtonLink>}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
