import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useSeo } from '@/hooks/useSeo';
import { useSpecialties } from '@/services/specialties';
import { SpecialtyCard } from '@/components/SpecialtyCard';
import { ButtonLink, EmptyState } from '@/components/ui';

/** /specialties/:code — bir ixtisasın tam məlumatı (Home-dakı kartın «Ətraflı bax» hədəfi). */
export default function SpecialtyDetail() {
  const { code = '' } = useParams();
  const specs = useSpecialties();
  const s = specs.find((x) => x.code === code);
  useSeo(s ? s.fullName : 'İxtisas', s?.description);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link to="/about" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"><ArrowLeft className="size-4" aria-hidden />Bütün ixtisaslar</Link>
      {s ? <SpecialtyCard s={s} /> : <EmptyState title="İxtisas tapılmadı" text="Bu ixtisas mövcud deyil və ya aktiv deyil." action={<ButtonLink to="/about">İxtisaslar</ButtonLink>} />}
    </div>
  );
}
