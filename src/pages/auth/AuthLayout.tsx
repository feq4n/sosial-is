import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ADPK_NAME, Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Card } from '@/components/ui';
import { isConfigured } from '@/lib/firebase';

export function AuthLayout({ title, text, children }: { title: string; text?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2 text-center"><Logo logoClass="size-14" textClass="text-2xl" /><p className="max-w-xs text-xs font-medium text-muted">{ADPK_NAME}</p></div>
        <Card className="p-6 shadow-pop sm:p-8">
          <h1 className="text-2xl font-extrabold">{title}</h1>
          {text && <p className="mt-1.5 text-sm text-muted">{text}</p>}
          {!isConfigured && <p role="alert" className="mt-4 rounded-xl bg-accent-soft p-3 text-sm text-accent-ink dark:text-accent">Autentifikasiya xidməti hələ qoşulmayıb (Firebase konfiqurasiyası yoxdur). Formu doldurmaq mümkündür, lakin daxil olmaq işləməyəcək.</p>}
          <div className="mt-6">{children}</div>
        </Card>
        <p className="mt-6 text-center text-sm text-muted"><Link to="/" className="hover:text-brand">← Ana səhifəyə qayıt</Link></p>
      </div>
    </div>
  );
}
