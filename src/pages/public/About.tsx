import { useSeo } from '@/hooks/useSeo';
import { PageHeader } from '@/components/ui';
import { SpecialtyCards } from '@/components/SpecialtyCard';
import { ADPK_NAME } from '@/components/Logo';
import { useSpecialties } from '@/services/specialties';

export default function About() {
  useSeo('İxtisaslar', 'Azərbaycan Dövlət Pedaqoji Kollecinin Sosial İş, KŞATS və KŞŞİ ixtisaslarının tam adı, kodu, müddəti, krediti və qəbul balları.');
  const specs = useSpecialties();
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <PageHeader title="İxtisaslar haqqında" text={`${ADPK_NAME} üzrə bu platformada təmsil olunan üç ixtisas. Qəbul balları ADPK-nın rəsmi saytında göstərilən məlumatdır (Azərbaycan bölməsi, əyani).`} />
      <SpecialtyCards items={specs} />
    </div>
  );
}
