import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { LayoutDashboard, LogIn, Menu, X } from 'lucide-react';
import { ADPK_NAME, AdpkLogo, Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { btnClass, cx } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { contact, SITE_NAME } from '@/config/site';

const links = [
  { to: '/', label: 'Ana səhifə', end: true },
  { to: '/announcements', label: 'Elanlar' },
  { to: '/materials', label: 'Materiallar' },
  { to: '/schedule', label: 'Dərs cədvəli' },
  { to: '/events', label: 'Tədbirlər' },
  { to: '/about', label: 'İxtisaslar' },
  { to: '/contact', label: 'Əlaqə' },
];

export default function PublicLayout() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { pathname } = useLocation();
  const reduce = useReducedMotion();

  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    cx('rounded-lg px-3 py-2 text-sm font-semibold transition', isActive ? 'bg-brand-soft text-brand' : 'text-muted hover:text-ink hover:bg-surface-2');

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">Əsas məzmuna keç</a>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo logoClass="size-9 sm:size-10" textClass="text-lg sm:text-xl" />
          <nav aria-label="Əsas naviqasiya" className="hidden items-center gap-1 lg:flex">
            {links.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={linkCls}>{l.label}</NavLink>)}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <Link to="/dashboard" className={btnClass('primary', 'sm', 'hidden sm:inline-flex')}><LayoutDashboard className="size-4" aria-hidden />Kabinet</Link>
            ) : (
              <Link to="/login" className={btnClass('primary', 'sm', 'hidden sm:inline-flex')}><LogIn className="size-4" aria-hidden />Daxil ol</Link>
            )}
            <button className="grid size-10 place-items-center rounded-xl border border-line bg-surface lg:hidden" aria-label={open ? 'Menyunu bağla' : 'Menyunu aç'} aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((o) => !o)}>
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {open && (
            <motion.nav id="mobile-nav" aria-label="Mobil naviqasiya" className="overflow-hidden border-t border-line bg-bg lg:hidden"
              initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <div className="grid gap-1 p-4">
                {links.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => cx(linkCls({ isActive }), 'py-3 text-base')}>{l.label}</NavLink>)}
                <Link to={user ? '/dashboard' : '/login'} className={btnClass('primary', 'md', 'mt-2')}>{user ? 'Kabinet' : 'Daxil ol'}</Link>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <main id="main" className="flex-1" tabIndex={-1}><Outlet /></main>

      <footer className="mt-20 border-t border-line bg-surface-2">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-sm text-sm text-muted">Sosial İş, KŞATS və KŞŞİ ixtisaslarının tələbələri üçün elanlar, dərs materialları, cədvəl və tədbirlər bir yerdə.</p>
            <div className="mt-5 flex max-w-sm items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3">
              <AdpkLogo className="size-14" />
              <p className="text-sm font-semibold leading-snug text-brand-dark dark:text-brand">{ADPK_NAME}</p>
            </div>
          </div>
          <nav aria-label="Alt naviqasiya">
            <h2 className="text-sm font-bold">Bölmələr</h2>
            <ul className="mt-3 grid gap-2 text-sm text-muted">
              {links.slice(1, 5).map((l) => <li key={l.to}><Link className="hover:text-brand" to={l.to}>{l.label}</Link></li>)}
            </ul>
          </nav>
          <div>
            <h2 className="text-sm font-bold">Əlaqə</h2>
            <ul className="mt-3 grid gap-2 text-sm text-muted">
              {contact.email && <li><a className="hover:text-brand" href={`mailto:${contact.email}`}>{contact.email}</a></li>}
              {contact.phone && <li><a className="hover:text-brand" href={`tel:${contact.phone.replace(/\s/g, '')}`}>{contact.phone}</a></li>}
              {contact.address && <li>{contact.address}</li>}
              <li><Link className="hover:text-brand" to="/contact">Mesaj göndər</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-line py-5 text-center text-xs text-muted">© {new Date().getFullYear()} {SITE_NAME} · {ADPK_NAME}</div>
      </footer>
    </div>
  );
}
