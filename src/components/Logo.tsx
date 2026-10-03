import { Link } from 'react-router-dom';
import { SITE_NAME } from '@/config/site';

export function LogoMark({ className = 'size-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill="var(--brand)" />
      <circle cx="23" cy="25" r="7" fill="var(--brand-ink)" />
      <circle cx="43" cy="25" r="7" fill="var(--accent)" />
      <path d="M10 49c1-9 7-14 13-14s9 3 9 3 3-3 9-3 12 5 13 14z" fill="var(--brand-ink)" opacity=".92" />
    </svg>
  );
}

export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2.5" aria-label={`${SITE_NAME} — ana səhifə`}>
      <LogoMark />
      <span className="font-display text-xl font-extrabold tracking-tight">{SITE_NAME}</span>
    </Link>
  );
}
