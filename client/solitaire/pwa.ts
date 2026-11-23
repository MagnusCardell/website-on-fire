// Registers the service worker that makes the game load without a network,
// and keeps an installed copy of the game up to date.

function isInstalled(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)')?.matches === true;
}

export function registerServiceWorker(): () => void {
  if (!('serviceWorker' in navigator)) return () => {};

  let registration: ServiceWorkerRegistration | undefined;
  let hadController = navigator.serviceWorker.controller !== null;
  let updateReady = false;

  navigator.serviceWorker
    .register('/solitaire/sw.js', { scope: '/solitaire/', updateViaCache: 'none' })
    .then((reg) => {
      registration = reg;
    })
    .catch((err) => console.warn('SW registration failed:', err));

  // Ask the browser to keep the cached game and the saved stats for good.
  // Only for an installed copy: some browsers answer this with a prompt.
  if (isInstalled()) {
    navigator.storage?.persist?.().catch(() => {});
  }

  // A new version has taken over while this page still runs the old one
  const onControllerChange = () => {
    if (hadController) updateReady = true;
    hadController = true;
  };

  // An installed app is brought back from the background far more often than
  // it is launched, so that is when it looks for a new version, and when it
  // switches to one that is ready. The game in progress is saved on every move.
  const onVisibilityChange = () => {
    if (document.visibilityState !== 'visible') return;
    if (updateReady) {
      window.location.reload();
      return;
    }
    registration?.update().catch(() => {});
  };

  navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
  document.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
