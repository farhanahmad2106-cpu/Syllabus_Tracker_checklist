import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'syllabus_tracker_theme';

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'dark';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') {
    return getSystemTheme();
  }
  return preference;
}

function getStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light' || stored === 'system') {
      return stored;
    }
  } catch {
    // LocalStorage may be blocked or unavailable
  }
  return 'system';
}

function applyThemeToDocument(resolved: ResolvedTheme): void {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.dataset.theme = resolved;
    if (resolved === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }
}

export interface UseThemeReturn {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (preference: ThemePreference) => void;
  toggleTheme: () => void;
  availableThemes: readonly ThemePreference[];
}

export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<ThemePreference>(() => getStoredPreference());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(getStoredPreference()));

  // Synchronize document and state when theme preference changes
  const setTheme = useCallback((preference: ThemePreference) => {
    setThemeState(preference);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Storage unavailable fallback
    }
    const resolved = resolveTheme(preference);
    setResolvedTheme(resolved);
    applyThemeToDocument(resolved);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      let next: ThemePreference = 'dark';
      if (current === 'dark') next = 'light';
      else if (current === 'light') next = 'system';
      else next = 'dark';

      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Storage unavailable fallback
      }
      const resolved = resolveTheme(next);
      setResolvedTheme(resolved);
      applyThemeToDocument(resolved);
      return next;
    });
  }, []);

  // Listen to OS system color-scheme changes when preference is 'system'
  useEffect(() => {
    // Initial apply
    const initialResolved = resolveTheme(theme);
    setResolvedTheme(initialResolved);
    applyThemeToDocument(initialResolved);

    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      // Only react to OS changes if user preference is currently 'system'
      if (theme === 'system') {
        const newResolved = mediaQuery.matches ? 'dark' : 'light';
        setResolvedTheme(newResolved);
        applyThemeToDocument(newResolved);
      }
    };

    // Support both modern addEventListener and legacy addListener
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleSystemChange);
    } else if (typeof (mediaQuery as unknown as { addListener?: (fn: () => void) => void }).addListener === 'function') {
      (mediaQuery as unknown as { addListener: (fn: () => void) => void }).addListener(handleSystemChange);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', handleSystemChange);
      } else if (typeof (mediaQuery as unknown as { removeListener?: (fn: () => void) => void }).removeListener === 'function') {
        (mediaQuery as unknown as { removeListener: (fn: () => void) => void }).removeListener(handleSystemChange);
      }
    };
  }, [theme]);

  return {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
    availableThemes: ['dark', 'light', 'system'] as const,
  };
}
