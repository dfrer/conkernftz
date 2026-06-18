import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'dark' | 'light';
export type Accent = 'amber' | 'cyan' | 'magenta' | 'lime';

/** Accent overrides. `amber` is null = use the theme's built-in instrument amber. */
export const ACCENTS: Record<Accent, { accent: string; accent2: string } | null> = {
  amber: null,
  cyan: { accent: '#22d3ee', accent2: '#67e8f9' },
  magenta: { accent: '#ff5cc8', accent2: '#ff8fdb' },
  lime: { accent: '#9ae600', accent2: '#bff05a' },
};

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
  accent: Accent;
  setAccent: (a: Accent) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);
const THEME_KEY = 'cnftz:theme';
const ACCENT_KEY = 'cnftz:accent';

function initialTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'dark' || v === 'light') return v;
  } catch {
    /* ignore */
  }
  return 'dark';
}
function initialAccent(): Accent {
  try {
    const v = localStorage.getItem(ACCENT_KEY);
    if (v && v in ACCENTS) return v as Accent;
  } catch {
    /* ignore */
  }
  return 'amber';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [accent, setAccentState] = useState<Accent>(initialAccent);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    const override = ACCENTS[accent];
    if (override) {
      root.style.setProperty('--accent', override.accent);
      root.style.setProperty('--accent-2', override.accent2);
    } else {
      root.style.removeProperty('--accent');
      root.style.removeProperty('--accent-2');
    }
    try {
      localStorage.setItem(ACCENT_KEY, accent);
    } catch {
      /* ignore */
    }
  }, [accent]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggle = useCallback(() => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')), []);
  const setAccent = useCallback((a: Accent) => setAccentState(a), []);

  return <Ctx.Provider value={{ theme, toggle, setTheme, accent, setAccent }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTheme must be used within ThemeProvider');
  return c;
}
