import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { LogOut, Menu, X } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cx } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { roleLabels } from '@/utils/labels';

export interface NavItem { to: string; label: string; icon: ReactNode; end?: boolean; badge?: number }

export default function AppShell({ items, title, extra }: { items: NavItem[]; title: string; extra?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { profile, user, role, logout } = useAuth();
  const { pathname } = useLocation();
  const nav = useNavigate();
  const reduce = useReducedMotion();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);

  const name = profile ? `${profile.firstName} ${profile.lastName}` : user?.email ?? '';
  const out = async () => { await logout(); nav('/'); };

  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-5">
      <Logo logoClass="size-9" textClass="text-lg" />
      <p className="px-1 text-xs font-bold text-muted">{title}</p>
      <nav aria-label={title} className="grid gap-1 -mt-3">
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end}
            className={({ isActive }) => cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition', isActive ? 'bg-brand text-brand-ink shadow-card' : 'text-muted hover:bg-surface-2 hover:text-ink')}>
            <span aria-hidden className="shrink-0">{i.icon}</span>
            <span className="flex-1">{i.label}</span>
            {!!i.badge && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-ink" aria-label={`${i.badge} oxunmamış`}>{i.badge}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto grid gap-3">
        {extra}
        <div className="rounded-xl border border-line bg-surface-2 p-3">
          <p className="truncate text-sm font-bold">{name}</p>
          <p className="text-xs text-muted">{roleLabels[role]}</p>
        </div>
        <button onClick={out} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink">
          <LogOut className="size-4" aria-hidden />Çıxış
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <a href="#main" className="skip-link">Əsas məzmuna keç</a>
      <aside className="sticky top-0 hidden h-dvh border-r border-line bg-surface lg:block">{sidebar}</aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur sm:px-6">
          <button className="grid size-10 place-items-center rounded-xl border border-line bg-surface lg:hidden" aria-label="Menyunu aç" aria-expanded={open} onClick={() => setOpen(true)}><Menu className="size-5" /></button>
          <Link to="/" className="hidden flex-1 text-sm font-semibold text-muted hover:text-brand lg:block">← İctimai sayta qayıt</Link>
          <div className="min-w-0 flex-1 lg:hidden"><Logo logoClass="size-8" textClass="text-lg" /></div>
          <ThemeToggle />
        </header>
        <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={pathname} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface shadow-pop" initial={reduce ? false : { x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ duration: 0.22 }}>
              <button className="absolute right-3 top-4 rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="Menyunu bağla" onClick={() => setOpen(false)}><X className="size-5" /></button>
              {sidebar}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
