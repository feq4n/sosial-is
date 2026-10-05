import { Badge, Button, Modal } from '@/components/ui';
import { formatDateTime } from '@/utils/format';
import type { StaffMessage } from '@/types';

export function StaffMessageStatusBadge({ status }: { status: StaffMessage['status'] }) {
  return status === 'read' ? <Badge tone="success">Oxundu</Badge> : <Badge>Göndərildi</Badge>;
}

/** Mesajın tam məzmunu (yalnız oxumaq üçün: redaktə, silmə və yönləndirmə yoxdur). */
export function StaffMessageDialog({ message, perspective, onClose }: { message: StaffMessage | null; perspective: 'sender' | 'recipient'; onClose: () => void }) {
  return (
    <Modal open={!!message} onClose={onClose} title={message?.subject ?? 'Mesaj'} wide>
      {message && (
        <div className="grid gap-4">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="font-semibold text-muted">{perspective === 'sender' ? 'Kimə' : 'Kimdən'}</dt><dd className="break-words">{perspective === 'sender' ? message.recipientName : message.senderName}</dd></div>
            <div><dt className="font-semibold text-muted">Göndərilmə tarixi</dt><dd>{formatDateTime(message.createdAt)}</dd></div>
            <div><dt className="font-semibold text-muted">Status</dt><dd className="mt-0.5"><StaffMessageStatusBadge status={message.status} /></dd></div>
            {message.readAt && <div><dt className="font-semibold text-muted">Oxunma vaxtı</dt><dd>{formatDateTime(message.readAt)}</dd></div>}
          </dl>
          <p className="whitespace-pre-wrap break-words rounded-xl bg-surface-2 p-4" data-testid="staff-message-body">{message.message}</p>
          <div className="flex justify-end"><Button variant="secondary" onClick={onClose}>Bağla</Button></div>
        </div>
      )}
    </Modal>
  );
}
