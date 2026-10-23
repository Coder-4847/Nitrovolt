import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * rapier3d-compat embeds its WASM as a 4 MB base64 string. For production builds, move those bytes into a
 * real .wasm asset (the same binary, so physics is unchanged): 30 % smaller, compresses ~2x better, cached
 * separately and compiled while it streams in.
 */
function rapierWasmAsset(): Plugin {
  return {
    name: 'nitrovolt:rapier-wasm-asset',
    apply: 'build',
    transform(code, id) {
      if (!/rapier3d-compat[\\/].*\.m?js$/.test(id)) return null;
      const m = /([A-Za-z_$][\w$]*)\.toByteArray\("([A-Za-z0-9+/=]{100000,})"\)(\.buffer)?/.exec(code);
      if (!m) return null;
      const bytes = Buffer.from(m[2]!, 'base64');
      const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 10);
      const fileName = `assets/rapier-${hash}.wasm`;
      this.emitFile({ type: 'asset', fileName, source: bytes });
      // wasm-bindgen's init accepts a (promise of a) Response
      return { code: code.replace(m[0], `fetch(new URL(/* @vite-ignore */ './rapier-${hash}.wasm', import.meta.url))`), map: null };
    },
  };
}

// `BASE_PATH` lets the GitHub Pages workflow build for /<repo>/ while local dev stays at "/".
const base = process.env.BASE_PATH ?? '/';

/**
 * Offline support: after the bundle is written, emit `sw.js` with the exact list of built files (source
 * maps excluded) so the whole game, including the physics WASM and every level and ghost chunk, is
 * precached on first visit (with the menu pictures in public/art). The cache name changes with the file list, so a new deploy replaces it.
 */
function serviceWorker(): Plugin {
  return {
    name: 'nitrovolt:service-worker',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map') && f !== 'sw.js');
      const art = readdirSync(new URL('./public/art', import.meta.url)).map((f) => `art/${f}`);
      const publicFiles = ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', ...art];
      const list = ['./', ...files, ...publicFiles].sort();
      const id = createHash('sha256').update(list.join('|')).digest('hex').slice(0, 12);
      const template = readFileSync(new URL('./src/sw-template.js', import.meta.url), 'utf8');
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: template.replace('__CACHE__', `nitrovolt-${version}-${id}`).replace('__FILES__', JSON.stringify(list)) });
    },
  };
}

const version = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }).version;

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [rapierWasmAsset(), serviceWorker()],
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        // long-lived vendor chunks: a game update does not re-download three.js or the physics engine
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/ },
            { name: 'rapier', test: /node_modules[\\/]@dimforge[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60000,
  },
});
