import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useTheme, type ThemePreference } from '@/context/ThemeContext';
import { cx } from '@/components/ui';

const options: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Açıq', icon: Sun },
  { value: 'dark', label: 'Tünd', icon: Moon },
  { value: 'system', label: 'Sistem', icon: Monitor },
];

/** Light / Dark / System seçimi. Seçim brauzerdə saxlanılır; «Sistem» cihazın temasını izləyir. */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  return (
    <div role="radiogroup" aria-label="Tema" className="inline-flex h-10 items-center gap-0.5 rounded-xl border border-line bg-surface p-0.5">
      {options.map(({ value, label, icon: Icon }) => {
        const on = preference === value;
        return (
          <button key={value} type="button" role="radio" aria-checked={on} aria-label={label} title={label} onClick={() => setPreference(value)}
            className={cx('grid size-9 place-items-center rounded-[0.6rem] transition', on ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-surface-2 hover:text-ink')}>
            <Icon className="size-4.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
