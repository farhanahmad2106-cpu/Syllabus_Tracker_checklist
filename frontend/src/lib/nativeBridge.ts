/**
 * Native bridge integrating Capacitor platform capabilities (Status Bar, App lifecycle,
 * Hardware Back Button, Native Share Sheet, Filesystem Export & Ingestion) with the React application.
 *
 * Provides safe fallbacks when running on Web or PWA so that browser functionality
 * remains completely unhindered.
 */

import { Capacitor, type PluginListenerHandle, registerPlugin } from '@capacitor/core';
import { App as CapApp, type URLOpenListenerEvent } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// --- Supported MIME Types and Extensions ---

export const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt'] as const;

export const SUPPORTED_MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  txt: 'text/plain',
};

const WINDOWS_RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

// Custom Native Plugin Interface for Android Incoming Share
interface IncomingSharePlugin {
  getPendingDocument(): Promise<{
    hasDocument: boolean;
    name?: string;
    mimeType?: string;
    data?: string; // Base64
    url?: string;
  }>;
  clearPendingDocument(): Promise<{ cleared: boolean }>;
  addListener(
    eventName: 'incomingDocumentReceived',
    listenerFunc: (doc: { name: string; mimeType: string; data?: string; url?: string }) => void
  ): Promise<PluginListenerHandle>;
}

const IncomingShare = registerPlugin<IncomingSharePlugin>('IncomingShare');

/**
 * Returns true if running within a native wrapper (Android or iOS), false on Web / PWA.
 */
export function isNativePlatform(): boolean {
  try {
    return typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Returns the active platform identifier: 'android', 'ios', or 'web'.
 */
export function getNativePlatform(): 'android' | 'ios' | 'web' {
  try {
    if (typeof Capacitor !== 'undefined') {
      const platform = Capacitor.getPlatform();
      if (platform === 'android' || platform === 'ios') {
        return platform;
      }
    }
  } catch {
    // fallback to web
  }
  return 'web';
}

/**
 * Synchronizes the native status bar text and background colors with the active theme.
 */
export async function syncNativeStatusBar(resolvedTheme: 'dark' | 'light'): Promise<void> {
  if (!isNativePlatform()) {
    return;
  }

  try {
    const isDark = resolvedTheme === 'dark';
    const contentStyle = isDark ? Style.Light : Style.Dark;
    const backgroundColor = isDark ? '#09090B' : '#FAFAFA';

    await StatusBar.setStyle({ style: contentStyle });

    if (getNativePlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: backgroundColor });
    }
  } catch (error) {
    console.warn('[SyllabusTracker:NativeBridge] Failed to synchronize status bar:', error);
  }
}

/**
 * Registers an Android hardware back-button listener.
 */
export function registerNativeBackButton(onInterceptBack: () => boolean): () => void {
  if (!isNativePlatform() || getNativePlatform() !== 'android') {
    return () => {};
  }

  let handle: PluginListenerHandle | null = null;
  let isCleanedUp = false;

  CapApp.addListener('backButton', ({ canGoBack }) => {
    try {
      const intercepted = onInterceptBack();
      if (intercepted) {
        return;
      }

      if (canGoBack) {
        window.history.back();
      } else {
        CapApp.exitApp();
      }
    } catch (err) {
      console.error('[SyllabusTracker:NativeBridge] Error in backButton handler:', err);
    }
  })
    .then((listenerHandle) => {
      if (isCleanedUp) {
        listenerHandle.remove().catch(() => {});
      } else {
        handle = listenerHandle;
      }
    })
    .catch((err) => {
      console.warn('[SyllabusTracker:NativeBridge] Could not add backButton listener:', err);
    });

  return () => {
    isCleanedUp = true;
    if (handle) {
      handle.remove().catch(() => {});
      handle = null;
    }
  };
}

// ============================================================================
// Phase 13 Cycle C: Filename Sanitization & Memory-Conscious Base64 Conversion
// ============================================================================

/**
 * Sanitizes raw titles for cross-platform filesystem export and sharing.
 * Strips directory traversal (`..`), path separators (`/`, `\`), control characters,
 * Windows reserved names, and dangerous punctuation while preserving readable Unicode.
 */
export function sanitizeExportFilename(rawTitle: string, extension: string): string {
  const normExt = extension.trim().toLowerCase().replace(/^\.+/, '');
  const fallbackExt = normExt || 'bin';

  if (!rawTitle || typeof rawTitle !== 'string') {
    return `syllabus-export.${fallbackExt}`;
  }

  // Remove path separators and directory traversal sequences
  let cleaned = rawTitle
    .replace(/(?:\.\.[/\\]+)+/g, '_')
    .replace(/[/\\]+/g, '_')
    .replace(/\.\.+/g, '');

  // Strip control characters (ASCII 0-31 and 127)
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');

  // Strip Windows drive colon and replace unsafe punctuation
  cleaned = cleaned.replace(/:/g, '');
  cleaned = cleaned.replace(/[<>"|?*]/g, '_');

  // Collapse consecutive whitespaces and trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // If title already ends with the extension, strip it before appending
  const extSuffixRegex = new RegExp(`\\.${normExt}$`, 'i');
  cleaned = cleaned.replace(extSuffixRegex, '').trim();

  // Strip leading dots to prevent hidden files
  cleaned = cleaned.replace(/^\.+/, '');

  // Check for Windows reserved names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
  const baseUpper = cleaned.toUpperCase().split('.')[0];
  if (WINDOWS_RESERVED_NAMES.has(baseUpper)) {
    cleaned = `${cleaned}_file`;
  }

  // Enforce reasonable length constraint on title portion (max 100 characters)
  if (cleaned.length > 100) {
    cleaned = cleaned.substring(0, 100).trim();
  }

  if (!cleaned || cleaned === '_') {
    cleaned = 'syllabus-export';
  }

  return `${cleaned}.${fallbackExt}`;
}

/**
 * Memory-conscious conversion of string or Blob to Base64 without call-stack overflows.
 * Uses 8KB chunking over binary byte buffers.
 */
export async function contentToBase64(content: string | Blob): Promise<string> {
  const CHUNK_SIZE = 8192;

  if (typeof content === 'string') {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(content);
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      const chunk = bytes.subarray(i, i + CHUNK_SIZE);
      binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }
    return btoa(binary);
  }

  if (content instanceof Blob) {
    const buffer = await content.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      const chunk = bytes.subarray(i, i + CHUNK_SIZE);
      binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }
    return btoa(binary);
  }

  throw new Error('Unsupported content type for Base64 conversion.');
}

/**
 * Converts a Base64 string to a standard browser Blob.
 */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

// ============================================================================
// Phase 13 Cycle C: Temporary Export Cache Management
// ============================================================================

const EXPORT_PREFIX = 'syllabus_export_';
const MAX_STALE_CACHE_MS = 60 * 60 * 1000; // 1 hour

/**
 * Clean up stale export files owned by this application inside Directory.Cache.
 * Only targets files matching `syllabus_export_*` that exceed the age threshold.
 */
export async function cleanupStaleExportCache(): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    const listResult = await Filesystem.readdir({
      path: '',
      directory: Directory.Cache,
    });

    const now = Date.now();
    for (const file of listResult.files) {
      const fileName = typeof file === 'string' ? file : file.name;
      if (fileName && fileName.startsWith(EXPORT_PREFIX)) {
        // Attempt to parse timestamp from filename: syllabus_export_<timestamp>_<name>
        const parts = fileName.split('_');
        const fileTs = parts.length >= 3 ? parseInt(parts[2], 10) : NaN;
        const isStale = !isNaN(fileTs) && now - fileTs > MAX_STALE_CACHE_MS;

        if (isStale) {
          await Filesystem.deleteFile({
            path: fileName,
            directory: Directory.Cache,
          }).catch(() => {});
        }
      }
    }
  } catch {
    // Non-fatal cache inspection failure; preserve app stability
  }
}

// ============================================================================
// Phase 13 Cycle C: Outgoing File Export & Sharing API
// ============================================================================

export interface ExportAndShareOptions {
  filename: string;
  mimeType: string;
  content: string | Blob;
  dialogTitle?: string;
}

/**
 * Exports and shares a syllabus document.
 * - On Native (Android/iOS): Writes to `Directory.Cache`, retrieves file URI, and presents native Share sheet.
 * - On Web/PWA: Creates Object URL and triggers browser anchor download.
 */
export async function exportAndShareFile(
  options: ExportAndShareOptions
): Promise<'shared' | 'downloaded'> {
  const { filename, mimeType, content, dialogTitle } = options;

  // Extract extension
  const extParts = filename.split('.');
  const ext = extParts.length > 1 ? extParts.pop() || 'bin' : 'bin';
  const safeFilename = sanitizeExportFilename(filename, ext);

  if (isNativePlatform()) {
    try {
      const base64Data = await contentToBase64(content);
      const now = Date.now();
      const cacheFilename = `${EXPORT_PREFIX}${now}_${safeFilename}`;

      await Filesystem.writeFile({
        path: cacheFilename,
        data: base64Data,
        directory: Directory.Cache,
      });

      const fileUri = await Filesystem.getUri({
        path: cacheFilename,
        directory: Directory.Cache,
      });

      await Share.share({
        title: dialogTitle || 'Share Syllabus',
        files: [fileUri.uri],
        dialogTitle: dialogTitle || 'Share Syllabus',
      });

      // Asynchronously trigger cleanup of older stale exports
      cleanupStaleExportCache().catch(() => {});

      return 'shared';
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      // If user dismissed share sheet, consider as resolved without throwing error
      if (errMessage.toLowerCase().includes('canceled') || errMessage.toLowerCase().includes('cancelled') || errMessage.toLowerCase().includes('dismissed')) {
        return 'shared';
      }
      throw new Error(`Native share failed: ${errMessage}`);
    }
  }

  // --- Browser & PWA Download Fallback ---
  try {
    let blob: Blob;
    if (content instanceof Blob) {
      blob = content;
    } else {
      blob = new Blob([content], { type: mimeType });
    }

    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = safeFilename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();

    setTimeout(() => {
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);
    }, 1500);

    return 'downloaded';
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err);
    throw new Error(`Browser download failed: ${errMessage}`);
  }
}

/**
 * Shares a text summary or academic link across native and browser sharing platforms.
 */
export async function shareSummary(options: {
  title: string;
  text: string;
  url?: string;
  dialogTitle?: string;
}): Promise<'shared' | 'copied'> {
  const { title, text, url, dialogTitle } = options;

  if (isNativePlatform()) {
    try {
      await Share.share({
        title,
        text,
        url,
        dialogTitle: dialogTitle || title,
      });
      return 'shared';
    } catch (err) {
      console.warn('[SyllabusTracker:NativeBridge] Native text share canceled or failed:', err);
      return 'shared';
    }
  }

  // Web Share API
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title,
        text,
        url,
      });
      return 'shared';
    } catch {
      // Fall through to clipboard copy
    }
  }

  // Clipboard Fallback
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    const fullText = url ? `${title}\n\n${text}\n\n${url}` : `${title}\n\n${text}`;
    await navigator.clipboard.writeText(fullText);
    return 'copied';
  }

  return 'copied';
}

// ============================================================================
// Phase 13 Cycle C: Incoming Document & Share Listener Registration
// ============================================================================

/**
 * Consumes any pending document or URL deposited by the PWA Web Share Target Service Worker.
 */
export async function consumePwaShareTarget(): Promise<{ file?: File; url?: string } | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return null;
  }

  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open('syllabus_pwa_share_db', 1);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('shared_items')) {
          db.createObjectStore('shared_items', { keyPath: 'id', autoIncrement: true });
        }
      };

      req.onsuccess = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('shared_items')) {
          db.close();
          resolve(null);
          return;
        }

        const tx = db.transaction('shared_items', 'readwrite');
        const store = tx.objectStore('shared_items');
        const getAllReq = store.getAll();

        getAllReq.onsuccess = () => {
          const items = getAllReq.result;
          if (!items || items.length === 0) {
            db.close();
            resolve(null);
            return;
          }

          // Consume the first pending item and clear the store
          const item = items[0];
          store.clear();
          db.close();

          if (item.file) {
            resolve({ file: item.file });
          } else if (item.url) {
            resolve({ url: item.url });
          } else {
            resolve(null);
          }
        };

        getAllReq.onerror = () => {
          db.close();
          resolve(null);
        };
      };

      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Registers listeners for incoming documents shared or opened via:
 * 1. Android Intent Filter (ACTION_SEND / ACTION_VIEW via IncomingSharePlugin)
 * 2. iOS document-opening lifecycle (appUrlOpen)
 * 3. PWA Web Share Target (POST /share-target)
 *
 * @param onFileReceived Callback receiving the constructed standard Web File.
 * @param onUrlReceived Optional callback receiving incoming shared URLs.
 * @returns Cleanup function removing all registered native and window listeners.
 */
export function registerIncomingShareListener(
  onFileReceived: (file: File) => void,
  onUrlReceived?: (url: string) => void
): () => void {
  const handledFingerprints = new Set<string>();
  let isCleanedUp = false;
  let appUrlHandle: PluginListenerHandle | null = null;
  let incomingShareHandle: PluginListenerHandle | null = null;

  const handleIncomingFile = (file: File) => {
    if (isCleanedUp) return;
    const fp = `${file.name}_${file.size}_${file.lastModified}`;
    if (handledFingerprints.has(fp)) return;
    handledFingerprints.add(fp);

    // Filter by supported extensions
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const isSupported = (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
    if (!isSupported) {
      console.warn(`[SyllabusTracker:NativeBridge] Rejected unsupported incoming file: ${file.name}`);
      return;
    }

    onFileReceived(file);
  };

  const handleIncomingUrl = (url: string) => {
    if (isCleanedUp || !onUrlReceived) return;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        onUrlReceived(url);
      }
    } catch {
      // Ignore invalid URL strings
    }
  };

  // 1. Android Native Incoming Share Plugin
  if (isNativePlatform() && getNativePlatform() === 'android') {
    // Check cold-start pending document
    IncomingShare.getPendingDocument()
      .then((res) => {
        if (!isCleanedUp && res.hasDocument && res.name) {
          if (res.data) {
            const blob = base64ToBlob(res.data, res.mimeType || 'application/pdf');
            const file = new File([blob], res.name, {
              type: res.mimeType || 'application/pdf',
              lastModified: Date.now(),
            });
            handleIncomingFile(file);
          } else if (res.url) {
            handleIncomingUrl(res.url);
          }
          IncomingShare.clearPendingDocument().catch(() => {});
        }
      })
      .catch((err) => {
        console.warn('[SyllabusTracker:NativeBridge] IncomingShare cold-start check:', err);
      });

    // Listen for warm-start incoming events
    IncomingShare.addListener('incomingDocumentReceived', (doc) => {
      if (isCleanedUp) return;
      if (doc.data && doc.name) {
        const blob = base64ToBlob(doc.data, doc.mimeType || 'application/pdf');
        const file = new File([blob], doc.name, {
          type: doc.mimeType || 'application/pdf',
          lastModified: Date.now(),
        });
        handleIncomingFile(file);
      } else if (doc.url) {
        handleIncomingUrl(doc.url);
      }
    })
      .then((handle) => {
        if (isCleanedUp) {
          handle.remove().catch(() => {});
        } else {
          incomingShareHandle = handle;
        }
      })
      .catch(() => {});
  }

  // 2. iOS & General App URL Open (Files app, deep links, security-scoped document URLs)
  if (isNativePlatform()) {
    CapApp.addListener('appUrlOpen', async (event: URLOpenListenerEvent) => {
      if (isCleanedUp) return;
      const url = event.url;
      if (!url) return;

      if (url.startsWith('http://') || url.startsWith('https://')) {
        handleIncomingUrl(url);
        return;
      }

      // Handle file:// and content:// URLs
      if (url.startsWith('file://') || url.startsWith('content://')) {
        try {
          const rawFilename = decodeURIComponent(url.split('/').pop() || 'imported_syllabus.pdf');
          const extParts = rawFilename.split('.');
          const ext = extParts.length > 1 ? extParts.pop() || 'pdf' : 'pdf';
          const safeName = sanitizeExportFilename(rawFilename, ext);

          const readResult = await Filesystem.readFile({ path: url });
          const base64Data = typeof readResult.data === 'string' ? readResult.data : '';
          if (base64Data) {
            const mime = SUPPORTED_MIME_TYPES[ext.toLowerCase()] || 'application/octet-stream';
            const blob = base64ToBlob(base64Data, mime);
            const file = new File([blob], safeName, {
              type: mime,
              lastModified: Date.now(),
            });
            handleIncomingFile(file);
          }
        } catch (err) {
          console.warn('[SyllabusTracker:NativeBridge] Failed to read appUrlOpen file:', err);
        }
      }
    })
      .then((handle) => {
        if (isCleanedUp) {
          handle.remove().catch(() => {});
        } else {
          appUrlHandle = handle;
        }
      })
      .catch(() => {});
  }

  // 3. Web & PWA Custom Window Event Listener (for synthetic or mocked testing)
  const windowDocHandler = (e: Event) => {
    const customEvent = e as CustomEvent<{ file?: File; url?: string }>;
    if (customEvent.detail?.file) {
      handleIncomingFile(customEvent.detail.file);
    } else if (customEvent.detail?.url) {
      handleIncomingUrl(customEvent.detail.url);
    }
  };
  window.addEventListener('syllabus:incomingDocument', windowDocHandler);

  // 4. PWA Web Share Target IndexedDB check
  consumePwaShareTarget()
    .then((result) => {
      if (!isCleanedUp && result) {
        if (result.file) {
          handleIncomingFile(result.file);
        } else if (result.url) {
          handleIncomingUrl(result.url);
        }
      }
    })
    .catch(() => {});

  // Cleanup function
  return () => {
    isCleanedUp = true;
    window.removeEventListener('syllabus:incomingDocument', windowDocHandler);
    if (appUrlHandle) {
      appUrlHandle.remove().catch(() => {});
      appUrlHandle = null;
    }
    if (incomingShareHandle) {
      incomingShareHandle.remove().catch(() => {});
      incomingShareHandle = null;
    }
  };
}
