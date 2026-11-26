/**
 * PWA Service with built-in instant rollback support.
 * Set ENABLE_PWA = false anytime to unregister the Service Worker and clear caches.
 */
export const ENABLE_PWA = true;

export function initPWA() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  if (!ENABLE_PWA) {
    unregisterServiceWorker();
    return;
  }

  // Register Service Worker in production mode
  window.addEventListener('load', () => {
    // Relative path to sw.js ensures compatibility with sub-paths (e.g. GitHub Pages)
    const swUrl = './sw.js';
    navigator.serviceWorker
      .register(swUrl, { scope: './' })
      .then((registration) => {
        // Silently check for updates in background
        registration.update().catch(() => {});
      })
      .catch((err) => {
        console.warn('[PWA] Registration failed:', err);
      });
  });
}

/**
 * Instant rollback: deregisters all service workers and wipes power-map caches.
 */
export function unregisterServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });

  if ('caches' in window) {
    caches.keys().then((keys) => {
      keys.forEach((key) => {
        if (key.startsWith('power-map-')) {
          caches.delete(key);
        }
      });
    });
  }
}
