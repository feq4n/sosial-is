import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
type Theme = 'light' | 'dark';

const KEY = 'sosial-is-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
const META_COLOR: Record<Theme, string> = { light: '#087A50', dark: '#0f1311' };

interface ThemeValue {
  /** İstifadəçinin seçimi (light | dark | system). */
  preference: ThemePreference;
  /** Faktiki tətbiq olunan tema (system olduqda cihazın seçimi). */
  theme: Theme;
  setPreference: (p: ThemePreference) => void;
}

const Ctx = createContext<ThemeValue | null>(null);

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme yalnız ThemeProvider daxilində istifadə olunur');
  return v;
}

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch { return 'system'; }
}

const systemTheme = (): Theme => (typeof window !== 'undefined' && window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light');

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [system, setSystem] = useState<Theme>(systemTheme);

  // Cihaz teması dəyişəndə (yalnız «system» seçilibsə təsir edir)
  useEffect(() => {
    const mq = window.matchMedia?.(DARK_QUERY);
    if (!mq?.addEventListener) return;
    const on = () => setSystem(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const theme: Theme = preference === 'system' ? system : preference;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLOR[theme]);
  }, [theme]);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    try {
      if (p === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, p);
    } catch { /* brauzer saxlama qadağandır */ }
  }, []);

  const value = useMemo(() => ({ preference, theme, setPreference }), [preference, theme, setPreference]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
