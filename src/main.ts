import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-700-italic.css';
import '@fontsource/barlow-condensed/latin-800-italic.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
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
  // signage is drawn on canvases with the race font: make sure it is loaded first (bundled, works offline)
  const fonts = ['italic 800 64px "Barlow Condensed"', 'italic 700 64px "Barlow Condensed"', '700 64px "Barlow Condensed"'];
  const fontsReady = Promise.race([Promise.all(fonts.map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 2500))]).catch(() => undefined);
  fontsReady
    .then(() => App.start(document.getElementById('app')!, document.getElementById('canvas-host')!, status))
    .then(() => {
      boot.classList.add('gone');
      setTimeout(() => boot.remove(), 600);
    })
    .catch((err: unknown) => {
      console.error(err);
      boot.innerHTML = `NITRO<span>VOLT</span><small>failed to start: ${(err as Error)?.message ?? err}</small><small><a href="" style="color:#3d7eff">reload</a></small>`;
    });
}
