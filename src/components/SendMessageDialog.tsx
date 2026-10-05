import { useState } from 'react';
import { Modal } from '@/components/ui';
import { StaffMessageForm, type MessageTarget } from '@/components/StaffMessageForm';

export type { MessageTarget };

export function SendMessageDialog({ target, onClose }: { target: MessageTarget | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={!!target} onClose={() => { if (!busy) onClose(); }} title="Mesaj göndər">
      {target && <StaffMessageForm key={target.profileId} target={target} onBusyChange={setBusy} onSent={onClose} onCancel={onClose} />}
    </Modal>
  );
}
