// Nümunə məzmun: yalnız Supabase qoşulmadıqda (yerli baxış üçün) göstərilir.
// Real/rəsmi məlumat deyil — admin paneli ilə əvəz edilir. İnterfeysdə "Nümunə məzmun" xəbərdarlığı görünür.
import type { Announcement, EventItem, Material } from '@/types';

const d = (offsetDays: number, h = 10, m = 0) => {
  const t = new Date();
  t.setDate(t.getDate() + offsetDays);
  t.setHours(h, m, 0, 0);
  return t.toISOString();
};

export const sampleAnnouncements: Announcement[] = [
  { id: 'sample-a1', title: 'Nümunə: Semestr üzrə imtahan cədvəli elan olunacaq', summary: 'Bu, nümunə elandır. Real elanlar admin paneli vasitəsilə əlavə edilir.', body: 'Bu mətn yalnız interfeysi göstərmək üçün nümunədir.\n\nAdmin panelindən real elan əlavə etdikdə bu nümunə məzmun görünməyəcək.', category: 'imtahan', important: true, published: true, createdAt: d(-1) },
  { id: 'sample-a2', title: 'Nümunə: Təcrübə yerləri üzrə məlumat görüşü', summary: 'Nümunə elan: təcrübə təşkilatları ilə tanışlıq görüşü barədə.', body: 'Nümunə mətn. Tarix, yer və qeydiyyat qaydası real elanda göstəriləcək.', category: 'praktika', important: false, published: true, createdAt: d(-4) },
  { id: 'sample-a3', title: 'Nümunə: Yeni dərs materialları əlavə olunub', summary: 'Nümunə elan: "Materiallar" bölməsində yeniliklər.', body: 'Nümunə mətn.', category: 'tedris', important: false, published: true, createdAt: d(-9) },
];

export const sampleMaterials: Material[] = [
  { id: 'sample-m1', title: 'Nümunə: Sosial işə giriş — mühazirə konspekti', subject: 'Sosial işə giriş', author: 'Nümunə müəllif', description: 'Nümunə qeyd. Real material əlavə edildikdə burada onun təsviri görünəcək.', url: 'https://example.com/numune.pdf', fileType: 'pdf', createdAt: d(-3) },
  { id: 'sample-m2', title: 'Nümunə: Sosial işdə etika — təqdimat', subject: 'Peşə etikası', author: 'Nümunə müəllif', description: 'Nümunə qeyd.', url: 'https://example.com/numune.pptx', fileType: 'ppt', createdAt: d(-8) },
];

export const sampleEvents: EventItem[] = [
  { id: 'sample-e1', title: 'Nümunə: Açıq mühazirə', description: 'Bu, nümunə tədbirdir. Real tədbirlər admin paneli ilə yaradılır.', category: 'seminar', location: 'Nümunə auditoriya', startsAt: d(5, 15), registrationOpen: true, createdAt: d(-2) },
  { id: 'sample-e2', title: 'Nümunə: Könüllülük günü', description: 'Nümunə təsvir.', category: 'goenullu', location: 'Nümunə məkan', startsAt: d(12, 11), registrationOpen: false, createdAt: d(-6) },
];
