import { describe, expect, test } from 'bun:test';
import { parsePileId, pickDropTarget, type PileBox } from './dropTarget';

// A 402 pt wide phone: 48 pt cards, 7 pt gaps, 12 pt side padding
const CARD_W = 48, CARD_H = 67, GAP = 7, PAD = 12;
const column = (i: number) => PAD + i * (CARD_W + GAP);

const piles: PileBox[] = [
  ...[0, 1, 2, 3].map((i) => ({
    id: `foundation-${i}`,
    box: { left: column(3 + i), top: 85, width: CARD_W, height: CARD_H },
  })),
  ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({
    id: `tableau-${i}`,
    box: { left: column(i), top: 174, width: CARD_W, height: CARD_H + i * 8 },
  })),
  { id: 'stock-0', box: { left: column(0), top: 85, width: CARD_W, height: CARD_H } },
];

const dropAt = (x: number, y: number, allowed: { pile: 'foundation' | 'tableau'; index: number }[], pointerType = 'touch') =>
  pickDropTarget({
    dragged: { left: x - CARD_W / 2, top: y - CARD_H / 2, width: CARD_W, height: CARD_H },
    pointer: { x, y },
    pointerType,
    piles,
    allowed,
  });

const all = [
  ...[0, 1, 2, 3].map((index) => ({ pile: 'foundation' as const, index })),
  ...[0, 1, 2, 3, 4, 5, 6].map((index) => ({ pile: 'tableau' as const, index })),
];

describe('pickDropTarget', () => {
  test('a card released over a pile lands on that pile', () => {
    for (let i = 0; i < 7; i++) {
      const box = piles.find((p) => p.id === `tableau-${i}`)!.box;
      expect(dropAt(box.left + CARD_W / 2, box.top + box.height, all)).toEqual({ pile: 'tableau', index: i });
    }
    for (let i = 0; i < 4; i++) {
      expect(dropAt(column(3 + i) + CARD_W / 2, 85 + CARD_H / 2, all)).toEqual({ pile: 'foundation', index: i });
    }
  });

  test('only piles the rules allow are considered', () => {
    const box = piles.find((p) => p.id === 'tableau-2')!.box;
    const x = box.left + CARD_W / 2, y = box.top + box.height;
    // right on pile 2, which the rules do not allow: never pile 2
    expect(dropAt(x, y, [{ pile: 'tableau', index: 5 }])).toBeNull();
    expect(dropAt(x, y, [])).toBeNull();
    // between piles 2 and 3 with only 3 allowed: pile 3
    expect(dropAt(x + 30, y, [{ pile: 'tableau', index: 3 }])).toEqual({ pile: 'tableau', index: 3 });
  });

  test('a release far from every allowed pile is no drop', () => {
    expect(dropAt(200, 700, all)).toBeNull();
    expect(dropAt(column(0) + CARD_W / 2, 500, [{ pile: 'tableau', index: 6 }])).toBeNull();
  });

  test('a near miss still lands, and a finger gets more room than a mouse', () => {
    const box = piles.find((p) => p.id === 'tableau-4')!.box;
    const x = box.left + CARD_W / 2, y = box.top + box.height;
    expect(dropAt(x + 20, y + 30, [{ pile: 'tableau', index: 4 }])).toEqual({ pile: 'tableau', index: 4 });
    expect(dropAt(x, y + 78, [{ pile: 'tableau', index: 4 }], 'touch')).toEqual({ pile: 'tableau', index: 4 });
    expect(dropAt(x, y + 78, [{ pile: 'tableau', index: 4 }], 'mouse')).toBeNull();
  });

  test('pile ids', () => {
    expect(parsePileId('tableau-6')).toEqual({ pile: 'tableau', index: 6 });
    expect(parsePileId('foundation-0')).toEqual({ pile: 'foundation', index: 0 });
    expect(parsePileId('stock-0')).toBeNull();
    expect(parsePileId('waste-0')).toBeNull();
  });
});
