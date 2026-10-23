import './ui/styles.css';
import { App } from './core/App';
import { registerServiceWorker } from './pwa';

const boot = document.getElementById('boot')!;
const status = (t: string): void => {
  const el = document.getElementById('boot-status');
  if (el) el.textContent = t;
};

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

registerServiceWorker();

if (!webglAvailable()) {
  boot.innerHTML = 'NITRO<span>VOLT</span><small>This browser or device has WebGL turned off, so the game cannot draw. Try another browser, or enable hardware acceleration.</small>';
} else {
  status('building the world…');
  App.start(document.getElementById('app')!, document.getElementById('canvas-host')!, status)
    .then(() => {
      boot.classList.add('gone');
      setTimeout(() => boot.remove(), 600);
    })
    .catch((err: unknown) => {
      console.error(err);
      boot.innerHTML = `NITRO<span>VOLT</span><small>failed to start: ${(err as Error)?.message ?? err}</small><small><a href="" style="color:#3d7eff">reload</a></small>`;
    });
}
