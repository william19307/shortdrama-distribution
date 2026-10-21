import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Density, ThemeName } from './ds';

interface DsTheme {
  mode: ThemeName;
  density: Density;
  setMode: (mode: ThemeName) => void;
  setDensity: (density: Density) => void;
}

const Ctx = createContext<DsTheme | null>(null);

export function ThemeState({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeName>(() => (localStorage.getItem('ds-theme') === 'light' ? 'light' : 'dark'));
  const [density, setDensity] = useState<Density>(() => (localStorage.getItem('ds-density') === 'comfortable' ? 'comfortable' : 'compact'));
  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    localStorage.setItem('ds-theme', mode);
    localStorage.setItem('ds-density', density);
  }, [mode, density]);
  const value = useMemo(() => ({ mode, density, setMode, setDensity }), [mode, density]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDsTheme() {
  const value = useContext(Ctx);
  if (!value) throw new Error('ThemeState 缺失');
  return value;
}
