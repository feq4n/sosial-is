import { Globe, Link2, Send, UserRound, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui';
import { publicFileUrl } from '@/services/files';
import { isSafeHttpsUrl } from '@/utils/format';
import type { TeamMember } from '@/types';

const socials: { key: keyof TeamMember; label: string; icon: LucideIcon }[] = [
  { key: 'websiteUrl', label: 'Şəxsi sayt', icon: Globe },
  { key: 'linkedinUrl', label: 'LinkedIn', icon: Link2 },
  { key: 'instagramUrl', label: 'Instagram', icon: Link2 },
  { key: 'githubUrl', label: 'GitHub', icon: Link2 },
  { key: 'telegramUrl', label: 'Telegram', icon: Send },
];

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toLocaleUpperCase('az') ?? '').join('');

export function TeamCard({ m }: { m: TeamMember }) {
  const photo = publicFileUrl('team-photos', m.photoPath);
  const links = socials.filter((s) => { const v = m[s.key]; return typeof v === 'string' && isSafeHttpsUrl(v); });
  return (
    <Card className="flex h-full flex-col items-center p-6 text-center" data-testid={`team-${m.id}`}>
      {photo
        ? <img src={photo} alt={m.fullName} width={112} height={112} loading="lazy" decoding="async" className="size-28 rounded-full border border-line object-cover" />
        : <span className="grid size-28 place-items-center rounded-full bg-brand-soft text-3xl font-extrabold text-brand" aria-hidden>{initials(m.fullName) || <UserRound className="size-10" />}</span>}
      <h3 className="mt-4 break-words text-lg font-bold">{m.fullName}</h3>
      <p className="mt-0.5 text-sm font-semibold text-brand">{m.jobTitle}</p>
      {m.bio && <p className="mt-3 whitespace-pre-line break-words text-sm text-muted">{m.bio}</p>}
      {links.length > 0 && (
        <ul className="mt-auto flex flex-wrap justify-center gap-2 pt-4" aria-label={`${m.fullName}: keçidlər`}>
          {links.map((s) => (
            <li key={s.key}>
              <a href={String(m[s.key])} target="_blank" rel="noopener noreferrer" aria-label={`${m.fullName}: ${s.label}`} title={s.label}
                className="grid size-9 place-items-center rounded-full border border-line bg-surface text-muted transition hover:border-brand hover:text-brand">
                <s.icon className="size-4" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
