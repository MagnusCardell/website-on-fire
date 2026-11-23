// Decides which pile a dragged card is being dropped on.
// Pure geometry, so it can be tested without a browser.

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface DropTarget {
  pile: 'foundation' | 'tableau';
  index: number;
}

export interface PileBox {
  id: string; // "tableau-3", "foundation-0", ...
  box: Box;
}

export interface DropQuery {
  dragged: Box; // where the lead card is right now
  pointer: { x: number; y: number };
  pointerType: string;
  piles: PileBox[]; // where the piles are, measured for this drag
  allowed: DropTarget[]; // piles the rules accept this card on
}

function expand(b: Box, pad: number, padBottomExtra = 0): Box {
  return {
    left: b.left - pad,
    top: b.top - pad,
    width: b.width + pad * 2,
    height: b.height + pad * 2 + padBottomExtra,
  };
}

function center(b: Box) {
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function overlapArea(a: Box, b: Box): number {
  const x = Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left));
  const y = Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));
  return x * y;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

// Where a dropped card would come to rest on a pile
function landingBox(pile: 'foundation' | 'tableau', pileBox: Box, cardW: number, cardH: number): Box {
  if (pile === 'foundation') {
    // Entire pile is the target
    return pileBox;
  }

  // Tableau: target the bottom "slot" where a drop would land.
  // Use card size; keep width aligned to pile column.
  const w = Math.min(pileBox.width, cardW);
  return {
    left: pileBox.left + (pileBox.width - w) / 2,
    top: pileBox.top + pileBox.height - cardH,
    width: w,
    height: cardH,
  };
}

export function parsePileId(id: string): DropTarget | null {
  const [pile, indexStr] = id.split('-');
  if (pile !== 'foundation' && pile !== 'tableau') return null;
  const index = Number.parseInt(indexStr, 10);
  return Number.isFinite(index) ? { pile, index } : null;
}

export function pickDropTarget({ dragged, pointer, pointerType, piles, allowed }: DropQuery): DropTarget | null {
  const cardArea = dragged.width * dragged.height;
  if (!Number.isFinite(cardArea) || cardArea <= 0) return null;
  if (allowed.length === 0) return null;

  const touch = pointerType === 'touch';
  const pad = touch ? 18 : 10;
  const cardW = dragged.width;
  const draggedCenter = center(dragged);

  let best: DropTarget | null = null;
  let bestScore = -Infinity;

  for (const { id, box } of piles) {
    const target = parsePileId(id);
    if (!target) continue;
    if (!allowed.some((t) => t.pile === target.pile && t.index === target.index)) continue;

    // Expand pile rect for magnetism
    const magnet = target.pile === 'tableau' ? expand(box, pad, 34) : expand(box, pad);

    // Compute landing zone and expand it a bit too (finger-friendly)
    const landing = expand(landingBox(target.pile, magnet, cardW, dragged.height), touch ? 14 : 8);

    const overlapNorm = overlapArea(dragged, landing) / cardArea; // ~0..1

    // Distance from dragged card center to landing zone center
    const landCenter = center(landing);
    const distNorm = clamp(dist(draggedCenter, landCenter) / (cardW * 1.2), 0, 1);

    // Distance from pointer to landing zone center (very important on touch)
    const pointerNorm = clamp(dist(pointer, landCenter) / (cardW * 1.1), 0, 1);

    // Score: overlap matters, but proximity matters more for perceived intent
    let score = overlapNorm * 0.9 + (1 - distNorm) * 0.65 + (1 - pointerNorm) * 0.85;

    // Small contextual bias
    score += target.pile === 'foundation' ? 0.06 : 0.04;

    // Discourage very far targets even with expanded rects
    if (pointerNorm > 0.98 && overlapNorm < 0.01) score -= 0.25;

    if (score > bestScore) {
      bestScore = score;
      best = target;
    }
  }

  // Acceptance threshold
  return bestScore < (touch ? 0.32 : 0.36) ? null : best;
}
