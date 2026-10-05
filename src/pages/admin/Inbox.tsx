import { useState } from 'react';
import { Inbox } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { useSeo } from '@/hooks/useSeo';
import { useToast } from '@/components/Toast';
import { Badge, Button, Card, EmptyState, ErrorState, ListSkeleton, PageHeader, cx } from '@/components/ui';
import { StaffMessageDialog } from '@/components/StaffMessageViews';
import { listInboxMessages, markStaffMessageRead } from '@/services/staffMessages';
import { friendlyError } from '@/utils/errors';
import { formatDateTime } from '@/utils/format';
import type { StaffMessage } from '@/types';

/** Əməkdaşa (admin və redaktora) göndərilən mesajlar. Mesaj açılanda avtomatik «Oxundu» olur. */
export function AdminInbox() {
  useSeo('Mesajlarım', undefined, { noindex: true });
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload, setData } = useAsync(() => (user ? listInboxMessages(user.uid) : Promise.resolve([] as StaffMessage[])), [user?.uid]);
  const [open, setOpen] = useState<StaffMessage | null>(null);

  const openMessage = async (m: StaffMessage) => {
    setOpen(m);
    if (m.status !== 'sent') return;
    try {
      const res = await markStaffMessageRead(m.id);
      const readAt = res?.readAt ?? new Date().toISOString();
      const next: StaffMessage = { ...m, status: 'read', readAt };
      setData((prev) => (prev ?? []).map((x) => (x.id === m.id ? next : x)));
      setOpen((cur) => (cur?.id === m.id ? next : cur));
    } catch (e) {
      toast.error(friendlyError(e));
    }
  };

  const unread = data?.filter((m) => m.status === 'sent').length ?? 0;
  return (
    <>
      <PageHeader title="Mesajlarım" text={unread ? `${unread} oxunmamış mesajınız var.` : 'Tələbələrin sizə göndərdiyi müraciətlər.'} />
      {loading ? <ListSkeleton rows={3} /> : error ? <ErrorState message={error} onRetry={reload} /> :
        data?.length ? (
          <ul className="grid gap-3">
            {data.map((m) => {
              const isNew = m.status === 'sent';
              return (
                <li key={m.id}>
                  <Card className={cx('flex flex-col gap-3 p-4 sm:flex-row sm:items-center', isNew && 'border-brand/50 bg-brand-soft/40')} data-testid={`inbox-${m.id}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        {isNew ? <Badge tone="accent">Oxunmamış</Badge> : <Badge tone="success">Oxunub</Badge>}
                        <time dateTime={m.createdAt}>{formatDateTime(m.createdAt)}</time>
                      </div>
                      <p className={cx('mt-1 break-words', isNew ? 'font-extrabold' : 'font-semibold')}>{m.subject}</p>
                      <p className="break-words text-sm text-muted">Kimdən: {m.senderName}</p>
                    </div>
                    <Button size="sm" variant={isNew ? 'primary' : 'secondary'} onClick={() => openMessage(m)} aria-label={`Mesajı aç: ${m.subject}`}>Mesajı aç</Button>
                  </Card>
                </li>
              );
            })}
          </ul>
        ) : <EmptyState icon={<Inbox className="size-7" aria-hidden />} title="Hələ mesaj yoxdur" text="Tələbələr sizə mesaj göndərdikdə burada görünəcək." />}
      <StaffMessageDialog message={open} perspective="recipient" onClose={() => setOpen(null)} />
    </>
  );
}
