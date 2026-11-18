/**
 * Native bridge integrating Capacitor platform capabilities (Status Bar, App lifecycle,
 * Hardware Back Button) with the React application.
 *
 * Provides safe fallbacks when running on Web or PWA so that browser functionality
 * remains completely unhindered.
 */

import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

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
 *
 * Dark theme:
 * - Content style: Style.Light (light text/icons)
 * - Android background: #09090B (deep zinc)
 *
 * Light theme:
 * - Content style: Style.Dark (dark text/icons)
 * - Android background: #FAFAFA (soft neutral light)
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
 *
 * @param onInterceptBack Callback invoked when back button is pressed.
 * Must return `true` if an overlay or modal was consumed/closed, or `false` to permit default back/exit.
 * @returns Cleanup function to unregister the listener.
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
