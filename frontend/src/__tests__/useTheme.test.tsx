import '../setupTests';
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { useTheme, THEME_STORAGE_KEY } from '../hooks/useTheme';

describe('useTheme hook', () => {
  let matchMediaListeners: Array<(e: { matches: boolean }) => void> = [];
  let systemPrefersDark = true;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dataset.theme = '';
    document.documentElement.classList.remove('dark', 'light');
    matchMediaListeners = [];
    systemPrefersDark = true;

    // Mock window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: systemPrefersDark,
        media: query,
        onchange: null,
        addListener: vi.fn((fn) => matchMediaListeners.push(fn)),
        removeListener: vi.fn((fn) => {
          matchMediaListeners = matchMediaListeners.filter((l) => l !== fn);
        }),
        addEventListener: vi.fn((event, fn) => {
          if (event === 'change') matchMediaListeners.push(fn);
        }),
        removeEventListener: vi.fn((event, fn) => {
          if (event === 'change') {
            matchMediaListeners = matchMediaListeners.filter((l) => l !== fn);
          }
        }),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with system preference by default when localStorage is empty', () => {
    systemPrefersDark = true;
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('initializes with dark preference when dark is stored in localStorage', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('initializes with light preference when light is stored in localStorage', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('light');
    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('falls back safely to system when invalid theme preference is in localStorage', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'invalid_neon_theme');
    systemPrefersDark = false;
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('falls back safely when localStorage throws (storage blocked/unavailable)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Access denied by browser security');
    });

    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('system');
  });

  it('updates theme explicitly and persists preference in localStorage', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('light');
    });

    expect(result.current.theme).toBe('light');
    expect(result.current.resolvedTheme).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('cycles through dark -> light -> system via toggleTheme', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('system');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('synchronizes resolvedTheme when OS color scheme changes while theme is system', () => {
    systemPrefersDark = true;
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('dark');

    // Simulate OS switching to light
    act(() => {
      systemPrefersDark = false;
      matchMediaListeners.forEach((fn) => fn({ matches: false }));
    });

    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('does NOT overwrite explicit dark/light preference when OS scheme changes', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');

    // Simulate OS switching to light
    act(() => {
      systemPrefersDark = false;
      matchMediaListeners.forEach((fn) => fn({ matches: false }));
    });

    // Should stay dark because user explicitly chose dark
    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('cleans up media query listener when hook unmounts', () => {
    const { unmount } = renderHook(() => useTheme());
    expect(matchMediaListeners.length).toBeGreaterThan(0);

    unmount();
    expect(matchMediaListeners.length).toBe(0);
  });
});
