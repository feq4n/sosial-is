import { Link } from 'react-router-dom';
import { SITE_NAME } from '@/config/site';

export const ADPK_NAME = 'Azərbaycan Dövlət Pedaqoji Kolleci';

/** Saytın öz işarəsi (yükləmə ekranı və favicon üçün saxlanılır). */
export function LogoMark({ className = 'size-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill="var(--brand)" />
      <circle cx="23" cy="25" r="7" fill="var(--brand-ink)" />
      <circle cx="43" cy="25" r="7" fill="var(--brand-soft)" />
      <path d="M10 49c1-9 7-14 13-14s9 3 9 3 3-3 9-3 12 5 13 14z" fill="var(--brand-ink)" opacity=".92" />
    </svg>
  );
}

/** Orijinal ADPK loqosu (dəyişdirilmədən). Tünd rejimdə ağ dairəvi fon üzərində göstərilir. */
export function AdpkLogo({ className = 'size-10' }: { className?: string }) {
  return (
    <img src="/adpk-logo.jpg" alt={`${ADPK_NAME} loqosu`} width={447} height={447} decoding="async"
      className={`shrink-0 rounded-full bg-white object-contain ring-1 ring-line ${className}`} />
  );
}

export function Logo({ to = '/', logoClass = 'size-10', textClass = 'text-xl' }: { to?: string; logoClass?: string; textClass?: string }) {
  return (
    <Link to={to} className="inline-flex min-w-0 items-center gap-2.5" aria-label={`${SITE_NAME} — ana səhifə`}>
      <AdpkLogo className={logoClass} />
      <span className={`truncate font-display font-extrabold tracking-tight ${textClass}`}>{SITE_NAME}</span>
    </Link>
  );
}
