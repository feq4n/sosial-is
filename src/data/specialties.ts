// ADPK ixtisaslarının MƏRKƏZİ məlumat mənbəyi.
// Rəsmi mənbə: https://adpk.edu.az/tedris/ixtisaslar (ixtisas kartları, 2026/2027 qəbul ili).
// Supabase-də `public.specialties` cədvəli varsa, saytda onun məzmunu göstərilir; bu fayl yalnız
// ilkin (fallback) dəyərlərdir — cədvəl yoxdursa və ya Supabase qoşulmayıbsa istifadə olunur.
// Rəsmi mənbədə təsdiqlənməyən rəqəm BURAYA YAZILMIR (sahə boş qalır və saytda gizlədilir).

export interface SpecialtyInfo {
  /** Qrup kodlarının (timetable.json) istifadə etdiyi qısa açar: Sİ, KŞATS, KŞŞİ. */
  code: string;
  /** Qısa göstərilən ad. */
  name: string;
  /** Tam ad. */
  fullName: string;
  /** Rəsmi ixtisas kodu (məs. 040713). Təsdiqlənməyibsə boşdur. */
  programCode?: string;
  description: string;
  degree: string;
  /** Rəqəm/aralıq: “2-3” (vahid UI-da əlavə olunur). */
  duration?: string;
  semesters?: string;
  credits?: string;
  /** Qəbul balları (rəsmi saytdakı yazılışla, vergüllə). Azərbaycan bölməsi, əyani. */
  scoreGeneralState?: string;
  scoreGeneralPaid?: string;
  scoreCompleteState?: string;
  scoreCompletePaid?: string;
  scoreCompletePaidPart?: string;
  /** Qəbul məlumatları rəsmi mənbədə təsdiqlənibsə true; yalnız bu halda göstərilir. */
  admissionConfirmed: boolean;
  sourceUrl?: string;
  active: boolean;
  sortOrder: number;
}

export const ADPK_SPECIALTIES_URL = 'https://adpk.edu.az/tedris/ixtisaslar';
export const SPECIALTY_DEGREE = 'Subbakalavr dərəcəsi';

export const defaultSpecialties: SpecialtyInfo[] = [
  {
    code: 'Sİ',
    name: 'Sosial İş',
    fullName: 'Sosial İş',
    programCode: '040713',
    description: 'Sosial xidmətlər, icma inkişafı və sosial müdaxilə metodları üzrə biliklər əldə edərək sosial sahədə fəaliyyət göstərən dövlət və qeyri-dövlət qurumlarında çalışmaq üçün hazırlanırsınız.',
    degree: SPECIALTY_DEGREE,
    duration: '2-3', semesters: '4-6', credits: '120',
    scoreGeneralState: '100,7', scoreGeneralPaid: '89,3',
    scoreCompleteState: '130', scoreCompletePaid: '90,8', scoreCompletePaidPart: '40,4',
    admissionConfirmed: true, sourceUrl: ADPK_SPECIALTIES_URL, active: true, sortOrder: 1,
  },
  {
    code: 'KŞATS',
    name: 'KŞATS',
    fullName: 'Kompüter Şəbəkəsi Avadanlıqlarının Təmiri və Servisi',
    programCode: '040533',
    description: 'Kompüter və şəbəkə avadanlıqlarının texniki xidməti, diaqnostikası, təmiri və servis prosesləri üzrə praktiki bilik və bacarıqlar qazanırsınız.',
    degree: SPECIALTY_DEGREE,
    duration: '2-3', semesters: '4-6', credits: '120',
    scoreGeneralState: '115,6', scoreGeneralPaid: '157,3',
    scoreCompleteState: '110,1', scoreCompletePaid: '148,1',
    admissionConfirmed: true, sourceUrl: ADPK_SPECIALTIES_URL, active: true, sortOrder: 2,
  },
  {
    code: 'KŞŞİ',
    name: 'KŞŞİ',
    fullName: 'Kompüter Şəbəkəsi və Şəbəkə İnzibatçılığı',
    programCode: '040532',
    description: 'Şəbəkə infrastrukturunun qurulması, idarə edilməsi, server sistemləri və kibertəhlükəsizliyin əsasları üzrə praktiki biliklər əldə edirsiniz.',
    degree: SPECIALTY_DEGREE,
    duration: '2-3', semesters: '4-6', credits: '120',
    scoreGeneralState: '133,4', scoreGeneralPaid: '106,5',
    scoreCompleteState: '150,6', scoreCompletePaid: '116,4',
    admissionConfirmed: true, sourceUrl: ADPK_SPECIALTIES_URL, active: true, sortOrder: 3,
  },
];

/** Qəbul balı sətirləri: [qrup başlığı, [[etiket, dəyər], ...]]. Boş dəyərlər buraxılır. */
export function admissionGroups(s: SpecialtyInfo): { title: string; rows: { label: string; value: string }[] }[] {
  if (!s.admissionConfirmed) return [];
  const pick = (rows: [string, string | undefined][]) => rows.filter((r): r is [string, string] => Boolean(r[1])).map(([label, value]) => ({ label, value }));
  return [
    { title: 'Ümumi orta bazası', rows: pick([['Dövlət sifarişi', s.scoreGeneralState], ['Ödənişli', s.scoreGeneralPaid]]) },
    { title: 'Tam orta bazası', rows: pick([['Dövlət sifarişi', s.scoreCompleteState], ['Ödənişli (əyani)', s.scoreCompletePaid], ['Ödənişli (qiyabi)', s.scoreCompletePaidPart]]) },
  ].filter((g) => g.rows.length > 0);
}
