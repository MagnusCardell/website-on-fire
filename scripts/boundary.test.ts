import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import siteStyles from '../tailwind.config';
import gameStyles from '../tailwind.solitaire.config';

// The solitaire is built apart from the site, so a change to one never changes
// the built files of the other. That holds only while neither reaches into the
// other's folder.

const ROOT = resolve(import.meta.dir, '..');
const GAME = join(ROOT, 'client/solitaire');
const SITE = join(ROOT, 'client/src');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(tsx?|css)$/.test(name) ? [path] : [];
  });
}

// The files of this repo a source pulls in: import, export from, @import
export function localImports(path: string, text: string): string[] {
  const specifiers = new Set([
    ...text.matchAll(/\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g),
    ...text.matchAll(/\bimport\s*\(?\s*['"]([^'"]+)['"]/g),
    ...text.matchAll(/@import\s+(?:url\()?['"]([^'"]+)['"]/g),
  ].map((match) => match[1]));

  return [...specifiers].flatMap((specifier) => {
    if (specifier.startsWith('.')) return [resolve(dirname(path), specifier)];
    if (specifier.startsWith('@/')) return [join(SITE, specifier.slice(2))];
    return []; // a package
  });
}

const inside = (dir: string, path: string) => !relative(dir, path).startsWith('..');
const reads = (path: string) => localImports(path, readFileSync(path, 'utf-8'));

describe('the solitaire and the site keep to their own folders', () => {
  test('finds an import that leaves the folder', () => {
    const main = join(GAME, 'main.tsx');
    // what main.tsx held while the game shared the site's stylesheet
    const before = 'import "../src/index.css";\nimport "./solitaire.css";\nimport { SolitaireApp } from "./SolitaireApp";';
    expect(localImports(main, before).filter((path) => !inside(GAME, path))).toEqual([join(SITE, 'index.css')]);
    expect(localImports(join(GAME, 'a.css'), '@import "../src/index.css";')).toEqual([join(SITE, 'index.css')]);
    expect(localImports(main, 'import { cn } from "@/lib/utils";')).toEqual([join(SITE, 'lib/utils')]);
  });

  test('the game imports nothing from outside its folder', () => {
    const files = sources(GAME);
    expect(files.length).toBeGreaterThan(20);
    const leaks = files.flatMap((file) =>
      reads(file).filter((path) => !inside(GAME, path)).map((path) => `${relative(ROOT, file)} -> ${relative(ROOT, path)}`),
    );
    expect(leaks).toEqual([]);
  });

  test('the site imports nothing from the game folder', () => {
    const files = sources(SITE);
    expect(files.length).toBeGreaterThan(10);
    const leaks = files.flatMap((file) =>
      reads(file).filter((path) => inside(GAME, path)).map((path) => `${relative(ROOT, file)} -> ${relative(ROOT, path)}`),
    );
    expect(leaks).toEqual([]);
  });

  test('each stylesheet is built from its own folder only', () => {
    expect(gameStyles.content.length).toBeGreaterThan(0);
    for (const glob of gameStyles.content) expect(glob.startsWith('./client/solitaire/')).toBe(true);
    for (const glob of siteStyles.content) {
      expect(glob === './client/index.html' || glob.startsWith('./client/src/')).toBe(true);
    }

    // the game's stylesheet names the game's config, the site's falls back to the default one
    const gameCss = readFileSync(join(GAME, 'solitaire.css'), 'utf-8');
    expect(gameCss).toContain('@config "../../tailwind.solitaire.config.ts";');
    expect(readFileSync(join(SITE, 'index.css'), 'utf-8')).not.toContain('@config');
  });
});
