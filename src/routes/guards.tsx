import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ButtonLink, EmptyState } from '@/components/ui';
import { PageLoader } from '@/components/PageLoader';
import type { Role } from '@/types';

export function RequireAuth() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <Outlet />;
}

/** Yalnız interfeys üçün: həqiqi icazələr Postgres RLS siyasətləri ilə serverdə yoxlanılır. */
export function RequireRole({ roles }: { roles: Role[] }) {
  const { role, profile, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!profile || !roles.includes(role)) {
    return (
      <div className="mx-auto max-w-lg py-16">
        <EmptyState icon={<ShieldAlert className="size-7" aria-hidden />} title="Bu bölməyə giriş icazəniz yoxdur"
          text="Bu səhifə yalnız müvafiq səlahiyyəti olan istifadəçilər üçündür." action={<ButtonLink to="/dashboard">Kabinetə qayıt</ButtonLink>} />
      </div>
    );
  }
  return <Outlet />;
}

export function GuestOnly() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to={(loc.state as { from?: string } | null)?.from ?? '/dashboard'} replace />;
  return <Outlet />;
}
