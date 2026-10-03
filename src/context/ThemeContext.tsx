import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';
const KEY = 'sosial-is-theme';
const Ctx = createContext<{ theme: Theme; toggle: () => void } | null>(null);

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme yalnız ThemeProvider daxilində istifadə olunur');
  return v;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0a1618' : '#0E5A64');
    try { localStorage.setItem(KEY, theme); } catch { /* brauzer saxlama qadağandır */ }
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
