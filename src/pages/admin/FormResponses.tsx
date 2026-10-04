import { ArrowLeft, Download } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Button, ButtonLink, Card, EmptyState, ErrorState, ListSkeleton, PageHeader } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { useSeo } from '@/hooks/useSeo';
import { answerText, responsesToCsv, summarize, type FormField } from '@/lib/forms';
import { formatDateTime } from '@/utils/format';
import { formsApi } from '@/services/forms';

function downloadCsv(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

/** /admin/forms/:id/responses — cavab cədvəli, xülasə və CSV ixracı. Cavablarda tələbə adı/e-poçtu yoxdur. */
export function AdminFormResponses() {
  useSeo('Form cavabları (admin)', undefined, { noindex: true });
  const { id = '' } = useParams();
  const { data, loading, error, reload } = useAsync(async () => {
    const form = await formsApi.getById(id);
    if (!form) return null;
    return { form, rows: await formsApi.responses(form.id) };
  }, [id]);

  const back = <ButtonLink to="/admin/forms" variant="secondary"><ArrowLeft className="size-4" aria-hidden />Formlara qayıt</ButtonLink>;
  if (loading) return <ListSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <EmptyState title="Form tapılmadı" text="Bu form silinib və ya mövcud deyil." action={back} />;

  const { form, rows } = data;
  const fields: FormField[] = form.fields;
  const summary = summarize(fields, rows);

  return (
    <>
      <PageHeader title={form.title} text={`Cavab sayı: ${rows.length}. Cavablar anonimdir: kimin doldurduğu göstərilmir. Vaxt saat dəqiqliyi ilə yazılır.`}
        actions={<div className="flex flex-wrap gap-2">
          {back}
          <Button onClick={() => downloadCsv(`${form.slug}-cavablar.csv`, responsesToCsv(fields, rows))} disabled={rows.length === 0}><Download className="size-4" aria-hidden />CSV yüklə</Button>
        </div>} />

      {rows.length === 0 ? (
        <EmptyState title="Hələ cavab yoxdur" text="Tələbələr formu doldurduqca cavablar burada görünəcək." />
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-4 md:grid-cols-2">
            {summary.map((s, i) => (
              <Card key={s.field.id} className="p-5">
                <h2 className="break-words font-bold">{i + 1}. {s.field.label}</h2>
                <p className="mt-1 text-xs text-muted">{s.total} cavab</p>
                {s.kind === 'choice' && (
                  <ul className="mt-3 grid gap-2">
                    {s.counts.map((c) => (
                      <li key={c.label} className="text-sm">
                        <div className="flex justify-between gap-3"><span className="break-words">{c.label}</span><span className="shrink-0 font-semibold">{c.count} · {pct(c.count, s.total)}%</span></div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-brand" style={{ width: `${pct(c.count, s.total)}%` }} /></div>
                      </li>
                    ))}
                  </ul>
                )}
                {s.kind === 'scale' && (
                  <div className="mt-3">
                    <p className="text-2xl font-extrabold">{s.average.toString().replace('.', ',')}<span className="text-sm font-semibold text-muted"> / 5 orta</span></p>
                    <p className="mt-1 text-xs text-muted">{s.counts.map((c) => `${c.label}: ${c.count}`).join(' · ')}</p>
                  </div>
                )}
              </Card>
            ))}
          </div>

          <Card className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <th scope="col" className="px-4 py-3 font-semibold">№</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Tarix</th>
                  {fields.map((f) => <th key={f.id} scope="col" className="px-4 py-3 font-semibold">{f.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className="border-b border-line last:border-0 align-top">
                    <td className="px-4 py-3 text-muted">{i + 1}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateTime(r.submittedAt)}</td>
                    {fields.map((f) => <td key={f.id} className="max-w-xs whitespace-pre-line break-words px-4 py-3">{answerText(r.answers[f.id]) || '—'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </>
  );
}
