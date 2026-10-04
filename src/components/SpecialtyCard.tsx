import { ExternalLink, HeartHandshake, Network, Wrench, type LucideIcon } from 'lucide-react';
import { admissionGroups, ADPK_SPECIALTIES_URL, type SpecialtyInfo } from '@/data/specialties';
import { Badge, Card } from '@/components/ui';

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
              <p className="bg-brand-dark px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-accent">Qəbul balları — Az. bölməsi (əyani)</p>
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
