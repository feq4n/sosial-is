/** Əməkdaşlara mesaj: uzunluq limitləri və yoxlama. Eyni limitlər verilənlər bazasında CHECK ilə də tətbiq olunur. */
export const SUBJECT_MIN = 3;
export const SUBJECT_MAX = 150;
export const MESSAGE_MIN = 5;
export const MESSAGE_MAX = 3000;
export const SENDER_NAME_MAX = 100;
export const SENDER_GROUP_MAX = 50;

export interface StaffMessageErrors { subject?: string; message?: string }
export interface StaffSenderErrors { senderName?: string; senderGroup?: string }
export interface StaffMessageDraftErrors extends StaffSenderErrors, StaffMessageErrors { recipient?: string }

export const normalizeSpaces = (v: string) => v.replace(/\s+/g, ' ').trim();

export function validateStaffSender(name: string, group: string): StaffSenderErrors {
  const n = normalizeSpaces(name);
  const g = normalizeSpaces(group);
  const errors: StaffSenderErrors = {};
  if (!n) errors.senderName = 'Ad və soyad boş ola bilməz';
  else if (n.length > SENDER_NAME_MAX) errors.senderName = `Ad və soyad ən çox ${SENDER_NAME_MAX} simvol ola bilər`;
  if (!g) errors.senderGroup = 'Qrup boş ola bilməz';
  else if (g.length > SENDER_GROUP_MAX) errors.senderGroup = `Qrup ən çox ${SENDER_GROUP_MAX} simvol ola bilər`;
  return errors;
}

export function validateStaffMessage(subject: string, message: string): StaffMessageErrors {
  const s = subject.trim();
  const m = message.trim();
  const errors: StaffMessageErrors = {};
  if (!s) errors.subject = 'Mövzu boş ola bilməz';
  else if (s.length < SUBJECT_MIN) errors.subject = `Mövzu ən azı ${SUBJECT_MIN} simvol olmalıdır`;
  else if (s.length > SUBJECT_MAX) errors.subject = `Mövzu ən çox ${SUBJECT_MAX} simvol ola bilər`;
  if (!m) errors.message = 'Mesaj boş ola bilməz';
  else if (m.length < MESSAGE_MIN) errors.message = `Mesaj ən azı ${MESSAGE_MIN} simvol olmalıdır`;
  else if (m.length > MESSAGE_MAX) errors.message = `Mesaj ən çox ${MESSAGE_MAX} simvol ola bilər`;
  return errors;
}

export interface StaffMessageFields { recipientId: string; senderName: string; senderGroup: string; subject: string; message: string }

export function validateStaffMessageFields(f: StaffMessageFields): StaffMessageDraftErrors {
  const errors: StaffMessageDraftErrors = { ...validateStaffSender(f.senderName, f.senderGroup), ...validateStaffMessage(f.subject, f.message) };
  if (!f.recipientId) errors.recipient = 'Əməkdaşı seçin';
  return errors;
}

export const STAFF_MESSAGES_CHANGED = 'staff-messages-changed';
