import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const manifestPath = resolve(root, 'dist/public/.vite/manifest.json');
const swPath = resolve(root, 'dist/public/solitaire/sw.js');

const manifest: Record<string, { file: string; css?: string[] }> =
  JSON.parse(readFileSync(manifestPath, 'utf-8'));

const solitaireEntry = manifest['solitaire/index.html'];
if (!solitaireEntry) {
  console.error('Could not find solitaire entry in Vite manifest');
  process.exit(1);
}

const precacheAssets: string[] = [
  `/assets/${solitaireEntry.file.split('/').pop()}`,
  ...(solitaireEntry.css ?? []).map((f) => `/assets/${f.split('/').pop()}`),
];

const sw = readFileSync(swPath, 'utf-8');
const patched = sw.replace(
  '// __PRECACHE_ASSETS__',
  precacheAssets.map((a) => `  '${a}',`).join('\n'),
);

if (patched === sw) {
  console.error('Injection marker not found in sw.js');
  process.exit(1);
}

writeFileSync(swPath, patched);
console.log('SW precache assets injected:', precacheAssets);
