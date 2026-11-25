import { describe, expect, test } from 'bun:test';
import {
  SCOPE,
  SHELL_FILES,
  collectEntryFiles,
  htmlReferences,
  missingFromPrecache,
  outsideScope,
  stampServiceWorker,
  type ViteManifest,
} from './sw-precache';

const manifest: ViteManifest = {
  '_shared-AAAA.js': { file: 'assets/shared-AAAA.js', css: ['assets/shared-BBBB.css'], imports: ['_deep-CCCC.js'] },
  '_deep-CCCC.js': { file: 'assets/deep-CCCC.js' },
  'index.html': { file: 'assets/main-DDDD.js', imports: ['_shared-AAAA.js'] },
  'solitaire/index.html': {
    file: 'assets/solitaire-EEEE.js',
    css: ['assets/solitaire-FFFF.css'],
    imports: ['_shared-AAAA.js'],
  },
};

const html = `
  <link rel="manifest" href="/solitaire/manifest.webmanifest" />
  <link rel="apple-touch-icon" href="/solitaire/icon-192.png" />
  <script type="module" crossorigin src="/assets/solitaire-EEEE.js"></script>
  <link rel="modulepreload" crossorigin href="/assets/shared-AAAA.js">
  <link rel="stylesheet" crossorigin href="/assets/shared-BBBB.css">
  <link rel="stylesheet" crossorigin href="/assets/solitaire-FFFF.css">
  <a href="https://example.com/elsewhere">out</a>
`;

describe('service worker precache list', () => {
  test('follows imports to shared chunks and their css', () => {
    expect(collectEntryFiles(manifest, 'solitaire/index.html')).toEqual([
      '/assets/deep-CCCC.js',
      '/assets/shared-AAAA.js',
      '/assets/shared-BBBB.css',
      '/assets/solitaire-EEEE.js',
      '/assets/solitaire-FFFF.css',
    ]);
  });

  test('leaves out the other entry', () => {
    expect(collectEntryFiles(manifest, 'solitaire/index.html')).not.toContain('/assets/main-DDDD.js');
  });

  test('reads the files a page loads, same origin only', () => {
    expect(htmlReferences(html)).toEqual([
      '/assets/shared-AAAA.js',
      '/assets/shared-BBBB.css',
      '/assets/solitaire-EEEE.js',
      '/assets/solitaire-FFFF.css',
      '/solitaire/icon-192.png',
      '/solitaire/manifest.webmanifest',
    ]);
  });

  test('reports what the page loads and the list misses', () => {
    const full = ['/solitaire/manifest.webmanifest', '/solitaire/icon-192.png', ...collectEntryFiles(manifest, 'solitaire/index.html')];
    expect(missingFromPrecache(html, full)).toEqual([]);
    // the list before the fix: the entry's own files, without what it imports
    const entryOnly = ['/solitaire/manifest.webmanifest', '/solitaire/icon-192.png', '/assets/solitaire-EEEE.js', '/assets/solitaire-FFFF.css'];
    expect(missingFromPrecache(html, entryOnly)).toEqual(['/assets/shared-AAAA.js', '/assets/shared-BBBB.css']);
  });

  test('names cached files served from outside the game folder', () => {
    const own = ['/solitaire/', '/solitaire/icon-192.png', '/solitaire/assets/solitaire-EEEE.js'];
    expect(outsideScope(own, SCOPE)).toEqual([]);
    // the list before the game had its own build: a script and a stylesheet shared with the site
    expect(outsideScope([...own, '/assets/shared-AAAA.js', '/assets/shared-BBBB.css'], SCOPE)).toEqual([
      '/assets/shared-AAAA.js',
      '/assets/shared-BBBB.css',
    ]);
    // a folder that only starts with the same letters is not the game's folder
    expect(outsideScope(['/solitaire-old/x.js'], SCOPE)).toEqual(['/solitaire-old/x.js']);
  });

  test('the files the page always needs are inside the game folder', () => {
    expect(outsideScope(SHELL_FILES, SCOPE)).toEqual([]);
  });

  test('stamps the worker and refuses a worker without markers', () => {
    const source = "const BUILD_ID = 'dev'; // __BUILD_ID__\nconst PRECACHE = [\n  // __PRECACHE__\n];\n";
    expect(stampServiceWorker(source, 'abc123', ['/a', '/b'])).toBe(
      "const BUILD_ID = 'abc123';\nconst PRECACHE = [\n  '/a',\n  '/b',\n];\n",
    );
    expect(() => stampServiceWorker('const PRECACHE = [];', 'abc123', [])).toThrow();
  });
});
