import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'motion/react';
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, HeartHandshake, Network, Wrench, type LucideIcon } from 'lucide-react';
import { admissionGroups, ADPK_SPECIALTIES_URL, type SpecialtyInfo } from '@/data/specialties';
import { Badge, Card, cx } from '@/components/ui';

const icons: Record<string, LucideIcon> = { 'Sİ': HeartHandshake, 'KŞATS': Wrench, 'KŞŞİ': Network };

const Stat = ({ value, unit, label }: { value?: string; unit: string; label: string }) => (
  <div className="rounded-2xl border border-line bg-surface-2 p-3 text-center">
    <p className="text-base font-extrabold leading-tight sm:text-lg">{value ? `${value} ${unit}` : '—'}</p>
    <p className="mt-1 text-xs text-muted">{label}</p>
  </div>
);

/** Üç ixtisas üçün EYNİ quruluşlu kart. Məlumat olmayan sahə gizlədilir, kartın ölçüsü pozulmur. */
export function SpecialtyCard({ s }: { s: SpecialtyInfo }) {
  const Icon = icons[s.code] ?? Network;
  const groups = admissionGroups(s);
  return (
    <Card className="flex h-full flex-col overflow-hidden" data-testid={`specialty-${s.code}`}>
      <div className="bg-brand-dark p-5 text-brand-ink sm:p-6">
        <span className="grid size-12 place-items-center rounded-2xl bg-white/15" aria-hidden><Icon className="size-6" /></span>
        <p className="mt-4 min-h-5 text-sm font-bold tracking-wider opacity-90">{s.programCode ?? ''}</p>
        <h3 className="mt-1 break-words text-xl font-extrabold leading-snug">{s.fullName}</h3>
        <p className="mt-1 text-sm opacity-85">{s.degree}{s.name !== s.fullName ? ` · ${s.name}` : ''}</p>
      </div>
      <div className="flex flex-1 flex-col gap-5 p-5 sm:p-6">
        <p className="leading-relaxed text-muted">{s.description}</p>
        <div className="grid grid-cols-3 gap-2">
          <Stat value={s.duration} unit="il" label="Müddət" />
          <Stat value={s.semesters} unit="semestr" label="Semestr sayı" />
          <Stat value={s.credits} unit="kredit" label="Kredit saatı" />
        </div>
        <div className="mt-auto">
          {groups.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-line">
              <p className="bg-brand-dark px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-brand-ink">Qəbul balları — Az. bölməsi (əyani)</p>
              <div className="grid gap-3 p-4">
                {groups.map((g) => (
                  <div key={g.title}>
                    <p className="text-sm font-semibold text-muted">{g.title}</p>
                    <dl className="mt-1 grid gap-1">
                      {g.rows.map((r) => (
                        <div key={r.label} className="flex items-baseline justify-between gap-3 text-sm">
                          <dt className="text-muted">{r.label}</dt>
                          <dd className="whitespace-nowrap font-bold">{r.value} bal</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-muted">Qəbul balları rəsmi mənbədə təsdiqləndikdən sonra əlavə olunacaq.</p>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="flex flex-wrap gap-1.5"><Badge tone="brand">Ödənişli</Badge><Badge tone="success">Dövlət sifarişi</Badge><Badge tone="accent">Əyani</Badge></span>
            <a href={s.sourceUrl ?? ADPK_SPECIALTIES_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">Rəsmi səhifə<ExternalLink className="size-3.5" aria-hidden /></a>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function SpecialtyCards({ items }: { items: SpecialtyInfo[] }) {
  return <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{items.map((s) => <SpecialtyCard key={s.code} s={s} />)}</div>;
}

/** Home üçün yığcam kart: yalnız ad, qısa açıqlama, müddət/dərəcə və «Ətraflı bax». Tam məlumat /specialties/:code səhifəsindədir. */
export function SpecialtyPreview({ s }: { s: SpecialtyInfo }) {
  const Icon = icons[s.code] ?? Network;
  const meta = [s.degree, s.duration ? `${s.duration} il` : ''].filter(Boolean).join(' · ');
  return (
    <Card className="flex h-full flex-col p-5" data-testid={`specialty-${s.code}`}>
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand" aria-hidden><Icon className="size-5" /></span>
        <div className="min-w-0">
          {s.programCode && <p className="text-xs font-bold tracking-wider text-muted">{s.programCode}</p>}
          <h3 className="break-words text-lg font-extrabold leading-snug">{s.fullName}</h3>
        </div>
      </div>
      {meta && <p className="mt-3 text-sm font-semibold text-brand">{meta}</p>}
      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{s.description}</p>
      <Link to={`/specialties/${encodeURIComponent(s.code)}`} className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-brand hover:underline">
        Ətraflı bax<span className="sr-only"> — {s.fullName}</span><ArrowRight className="size-4" aria-hidden />
      </Link>
    </Card>
  );
}

/**
 * Üç ixtisas bərabər səviyyədə. Mobil: barmaqla sağa/sola sürüşdürmə (yerli scroll-snap, JS animasiyası yoxdur).
 * Tablet: ox düymələri; mobil/tablet: ixtisas seçicisi. Geniş ekranda üç kart yan-yana görünür, idarəetmə gizlədilir.
 * Klaviatura: kart zolağı fokuslanır, ← → ilə keçid. prefers-reduced-motion: keçid animasiyasız.
 */
export function SpecialtyCarousel({ items }: { items: SpecialtyInfo[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const last = items.length - 1;

  const sync = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const kids = Array.from(el.children) as HTMLElement[];
    const origin = kids[0]?.offsetLeft ?? 0;
    let best = 0;
    let dist = Infinity;
    kids.forEach((k, i) => { const d = Math.abs(k.offsetLeft - origin - el.scrollLeft); if (d < dist) { dist = d; best = i; } });
    if (el.scrollWidth > el.clientWidth && el.scrollLeft + el.clientWidth >= el.scrollWidth - 2) best = kids.length - 1;
    setActive(best);
  }, []);

  const go = (i: number) => {
    const el = track.current;
    const child = el?.children[Math.max(0, Math.min(last, i))] as HTMLElement | undefined;
    if (!el || !child) return;
    setActive(Math.max(0, Math.min(last, i)));
    el.scrollTo?.({ left: child.offsetLeft - (el.children[0] as HTMLElement).offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1); }
  };

  if (items.length === 0) return null;
  return (
    <div>
      <div ref={track} onScroll={sync} onKeyDown={onKey} tabIndex={0} role="group" aria-roledescription="karusel" aria-label="İxtisaslar"
        className="no-scrollbar relative -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:overflow-visible lg:px-0 snap-smooth">
        {items.map((s, i) => (
          <div key={s.code} role="group" aria-roledescription="slayd" aria-label={`${i + 1} / ${items.length}`}
            className="w-[84%] shrink-0 snap-start sm:w-[calc(50%-0.5rem)] lg:w-[calc((100%-2rem)/3)]">
            <SpecialtyPreview s={s} />
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 lg:hidden">
        <div role="group" aria-label="İxtisas seçimi" className="flex flex-wrap gap-2">
          {items.map((s, i) => (
            <button key={s.code} type="button" onClick={() => go(i)} aria-current={i === active ? 'true' : undefined}
              className={cx('h-9 rounded-full border px-3.5 text-sm font-semibold transition', i === active ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-muted hover:text-ink')}>{s.code}</button>
          ))}
        </div>
        <div className="hidden gap-2 sm:flex">
          <button type="button" onClick={() => go(active - 1)} disabled={active === 0} aria-label="Əvvəlki ixtisas" className="grid size-9 place-items-center rounded-full border border-line bg-surface text-ink transition hover:bg-surface-2 disabled:opacity-40"><ChevronLeft className="size-5" aria-hidden /></button>
          <button type="button" onClick={() => go(active + 1)} disabled={active === last} aria-label="Növbəti ixtisas" className="grid size-9 place-items-center rounded-full border border-line bg-surface text-ink transition hover:bg-surface-2 disabled:opacity-40"><ChevronRight className="size-5" aria-hidden /></button>
        </div>
      </div>
    </div>
  );
}
