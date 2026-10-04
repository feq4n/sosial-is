import { useState } from 'react';
import { ClipboardList, Copy, Pencil, Plus, Download, Trash2 } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, ConfirmDialog, EmptyState, ErrorBanner, ErrorState, ListSkeleton, PageHeader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useAsync } from '@/hooks/useAsync';
import { useSeo } from '@/hooks/useSeo';
import { friendlyError } from '@/utils/errors';
import { formatDateTime } from '@/utils/format';
import { audienceLabel, isClosed, shareLink } from '@/lib/forms';
import { formsApi, type FormRecord } from '@/services/forms';

const statusBadge = (f: FormRecord) => {
  if (f.status === 'draft') return <Badge>Qaralama</Badge>;
  if (isClosed(f)) return <Badge tone="danger">Bağlanıb</Badge>;
  return <Badge tone="success">Dərc olunub</Badge>;
};

export function AdminForms() {
  useSeo('Formlar (admin)', undefined, { noindex: true });
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => formsApi.listAdmin(), []);
  const [del, setDel] = useState<FormRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState('');

  const copy = async (slug: string) => {
    try { await navigator.clipboard.writeText(shareLink(slug)); toast.success('Paylaşım linki kopyalandı'); }
    catch { toast.error('Link kopyalanmadı. Əl ilə seçib kopyalayın: ' + shareLink(slug)); }
  };
  const confirmDelete = async () => {
    if (!del) return;
    setDeleting(true); setErr('');
    try { await formsApi.remove(del.id); toast.success('Form silindi'); setDel(null); reload(); }
    catch (e) { setErr(friendlyError(e)); setDel(null); }
    finally { setDeleting(false); }
  };

  const forms = data ?? [];
  return (
    <>
      <PageHeader title="Formlar" text="Sorğu və qeydiyyat formları. Sualları özünüz qurur, kimlərin görəcəyini ixtisas və ya qrup üzrə seçir, cavabları isə burada görüb CSV kimi yükləyirsiniz."
        actions={<ButtonLink to="/admin/forms/new"><Plus className="size-4" aria-hidden />Yeni form</ButtonLink>} />
      {err && <div className="mb-4"><ErrorBanner>{err}</ErrorBanner></div>}
      {loading ? <ListSkeleton /> : error ? <ErrorState message={error} onRetry={reload} /> : forms.length === 0 ? (
        <EmptyState icon={<ClipboardList className="size-7" aria-hidden />} title="Hələ form yoxdur" text="“Yeni form” düyməsi ilə ilk formu yaradın."
          action={<ButtonLink to="/admin/forms/new"><Plus className="size-4" aria-hidden />Yeni form</ButtonLink>} />
      ) : (
        <div className="grid gap-4">
          {forms.map((f) => (
            <Card key={f.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-lg font-bold">{f.title || 'Adsız form'}</h2>
                  <p className="mt-1 text-sm text-muted">
                    Auditoriya: <span className="font-semibold text-ink">{audienceLabel(f.audience)}</span> · Cavab sayı: <span className="font-semibold text-ink">{f.responseCount ?? 0}</span>
                    {f.closesAt && <> · Son tarix: <span className="font-semibold text-ink">{formatDateTime(f.closesAt)}</span></>}
                  </p>
                </div>
                {statusBadge(f)}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <ButtonLink to={`/admin/forms/${f.id}`} variant="secondary" size="sm"><Pencil className="size-4" aria-hidden />Redaktə et</ButtonLink>
                <ButtonLink to={`/admin/forms/${f.id}/responses`} variant="secondary" size="sm"><Download className="size-4" aria-hidden />Cavablar və ixrac</ButtonLink>
                {f.status === 'published' && <Button variant="ghost" size="sm" onClick={() => copy(f.slug)}><Copy className="size-4" aria-hidden />Linki kopyala</Button>}
                <Button variant="ghost" size="sm" onClick={() => setDel(f)}><Trash2 className="size-4" aria-hidden />Sil</Button>
              </div>
              {f.status !== 'published' && <p className="mt-3 text-xs text-muted">Link yalnız form “Dərc olunub” statusunda olduqda tələbələr üçün işləyir.</p>}
            </Card>
          ))}
        </div>
      )}
      <ConfirmDialog open={Boolean(del)} onClose={() => setDel(null)} onConfirm={confirmDelete} loading={deleting}
        title="Formu sil" text={`“${del?.title ?? ''}” formu və bütün cavabları həmişəlik silinəcək. Bu əməliyyat geri qaytarılmır.`} />
    </>
  );
}
