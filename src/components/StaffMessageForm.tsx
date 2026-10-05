import { useState, type FormEvent } from 'react';
import { Button, ErrorBanner, SelectField, TextArea, TextField } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import { MESSAGE_MAX, SENDER_GROUP_MAX, SENDER_NAME_MAX, SUBJECT_MAX, validateStaffMessageFields } from '@/lib/staffMessages';
import { sendStaffMessage } from '@/services/staffMessages';
import { friendlyError } from '@/utils/errors';

export interface MessageTarget { profileId: string; name: string; jobTitle?: string }

interface Props {
  target?: MessageTarget | null;
  recipients?: MessageTarget[];
  onSent?: () => void;
  onCancel?: () => void;
  onBusyChange?: (busy: boolean) => void;
}

const label = (t: MessageTarget) => (t.jobTitle ? `${t.name} — ${t.jobTitle}` : t.name);

export function StaffMessageForm({ target, recipients = [], onSent, onCancel, onBusyChange }: Props) {
  const toast = useToast();
  const { profile } = useAuth();
  const [busy, setBusyState] = useState(false);
  const [recipientId, setRecipientId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestGroup, setGuestGroup] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState('');

  const profileName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : '';
  const nameLocked = !!profileName;
  const groupLocked = !!profile?.group;
  const senderName = nameLocked ? profileName : guestName;
  const senderGroup = groupLocked ? String(profile?.group) : guestGroup;
  const effectiveRecipient = target?.profileId ?? recipientId;

  const fields = { recipientId: effectiveRecipient, senderName, senderGroup, subject, message };
  const errors = submitted ? validateStaffMessageFields(fields) : {};

  const setBusy = (v: boolean) => { setBusyState(v); onBusyChange?.(v); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setSubmitted(true);
    setServerError('');
    if (Object.keys(validateStaffMessageFields(fields)).length) return;
    setBusy(true);
    try {
      await sendStaffMessage(fields);
      toast.success('Mesajınız göndərildi.');
      setSubject('');
      setMessage('');
      setSubmitted(false);
      onSent?.();
    } catch (err) {
      setServerError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      {target
        ? <TextField label="Kimə" value={label(target)} readOnly />
        : (
          <SelectField label="Kimə" value={recipientId} onChange={(e) => setRecipientId(e.target.value)} disabled={busy} error={errors.recipient}>
            <option value="">Əməkdaşı seçin</option>
            {recipients.map((r) => <option key={r.profileId} value={r.profileId}>{label(r)}</option>)}
          </SelectField>
        )}
      <TextField label="Ad və soyad" value={senderName} onChange={(e) => setGuestName(e.target.value)} readOnly={nameLocked} maxLength={SENDER_NAME_MAX}
        autoComplete="name" disabled={busy} error={errors.senderName} />
      <TextField label="Qrup" value={senderGroup} onChange={(e) => setGuestGroup(e.target.value)} readOnly={groupLocked} maxLength={SENDER_GROUP_MAX}
        autoComplete="off" disabled={busy} error={errors.senderGroup} />
      <TextField label="Mövzu" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={SUBJECT_MAX} autoComplete="off" disabled={busy}
        error={errors.subject} hint={`${subject.length} / ${SUBJECT_MAX}`} />
      <TextArea label="Mesaj" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={MESSAGE_MAX} disabled={busy}
        error={errors.message} hint={`${message.length} / ${MESSAGE_MAX}`} />
      {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
      <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
        {onCancel && <Button variant="secondary" className="w-full sm:w-auto" onClick={onCancel} disabled={busy}>Ləğv et</Button>}
        <Button type="submit" className="w-full sm:w-auto" loading={busy}>Göndər</Button>
      </div>
    </form>
  );
}
