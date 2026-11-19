import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import {
  isNativePlatform,
  getNativePlatform,
  syncNativeStatusBar,
  registerNativeBackButton,
  sanitizeExportFilename,
  contentToBase64,
  exportAndShareFile,
  shareSummary,
  registerIncomingShareListener,
} from '../lib/nativeBridge';
import { resolveApiBaseUrl } from '../lib/api';

vi.mock('@capacitor/core', () => {
  const mockIncomingShare = {
    getPendingDocument: vi.fn().mockResolvedValue({ hasDocument: false }),
    clearPendingDocument: vi.fn().mockResolvedValue({ cleared: true }),
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn().mockResolvedValue(undefined) }),
  };

  return {
    Capacitor: {
      isNativePlatform: vi.fn(),
      getPlatform: vi.fn(),
    },
    registerPlugin: vi.fn((name) => {
      if (name === 'IncomingShare') return mockIncomingShare;
      return {};
    }),
  };
});

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

vi.mock('@capacitor/filesystem', () => ({
  Directory: {
    Cache: 'CACHE',
  },
  Filesystem: {
    writeFile: vi.fn().mockResolvedValue({ uri: 'file:///cache/test.md' }),
    getUri: vi.fn().mockResolvedValue({ uri: 'file:///cache/test.md' }),
    readdir: vi.fn().mockResolvedValue({ files: [] }),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue({ data: 'SGVsbG8=' }),
  },
}));

vi.mock('@capacitor/share', () => ({
  Share: {
    share: vi.fn().mockResolvedValue({ activityType: 'com.apple.share' }),
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

describe('Native Bridge - Filename Sanitization', () => {
  it('sanitizes ordinary titles and appends normalized extension', () => {
    expect(sanitizeExportFilename('Computer Science 101', 'md')).toBe('Computer Science 101.md');
    expect(sanitizeExportFilename('Physics_Lab_Syllabus', '.json')).toBe('Physics_Lab_Syllabus.json');
  });

  it('strips directory traversal and path separators', () => {
    expect(sanitizeExportFilename('../../evil/path/syllabus', 'pdf')).toBe('_evil_path_syllabus.pdf');
    expect(sanitizeExportFilename('..\\..\\windows\\traversal', 'docx')).toBe('_windows_traversal.docx');
  });

  it('strips Windows unsafe characters and control characters', () => {
    expect(sanitizeExportFilename('Math <101>: "Calculus" | Part *?', 'html')).toBe('Math _101_ _Calculus_ _ Part __.html');
  });

  it('protects against Windows reserved filenames', () => {
    expect(sanitizeExportFilename('CON', 'txt')).toBe('CON_file.txt');
    expect(sanitizeExportFilename('NUL', 'json')).toBe('NUL_file.json');
    expect(sanitizeExportFilename('com1', 'md')).toBe('com1_file.md');
  });

  it('prevents duplicate extension suffixes', () => {
    expect(sanitizeExportFilename('data_structures.json', 'json')).toBe('data_structures.json');
    expect(sanitizeExportFilename('operating_systems.md', 'MD')).toBe('operating_systems.md');
  });

  it('preserves readable Unicode titles', () => {
    expect(sanitizeExportFilename('자료구조_및_알고리즘', 'pdf')).toBe('자료구조_및_알고리즘.pdf');
    expect(sanitizeExportFilename('Théorie_des_Graphes', 'md')).toBe('Théorie_des_Graphes.md');
  });

  it('falls back to syllabus-export on empty or invalid inputs', () => {
    expect(sanitizeExportFilename('', 'md')).toBe('syllabus-export.md');
    expect(sanitizeExportFilename('   ', 'json')).toBe('syllabus-export.json');
    expect(sanitizeExportFilename('..', 'txt')).toBe('syllabus-export.txt');
  });
});

describe('Native Bridge - Memory-Conscious Content Conversion', () => {
  it('converts plain and Unicode strings to Base64', async () => {
    const text = 'Hello, Syllabus Tracker! 🚀';
    const b64 = await contentToBase64(text);
    expect(typeof b64).toBe('string');
    expect(b64.length).toBeGreaterThan(0);
  });

  it('converts Blob data to Base64 in chunks without stack overflow', async () => {
    const largeArray = new Uint8Array(65536); // 64KB
    largeArray.fill(65); // 'A'
    const blob = new Blob([largeArray], { type: 'application/octet-stream' });
    const b64 = await contentToBase64(blob);
    expect(b64).toBeDefined();
    expect(b64.startsWith('QQQ')).toBe(true);
  });
});

describe('Native Bridge - Outgoing File Export and Sharing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to native Filesystem and Share plugin when on native platform', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');

    const outcome = await exportAndShareFile({
      filename: 'CS301_Curriculum.md',
      mimeType: 'text/markdown',
      content: '# CS301 Syllabus',
      dialogTitle: 'Share Syllabus',
    });

    expect(outcome).toBe('shared');
    expect(Filesystem.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({
        directory: Directory.Cache,
      })
    );
    expect(Filesystem.getUri).toHaveBeenCalled();
    expect(Share.share).toHaveBeenCalledWith(
      expect.objectContaining({
        dialogTitle: 'Share Syllabus',
      })
    );
  });

  it('triggers browser anchor download when running on web', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('web');

    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName === 'a') {
        el.click = clickSpy;
      }
      return el;
    });

    const outcome = await exportAndShareFile({
      filename: 'Web_Export.md',
      mimeType: 'text/markdown',
      content: '# Web Export Content',
    });

    expect(outcome).toBe('downloaded');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });
});

describe('Native Bridge - Share Summary', () => {
  it('uses Share.share on native platform', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('ios');

    const outcome = await shareSummary({
      title: 'B.Tech CS 2026',
      text: 'Progress: 75% completed',
    });

    expect(outcome).toBe('shared');
    expect(Share.share).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'B.Tech CS 2026',
        text: 'Progress: 75% completed',
      })
    );
  });

  it('uses navigator.share when available on web', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('web');

    const navShare = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      value: navShare,
      configurable: true,
      writable: true,
    });

    const outcome = await shareSummary({
      title: 'B.Tech CS 2026',
      text: 'Progress: 75% completed',
    });

    expect(outcome).toBe('shared');
    expect(navShare).toHaveBeenCalled();
  });

  it('falls back to clipboard copy when navigator.share is unavailable', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('web');

    Object.defineProperty(navigator, 'share', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });

    const outcome = await shareSummary({
      title: 'B.Tech CS 2026',
      text: 'Progress: 75% completed',
    });

    expect(outcome).toBe('copied');
    expect(writeTextMock).toHaveBeenCalledWith('B.Tech CS 2026\n\nProgress: 75% completed');
  });
});

describe('Native Bridge - Incoming Document Share Listener', () => {
  it('dispatches file from custom window event and filters unsupported extensions', () => {
    const onFile = vi.fn();
    const cleanup = registerIncomingShareListener(onFile);

    // Unsupported extension .exe
    const badFile = new File(['bad'], 'malicious.exe', { type: 'application/octet-stream' });
    window.dispatchEvent(new CustomEvent('syllabus:incomingDocument', { detail: { file: badFile } }));
    expect(onFile).not.toHaveBeenCalled();

    // Supported extension .pdf
    const goodFile = new File(['%PDF-1.5 test'], 'cs101_syllabus.pdf', { type: 'application/pdf' });
    window.dispatchEvent(new CustomEvent('syllabus:incomingDocument', { detail: { file: goodFile } }));
    expect(onFile).toHaveBeenCalledWith(goodFile);

    // Deduplication check: dispatching same file should not call callback again
    window.dispatchEvent(new CustomEvent('syllabus:incomingDocument', { detail: { file: goodFile } }));
    expect(onFile).toHaveBeenCalledTimes(1);

    cleanup();
  });
});
