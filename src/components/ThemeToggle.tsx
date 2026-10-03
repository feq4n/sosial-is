import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle} aria-label={theme === 'dark' ? 'Açıq rejimə keç' : 'Tünd rejimə keç'} aria-pressed={theme === 'dark'}
      className="grid size-10 place-items-center rounded-xl border border-line bg-surface text-ink transition hover:bg-surface-2">
      {theme === 'dark' ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
    </button>
  );
}
