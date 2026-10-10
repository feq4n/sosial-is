import { Link } from 'react-router-dom';
import { useSiteSettings } from '@/services/site';

export const ADPK_NAME = 'Azərbaycan Dövlət Pedaqoji Kolleci';

/** Rəsmi profil loqosu (public/logo-profile.png, dəyişdirilmədən). Tünd rejimdə ağ dairəvi fon və halqa üzərində göstərilir. */
export function AdpkLogo({ className = 'size-10' }: { className?: string }) {
  return (
    <img src="/logo-profile.png" alt={`${ADPK_NAME} loqosu`} width={447} height={447} decoding="async"
      className={`shrink-0 rounded-full bg-white object-contain ring-1 ring-line ${className}`} />
  );
}

export function Logo({ to = '/', logoClass = 'size-10', textClass = 'text-xl' }: { to?: string; logoClass?: string; textClass?: string }) {
  const { siteName } = useSiteSettings();
  return (
    <Link to={to} className="inline-flex min-w-0 items-center gap-2.5" aria-label={`${siteName} — ana səhifə`}>
      <AdpkLogo className={logoClass} />
      <span className={`truncate font-display font-extrabold tracking-tight ${textClass}`}>{siteName}</span>
    </Link>
  );
}
