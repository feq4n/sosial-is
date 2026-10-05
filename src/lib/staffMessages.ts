/** Əməkdaşlara mesaj: uzunluq limitləri və yoxlama. Eyni limitlər verilənlər bazasında CHECK ilə də tətbiq olunur. */
export const SUBJECT_MIN = 3;
export const SUBJECT_MAX = 150;
export const MESSAGE_MIN = 5;
export const MESSAGE_MAX = 3000;

export interface StaffMessageErrors { subject?: string; message?: string }

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

export const STAFF_MESSAGES_CHANGED = 'staff-messages-changed';
