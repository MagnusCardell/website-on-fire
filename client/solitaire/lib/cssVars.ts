/**
 * Read a CSS custom property as a pixel value.
 * @param name - CSS variable name (e.g., '--sol-card-w')
 * @param fallback - Fallback value if variable is not set or invalid
 * @returns The numeric pixel value
 */
export function readCssPx(name: string, fallback: number): number {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }