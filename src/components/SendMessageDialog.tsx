import { useState, type FormEvent } from 'react';
import { Button, ErrorBanner, Modal, TextArea, TextField } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { MESSAGE_MAX, SUBJECT_MAX, validateStaffMessage } from '@/lib/staffMessages';
import { sendStaffMessage } from '@/services/staffMessages';
import { friendlyError } from '@/utils/errors';

export interface MessageTarget { profileId: string; name: string; jobTitle?: string }

/** «Mesaj göndər» pəncərəsi: alıcı kartdan gəlir (ayrıca seçilmir), mövzu və mesaj məcburidir. */
export function SendMessageDialog({ target, onClose }: { target: MessageTarget | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={!!target} onClose={() => { if (!busy) onClose(); }} title="Mesaj göndər">
      {target && <MessageForm key={target.profileId} target={target} busy={busy} setBusy={setBusy} onClose={onClose} />}
    </Modal>
  );
}

function MessageForm({ target, busy, setBusy, onClose }: { target: MessageTarget; busy: boolean; setBusy: (v: boolean) => void; onClose: () => void }) {
  const toast = useToast();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState('');
  const errors = submitted ? validateStaffMessage(subject, message) : {};

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setSubmitted(true);
    setServerError('');
    if (Object.keys(validateStaffMessage(subject, message)).length) return;
    setBusy(true);
    try {
      await sendStaffMessage({ recipientId: target.profileId, subject, message });
      toast.success('Mesajınız göndərildi.');
      onClose();
    } catch (err) {
      setServerError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <TextField label="Kimə" value={target.jobTitle ? `${target.name} — ${target.jobTitle}` : target.name} readOnly />
      <TextField label="Mövzu" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={SUBJECT_MAX} autoComplete="off" disabled={busy}
        error={errors.subject} hint={`${subject.length} / ${SUBJECT_MAX}`} />
      <TextArea label="Mesaj" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={MESSAGE_MAX} disabled={busy}
        error={errors.message} hint={`${message.length} / ${MESSAGE_MAX}`} />
      {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
      <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
        <Button variant="secondary" className="w-full sm:w-auto" onClick={onClose} disabled={busy}>Ləğv et</Button>
        <Button type="submit" className="w-full sm:w-auto" loading={busy}>Göndər</Button>
      </div>
    </form>
  );
}
