import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { useSeo } from '@/hooks/useSeo';
import { teamApi } from '@/services/content';
import { TeamCard } from '@/components/TeamCard';
import { SendMessageDialog, type MessageTarget } from '@/components/SendMessageDialog';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui';
import type { TeamMember } from '@/types';

/** Şöbə rəhbərliyi, müəllimlər və əməkdaşlar. Məlumat admin paneldəki «Şöbə əməkdaşları» bölməsindən gəlir (cədvəl: team_members). */
export default function Staff() {
  useSeo('Şöbə əməkdaşları', 'Şöbə rəhbərliyi, müəllimlər və əməkdaşlar haqqında akademik məlumat.');
  const { data, loading, error, reload } = useAsync(() => teamApi.list(), []);
  const { user } = useAuth();
  const [target, setTarget] = useState<MessageTarget | null>(null);

  const startMessage = (m: TeamMember) => {
    if (!m.profileId) return;
    setTarget({ profileId: m.profileId, name: m.fullName, jobTitle: m.jobTitle });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <PageHeader title="Şöbə əməkdaşları" text="Şöbə rəhbərliyi, müəllimlər və əməkdaşlar." />
      {loading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-64" />)}</div>
        : error ? <ErrorState message={error} onRetry={reload} />
        : data?.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{data.map((m) => <TeamCard key={m.id} m={m} onMessage={m.profileId && m.profileId !== user?.uid ? startMessage : undefined} />)}</div>
        : <EmptyState title="Əməkdaş məlumatları hələ əlavə olunmayıb" text="Məlumatlar əlavə olunduqda burada görünəcək." />}
      <SendMessageDialog target={target} onClose={() => setTarget(null)} />
    </div>
  );
}
