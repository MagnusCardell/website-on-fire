import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  SHELL_FILES,
  collectEntryFiles,
  missingFromPrecache,
  stampServiceWorker,
  type ViteManifest,
} from './sw-precache';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'dist/public');

const manifestPath = resolve(publicDir, '.vite/manifest.json');
const swPath = resolve(publicDir, 'solitaire/sw.js');
const htmlPath = resolve(publicDir, 'solitaire/index.html');

const manifest: ViteManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
const html = readFileSync(htmlPath, 'utf-8');

const precache = [...SHELL_FILES, ...collectEntryFiles(manifest, 'solitaire/index.html')];

// The page must not load anything the worker would leave to the network,
// or it stops working offline. Fail the build instead of shipping that.
const missing = missingFromPrecache(html, precache);
if (missing.length > 0) {
  console.error('solitaire/index.html loads files the service worker does not cache:', missing);
  process.exit(1);
}

// The build id changes whenever any cached file does
const hash = createHash('sha256');
for (const file of precache) {
  const onDisk = file.endsWith('/') ? `${file}index.html` : file;
  hash.update(file);
  hash.update(readFileSync(resolve(publicDir, `.${onDisk}`)));
}
const buildId = hash.digest('hex').slice(0, 12);

writeFileSync(swPath, stampServiceWorker(readFileSync(swPath, 'utf-8'), buildId, precache));
console.log(`SW build ${buildId} precaches:`, precache);
