import { Link } from 'react-router-dom';
import { Bookmark } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { useSeo } from '@/hooks/useSeo';
import { useToast } from '@/components/Toast';
import { materialsApi } from '@/services/content';
import { listSavedIds, unsaveMaterial } from '@/services/personal';
import { MaterialCard } from '@/components/cards';
import { ButtonLink, EmptyState, ErrorState, ListSkeleton, PageHeader } from '@/components/ui';
import { friendlyError } from '@/utils/errors';

export default function Saved() {
  useSeo('Saxlanılanlar', undefined, { noindex: true });
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload, setData } = useAsync(async () => {
    if (!user) return [];
    const [ids, all] = await Promise.all([listSavedIds(user.uid), materialsApi.list()]);
    return all.filter((m) => ids.includes(m.id));
  }, [user?.uid]);

  const remove = async (id: string) => {
    if (!user) return;
    const prev = data;
    setData((d) => (d ?? []).filter((m) => m.id !== id));
    try { await unsaveMaterial(user.uid, id); toast.success('Material siyahıdan çıxarıldı'); }
    catch (e) { setData(prev ?? []); toast.error(friendlyError(e)); }
  };

  return (
    <>
      <PageHeader title="Saxlanılmış materiallar" text="Yadda saxladığınız tədris materialları." />
      {loading ? <ListSkeleton rows={3} /> : error ? <ErrorState message={error} onRetry={reload} /> :
        data?.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.map((m) => <MaterialCard key={m.id} m={m} signedIn saved onToggle={() => remove(m.id)} />)}</div> :
          <EmptyState icon={<Bookmark className="size-7" aria-hidden />} title="Hələ material saxlamamısınız" text="Materiallar səhifəsində əlfəcin düyməsinə basaraq istədiyiniz materialı buraya əlavə edin." action={<ButtonLink to="/materials">Materiallara bax</ButtonLink>} />}
      <p className="sr-only"><Link to="/materials">Materiallar</Link></p>
    </>
  );
}
