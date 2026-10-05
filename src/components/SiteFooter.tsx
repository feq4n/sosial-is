import { Link } from 'react-router-dom';
import { ExternalLink, Mail, MapPin, Phone } from 'lucide-react';
import { ADPK_NAME, AdpkLogo, Logo } from '@/components/Logo';
import { DEVELOPER } from '@/config/site';
import { useContactInfo, useFooterLinks, useSiteSettings } from '@/services/site';

const linkCls = 'inline-flex items-center gap-1 transition hover:text-brand hover:underline';

export function SiteFooter() {
  const s = useSiteSettings();
  const links = useFooterLinks();
  const c = useContactInfo();
  return (
    <footer className="mt-20 border-t border-line bg-surface-2">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Logo />
          {s.footerText && <p className="mt-4 max-w-sm text-sm text-muted">{s.footerText}</p>}
          <div className="mt-5 flex max-w-sm items-center gap-3 rounded-2xl border border-line bg-surface p-3">
            <AdpkLogo className="size-14" />
            <p className="text-sm font-semibold leading-snug text-brand-dark dark:text-brand">{ADPK_NAME}</p>
          </div>
        </div>

        <nav aria-label="Alt naviqasiya">
          <h2 className="text-sm font-bold">Bölmələr</h2>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-muted md:grid-cols-1">
            {links.map((l) => (
              <li key={l.id}>
                {l.url.startsWith('/')
                  ? <Link className={linkCls} to={l.url}>{l.label}</Link>
                  : <a className={linkCls} href={l.url} target="_blank" rel="noopener noreferrer">{l.label}<ExternalLink className="size-3" aria-hidden /></a>}
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-bold">Əlaqə</h2>
          <ul className="mt-3 grid gap-2.5 text-sm text-muted">
            {c.email && <li className="flex gap-2"><Mail className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden /><a className={`${linkCls} break-all`} href={`mailto:${c.email}`}>{c.email}</a></li>}
            {c.phone && <li className="flex gap-2"><Phone className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden /><a className={linkCls} href={`tel:${c.phone.replace(/\s/g, '')}`}>{c.phone}</a></li>}
            {c.address && <li className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden /><span>{c.address}</span></li>}
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-center text-xs text-muted sm:flex-row sm:px-6 sm:text-left">
          <p>© {new Date().getFullYear()} {s.siteName} · {ADPK_NAME}</p>
          <p>
            {DEVELOPER.label}{' '}
            <a href={DEVELOPER.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline">{DEVELOPER.name}</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
