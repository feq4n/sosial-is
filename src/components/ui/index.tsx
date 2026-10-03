import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Inbox, Loader2, X } from 'lucide-react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ---------- Düymələr ---------- */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
const base = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:opacity-55 disabled:pointer-events-none select-none';
const variants: Record<Variant, string> = {
  primary: 'bg-brand text-brand-ink hover:brightness-110 shadow-card',
  accent: 'bg-brand-dark text-brand-ink hover:brightness-110 shadow-card',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2',
  ghost: 'text-ink hover:bg-surface-2',
  danger: 'bg-danger text-white hover:brightness-110',
};
const sizes = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-5 text-[0.95rem]', lg: 'h-12 px-6 text-base' };
export const btnClass = (v: Variant = 'primary', s: keyof typeof sizes = 'md', extra?: string) => cx(base, variants[v], sizes[s], extra);

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: keyof typeof sizes; loading?: boolean }
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...rest }, ref) {
  return (
    <button ref={ref} type="button" className={btnClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function ButtonLink({ variant = 'primary', size = 'md', className, ...rest }: LinkProps & { variant?: Variant; size?: keyof typeof sizes }) {
  return <Link className={btnClass(variant, size, className)} {...rest} />;
}

/* ---------- Kart / Nişan ---------- */
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('rounded-2xl border border-line bg-surface shadow-card', className)} {...rest}>{children}</div>;
}

type Tone = 'neutral' | 'brand' | 'accent' | 'danger' | 'success';
const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted',
  brand: 'bg-brand-soft text-brand',
  accent: 'bg-accent-soft text-accent-ink dark:text-accent',
  danger: 'bg-danger-soft text-danger',
  success: 'bg-success-soft text-success',
};
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone], className)}>{children}</span>;
}

/* ---------- Skeleton / boş / xəta ---------- */
export const Skeleton = ({ className }: { className?: string }) => <div className={cx('skeleton', className)} aria-hidden />;

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid gap-4" role="status" aria-label="Yüklənir">
      {Array.from({ length: rows }, (_, i) => (
        <Card key={i} className="p-5 grid gap-3"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-full" /></Card>
      ))}
      <span className="sr-only">Yüklənir…</span>
    </div>
  );
}

export function EmptyState({ title, text, action, icon }: { title: string; text?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-14">
      <div className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">{icon ?? <Inbox className="size-7" aria-hidden />}</div>
      <h3 className="mt-4 text-lg font-bold">{title}</h3>
      {text && <p className="mt-1 max-w-md text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center text-center rounded-2xl border border-danger/30 bg-danger-soft px-6 py-10">
      <AlertTriangle className="size-8 text-danger" aria-hidden />
      <p className="mt-3 font-semibold text-danger">{message}</p>
      {onRetry && <Button className="mt-4" variant="secondary" onClick={onRetry}>Yenidən yoxla</Button>}
    </div>
  );
}

export function SampleNotice() {
  return (
    <div role="note" className="mb-6 rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent-ink dark:text-accent">
      <strong>Nümunə məzmun.</strong> Sayt hələ verilənlər bazasına qoşulmayıb; göstərilən məlumatlar rəsmi deyil və yalnız interfeysi göstərmək üçündür.
    </div>
  );
}

/* ---------- Form sahələri ---------- */
interface FieldShellProps { label: string; error?: string; hint?: string; id: string; children: ReactNode }
function FieldShell({ label, error, hint, id, children }: FieldShellProps) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="text-xs font-semibold text-danger">{error}</p>}
    </div>
  );
}
const inputCls = (err?: string) => cx('w-full rounded-xl border bg-surface px-3.5 py-2.5 text-[0.95rem] placeholder:text-muted/70 transition focus:border-brand', err ? 'border-danger' : 'border-line');

type FieldBase = { label: string; error?: string; hint?: string };
export const TextField = forwardRef<HTMLInputElement, FieldBase & InputHTMLAttributes<HTMLInputElement>>(function TextField({ label, error, hint, className, ...rest }, ref) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <input ref={ref} id={id} className={cx(inputCls(error), className)} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} {...rest} />
    </FieldShell>
  );
});
export const TextArea = forwardRef<HTMLTextAreaElement, FieldBase & TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea({ label, error, hint, className, ...rest }, ref) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <textarea ref={ref} id={id} rows={5} className={cx(inputCls(error), 'resize-y', className)} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} {...rest} />
    </FieldShell>
  );
});
export const SelectField = forwardRef<HTMLSelectElement, FieldBase & SelectHTMLAttributes<HTMLSelectElement>>(function SelectField({ label, error, hint, className, children, ...rest }, ref) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <select ref={ref} id={id} className={cx(inputCls(error), className)} aria-invalid={!!error} {...rest}>{children}</select>
    </FieldShell>
  );
});
export function CheckField({ label, ...rest }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-center gap-2.5 text-sm font-medium cursor-pointer">
      <input id={id} type="checkbox" className="size-4.5 accent-[var(--brand)]" {...rest} />{label}
    </label>
  );
}

/* ---------- Modal və təsdiq ---------- */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus(); };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] grid place-items-end sm:place-items-center bg-black/50 p-0 sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
            className={cx('w-full max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-surface p-6 shadow-pop outline-none', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}
            initial={reduce ? false : { y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={reduce ? undefined : { y: 30, opacity: 0 }} transition={{ duration: 0.22 }}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 id={titleId} className="text-xl font-bold">{title}</h2>
              <button onClick={onClose} aria-label="Bağla" className="rounded-lg p-1.5 text-muted hover:bg-surface-2"><X className="size-5" /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmDialog({ open, title, text, confirmLabel = 'Sil', loading, onConfirm, onClose }: { open: boolean; title: string; text: string; confirmLabel?: string; loading?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-muted">{text}</p>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>Ləğv et</Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

/* ---------- Animasiya ---------- */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.45, delay, ease: 'easeOut' }}>
      {children}
    </motion.div>
  );
}

/* ---------- Səhifə başlığı ---------- */
export function PageHeader({ title, text, actions }: { title: string; text?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl sm:text-4xl font-extrabold">{title}</h1>
        {text && <p className="mt-2 max-w-2xl text-muted">{text}</p>}
      </div>
      {actions}
    </div>
  );
}

export function SuccessBanner({ children }: { children: ReactNode }) {
  return <div role="status" className="flex items-start gap-3 rounded-xl bg-success-soft p-4 text-success"><CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden /><div className="font-semibold">{children}</div></div>;
}
export function ErrorBanner({ children }: { children: ReactNode }) {
  return <div role="alert" className="flex items-start gap-3 rounded-xl bg-danger-soft p-4 text-danger"><AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden /><div className="font-semibold">{children}</div></div>;
}
