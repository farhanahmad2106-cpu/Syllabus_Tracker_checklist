import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import {
  isNativePlatform,
  getNativePlatform,
  syncNativeStatusBar,
  registerNativeBackButton,
} from '../lib/nativeBridge';
import { resolveApiBaseUrl } from '../lib/api';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
    getPlatform: vi.fn(),
  },
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(),
    exitApp: vi.fn(),
  },
}));

vi.mock('@capacitor/status-bar', () => ({
  StatusBar: {
    setStyle: vi.fn(),
    setBackgroundColor: vi.fn(),
  },
  Style: {
    Light: 'LIGHT',
    Dark: 'DARK',
    Default: 'DEFAULT',
  },
}));

describe('Native Bridge - Platform Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects web platform when Capacitor reports non-native', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('web');

    expect(isNativePlatform()).toBe(false);
    expect(getNativePlatform()).toBe('web');
  });

  it('detects native android platform', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');

    expect(isNativePlatform()).toBe(true);
    expect(getNativePlatform()).toBe('android');
  });

  it('detects native iOS platform', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('ios');

    expect(isNativePlatform()).toBe(true);
    expect(getNativePlatform()).toBe('ios');
  });

  it('falls back safely to web on unexpected platform', () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('electron' as unknown as string);
    expect(getNativePlatform()).toBe('web');
  });
});

describe('Native Bridge - Status Bar Synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing when running on web', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('web');

    await syncNativeStatusBar('dark');
    expect(StatusBar.setStyle).not.toHaveBeenCalled();
    expect(StatusBar.setBackgroundColor).not.toHaveBeenCalled();
  });

  it('synchronizes dark theme on native Android with Style.Light and #09090B', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');

    await syncNativeStatusBar('dark');
    expect(StatusBar.setStyle).toHaveBeenCalledWith({ style: Style.Light });
    expect(StatusBar.setBackgroundColor).toHaveBeenCalledWith({ color: '#09090B' });
  });

  it('synchronizes light theme on native Android with Style.Dark and #FAFAFA', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');

    await syncNativeStatusBar('light');
    expect(StatusBar.setStyle).toHaveBeenCalledWith({ style: Style.Dark });
    expect(StatusBar.setBackgroundColor).toHaveBeenCalledWith({ color: '#FAFAFA' });
  });

  it('synchronizes iOS status bar style without calling setBackgroundColor', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('ios');

    await syncNativeStatusBar('dark');
    expect(StatusBar.setStyle).toHaveBeenCalledWith({ style: Style.Light });
    expect(StatusBar.setBackgroundColor).not.toHaveBeenCalled();
  });

  it('handles StatusBar plugin errors defensively without throwing', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
    vi.mocked(StatusBar.setStyle).mockRejectedValue(new Error('Plugin error'));

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(syncNativeStatusBar('dark')).resolves.not.toThrow();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('Native Bridge - Hardware Back Button', () => {
  let removeMock: ReturnType<typeof vi.fn>;
  let listenerCallback: ((event: { canGoBack: boolean }) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    removeMock = vi.fn().mockResolvedValue(undefined);
    listenerCallback = null;

    vi.mocked(CapApp.addListener).mockImplementation((_event, cb) => {
      listenerCallback = cb as (event: { canGoBack: boolean }) => void;
      return Promise.resolve({ remove: removeMock }) as any;
    });
  });

  it('returns no-op cleanup and does not register listener on web', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('web');

    const cleanup = registerNativeBackButton(() => false);
    expect(CapApp.addListener).not.toHaveBeenCalled();
    cleanup();
  });

  it('returns no-op cleanup on iOS platform', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('ios');

    const cleanup = registerNativeBackButton(() => false);
    expect(CapApp.addListener).not.toHaveBeenCalled();
    cleanup();
  });

  it('registers back button listener on native Android and intercepts when callback returns true', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');

    const onIntercept = vi.fn().mockReturnValue(true);
    const historySpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});

    registerNativeBackButton(onIntercept);
    expect(CapApp.addListener).toHaveBeenCalledWith('backButton', expect.any(Function));

    expect(listenerCallback).not.toBeNull();
    listenerCallback!({ canGoBack: true });

    expect(onIntercept).toHaveBeenCalledTimes(1);
    expect(historySpy).not.toHaveBeenCalled();
    expect(CapApp.exitApp).not.toHaveBeenCalled();

    historySpy.mockRestore();
  });

  it('delegates to history.back when callback returns false and canGoBack is true', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');

    const onIntercept = vi.fn().mockReturnValue(false);
    const historySpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});

    registerNativeBackButton(onIntercept);
    listenerCallback!({ canGoBack: true });

    expect(onIntercept).toHaveBeenCalledTimes(1);
    expect(historySpy).toHaveBeenCalledTimes(1);
    expect(CapApp.exitApp).not.toHaveBeenCalled();

    historySpy.mockRestore();
  });

  it('delegates to CapApp.exitApp when callback returns false and canGoBack is false', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');

    const onIntercept = vi.fn().mockReturnValue(false);
    const historySpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});

    registerNativeBackButton(onIntercept);
    listenerCallback!({ canGoBack: false });

    expect(onIntercept).toHaveBeenCalledTimes(1);
    expect(historySpy).not.toHaveBeenCalled();
    expect(CapApp.exitApp).toHaveBeenCalledTimes(1);

    historySpy.mockRestore();
  });

  it('unregisters listener when cleanup function is invoked', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');

    const cleanup = registerNativeBackButton(() => false);
    await Promise.resolve(); // flush microtasks for listener handle promise
    cleanup();

    expect(removeMock).toHaveBeenCalledTimes(1);
  });
});

describe('API Base URL Resolver', () => {
  it('returns configured URL stripped of trailing slashes', () => {
    expect(resolveApiBaseUrl('https://example.com/api///', false)).toBe('https://example.com/api');
    expect(resolveApiBaseUrl('http://192.168.1.50:8000/api/', true)).toBe('http://192.168.1.50:8000/api');
  });

  it('defaults to /api on web when unconfigured', () => {
    expect(resolveApiBaseUrl(undefined, false)).toBe('/api');
    expect(resolveApiBaseUrl('', false)).toBe('/api');
  });

  it('defaults to fallback host and warns when unconfigured on native', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const resolved = resolveApiBaseUrl(undefined, true);
    expect(resolved).toBe('http://127.0.0.1:8000/api');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[SyllabusTracker:API]'));
    consoleSpy.mockRestore();
  });
});
