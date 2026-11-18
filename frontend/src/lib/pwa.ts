/**
 * PWA Registration and Lifecycle Management Service
 */

export interface PwaRegistrationOptions {
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
}

let deferredPrompt: any = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    deferredPrompt = e;
  });
}

/**
 * Registers the service worker in production and browser-supported environments.
 */
export async function registerServiceWorker(
  options?: PwaRegistrationOptions
): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  // Allow registration in all environments supporting SW
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    registration.addEventListener('updatefound', () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // New content is available once old tabs close or skipWaiting triggers
            console.log('[PWA] New version available.');
            options?.onUpdate?.(registration);
          } else {
            // Precache complete
            console.log('[PWA] Content is cached for offline use.');
            options?.onSuccess?.(registration);
          }
        }
      });
    });

    return registration;
  } catch (error) {
    console.warn('[PWA] ServiceWorker registration failed:', error);
    return null;
  }
}

/**
 * Unregister service worker (useful for development or debugging).
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      return await registration.unregister();
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Checks if the application is currently running as a standalone PWA.
 */
export function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

/**
 * Trigger browser native install prompt if available.
 */
export async function promptPwaInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) {
    return 'unavailable';
  }

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome;
}
