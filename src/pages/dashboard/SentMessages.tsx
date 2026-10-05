import { useState } from 'react';
import { Send } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { useSeo } from '@/hooks/useSeo';
import { Button, ButtonLink, Card, EmptyState, ErrorState, ListSkeleton, PageHeader } from '@/components/ui';
import { StaffMessageDialog, StaffMessageStatusBadge } from '@/components/StaffMessageViews';
import { listSentMessages } from '@/services/staffMessages';
import { formatDateTime } from '@/utils/format';
import type { StaffMessage } from '@/types';

/** Tələbənin göndərdiyi mesajlar. Yalnız oxumaq olar: redaktə, silmə və yönləndirmə yoxdur. */
export default function SentMessages() {
  useSeo('Göndərdiyim mesajlar', undefined, { noindex: true });
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => (user ? listSentMessages(user.uid) : Promise.resolve([] as StaffMessage[])), [user?.uid]);
  const [open, setOpen] = useState<StaffMessage | null>(null);

  return (
    <>
      <PageHeader title="Göndərdiyim mesajlar" text="Şöbə əməkdaşlarına göndərdiyiniz müraciətlər və onların oxunma vəziyyəti." />
      {loading ? <ListSkeleton rows={3} /> : error ? <ErrorState message={error} onRetry={reload} /> :
        data?.length ? (
          <ul className="grid gap-3">
            {data.map((m) => (
              <li key={m.id}>
                <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center" data-testid={`sent-${m.id}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <StaffMessageStatusBadge status={m.status} />
                      <time dateTime={m.createdAt}>{formatDateTime(m.createdAt)}</time>
                    </div>
                    <p className="mt-1 break-words font-bold">{m.subject}</p>
                    <p className="break-words text-sm text-muted">Kimə: {m.recipientName}</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => setOpen(m)} aria-label={`Mesajı aç: ${m.subject}`}>Mesajı aç</Button>
                </Card>
              </li>
            ))}
          </ul>
        ) : <EmptyState icon={<Send className="size-7" aria-hidden />} title="Hələ mesaj göndərməmisiniz" text="Şöbə əməkdaşları səhifəsində əməkdaşın kartındakı «Mesaj göndər» düyməsindən istifadə edin."
            action={<ButtonLink to="/staff">Əməkdaşlara bax</ButtonLink>} />}
      <StaffMessageDialog message={open} perspective="sender" onClose={() => setOpen(null)} />
    </>
  );
}
