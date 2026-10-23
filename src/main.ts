import './ui/styles.css';
import { App } from './core/App';

const boot = document.getElementById('boot')!;

App.start(document.getElementById('app')!, document.getElementById('canvas-host')!)
  .then(() => {
    boot.classList.add('gone');
    setTimeout(() => boot.remove(), 600);
  })
  .catch((err: unknown) => {
    console.error(err);
    boot.innerHTML = `NITRO<span>VOLT</span><small>failed to start: ${(err as Error)?.message ?? err}</small>`;
  });
