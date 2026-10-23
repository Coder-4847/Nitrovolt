/**
 * Registers the service worker (production builds only) and offers a reload when a new version has been
 * downloaded in the background.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .then((reg) => {
        const offer = (w: ServiceWorker): void => {
          if (document.querySelector('.update-bar')) return;
          const bar = document.createElement('div');
          bar.className = 'update-bar';
          bar.innerHTML = '<span>A new version is ready</span>';
          const b = document.createElement('button');
          b.className = 'btn primary';
          b.textContent = 'Reload';
          b.onclick = () => {
            w.postMessage('skip-waiting');
            navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
          };
          bar.append(b);
          document.getElementById('app')?.append(bar);
        };
        if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          w?.addEventListener('statechange', () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
          });
        });
      })
      .catch(() => undefined);
  });
}
