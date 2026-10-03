import { useSeo } from '@/hooks/useSeo';
import { ButtonLink } from '@/components/ui';

export default function NotFound() {
  useSeo('Səhifə tapılmadı', undefined, { noindex: true });
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-lg place-items-center px-4 text-center">
      <div>
        <p className="font-display text-8xl font-extrabold text-brand">404</p>
        <h1 className="mt-2 text-2xl font-extrabold">Səhifə tapılmadı</h1>
        <p className="mt-2 text-muted">Axtardığınız ünvan mövcud deyil və ya köçürülüb.</p>
        <div className="mt-6 flex justify-center gap-3"><ButtonLink to="/">Ana səhifə</ButtonLink><ButtonLink to="/announcements" variant="secondary">Elanlar</ButtonLink></div>
      </div>
    </div>
  );
}
