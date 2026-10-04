import type { AnnouncementCategory, EventCategory, MaterialType, Role } from '@/types';

export const announcementCategories: Record<AnnouncementCategory, string> = {
  umumi: 'Ümumi',
  tedris: 'Tədris',
  imtahan: 'İmtahan',
  'telebe-heyati': 'Tələbə həyatı',
  praktika: 'Təcrübə',
};
export const eventCategories: Record<EventCategory, string> = {
  seminar: 'Seminar',
  konfrans: 'Konfrans',
  goenullu: 'Könüllülük',
  'tedris-xarici': 'Tədrisdənkənar',
  praktika: 'Təcrübə',
};
export const materialTypes: Record<MaterialType, string> = {
  pdf: 'PDF',
  doc: 'Sənəd',
  ppt: 'Təqdimat',
  xls: 'Cədvəl',
  txt: 'Mətn',
  zip: 'Arxiv',
  video: 'Video',
  link: 'Keçid',
};
export const roleLabels: Record<Role, string> = {
  student: 'Tələbə',
  editor: 'Redaktor',
  admin: 'Admin',
};
export const weekdays = ['Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə', 'Bazar'];
export const weekdaysShort = ['B.e.', 'Ç.a.', 'Çər.', 'C.a.', 'Cümə', 'Şən.', 'Baz.'];

/** JS Date.getDay() (0 = Bazar) → bizim 1..7 (1 = Bazar ertəsi) */
export const jsDayToIso = (d: number) => (d === 0 ? 7 : d);
