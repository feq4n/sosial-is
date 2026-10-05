import { useAsync } from '@/hooks/useAsync';
import { useSeo } from '@/hooks/useSeo';
import { teamApi } from '@/services/content';
import { TeamCard } from '@/components/TeamCard';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui';

/** Şöbə rəhbərliyi, müəllimlər və əməkdaşlar. Məlumat admin paneldəki «Şöbə əməkdaşları» bölməsindən gəlir (cədvəl: team_members). */
export default function Staff() {
  useSeo('Şöbə əməkdaşları', 'Şöbə rəhbərliyi, müəllimlər və əməkdaşlar haqqında akademik məlumat.');
  const { data, loading, error, reload } = useAsync(() => teamApi.list(), []);
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <PageHeader title="Şöbə əməkdaşları" text="Şöbə rəhbərliyi, müəllimlər və əməkdaşlar." />
      {loading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-64" />)}</div>
        : error ? <ErrorState message={error} onRetry={reload} />
        : data?.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{data.map((m) => <TeamCard key={m.id} m={m} />)}</div>
        : <EmptyState title="Əməkdaş məlumatları hələ əlavə olunmayıb" text="Məlumatlar əlavə olunduqda burada görünəcək." />}
    </div>
  );
}
