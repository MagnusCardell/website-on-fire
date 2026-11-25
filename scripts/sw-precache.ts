// Works out which files the solitaire service worker has to cache for the page
// to load with no network, from Vite's build manifest and the built HTML.

export interface ManifestChunk {
  file: string;
  css?: string[];
  assets?: string[];
  imports?: string[];
  dynamicImports?: string[];
}

export type ViteManifest = Record<string, ManifestChunk>;

// Files the page needs that Vite does not know about (served from client/public)
export const SHELL_FILES = [
  '/solitaire/',
  '/solitaire/manifest.webmanifest',
  '/solitaire/icon-192.png',
  '/solitaire/icon-512.png',
];

// Every file of an entry: its own, and those of every chunk it imports
export function collectEntryFiles(manifest: ViteManifest, entryKey: string): string[] {
  const files = new Set<string>();
  const seen = new Set<string>();

  const visit = (key: string) => {
    if (seen.has(key)) return;
    seen.add(key);

    const chunk = manifest[key];
    if (!chunk) throw new Error(`Chunk "${key}" is not in the Vite manifest`);

    files.add(`/${chunk.file}`);
    for (const css of chunk.css ?? []) files.add(`/${css}`);
    for (const asset of chunk.assets ?? []) files.add(`/${asset}`);
    for (const next of [...(chunk.imports ?? []), ...(chunk.dynamicImports ?? [])]) visit(next);
  };

  visit(entryKey);
  return [...files].sort();
}

// Same-origin files a built HTML page loads through src/href attributes
export function htmlReferences(html: string): string[] {
  const refs = new Set<string>();
  for (const match of html.matchAll(/\b(?:src|href)="(\/[^"#?]+)[^"]*"/g)) {
    if (!match[1].startsWith('//')) refs.add(match[1]);
  }
  return [...refs].sort();
}

// What the page loads that the list would leave to the network
export function missingFromPrecache(html: string, precache: string[]): string[] {
  const cached = new Set(precache);
  return htmlReferences(html).filter((ref) => !cached.has(ref));
}

// The folder the game is built into and served from
export const SCOPE = '/solitaire/';

// Cached files served from outside the game's folder. Everything out there is
// written by the site's build, so such a file changes when the site does, and
// every installed copy of the game would download itself again.
export function outsideScope(precache: string[], scope: string): string[] {
  return precache.filter((file) => !file.startsWith(scope));
}

export function stampServiceWorker(source: string, buildId: string, precache: string[]): string {
  const idMarker = /const BUILD_ID = 'dev'; \/\/ __BUILD_ID__/;
  const listMarker = /^[ \t]*\/\/ __PRECACHE__$/m;
  if (!idMarker.test(source) || !listMarker.test(source)) {
    throw new Error('Injection markers not found in sw.js');
  }

  return source
    .replace(idMarker, `const BUILD_ID = '${buildId}';`)
    .replace(listMarker, precache.map((file) => `  '${file}',`).join('\n'));
}
