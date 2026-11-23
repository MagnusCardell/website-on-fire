import { describe, expect, test } from 'bun:test';
import { createNewGame } from './game';
import { applyMove, getLegalMoves, undoMove } from './rules';
import type { GameState, Move } from './types';

const board = (g: GameState) =>
  JSON.stringify({ s: g.stock, w: g.waste, f: g.foundations, t: g.tableau });

function seededRandom(seed: number) {
  let x = seed;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

describe('deal', () => {
  test('a seed always gives the same deal', () => {
    const g = createNewGame(12345);
    expect(g.tableau.map((p) => p[p.length - 1].id)).toEqual([
      '7-diamonds', '5-hearts', 'K-diamonds', '7-hearts', 'A-clubs', 'J-diamonds', '4-spades',
    ]);
    expect(g.tableau[6].map((c) => c.id)).toEqual([
      'Q-hearts', '3-hearts', 'Q-diamonds', '6-diamonds', '8-clubs', '10-hearts', '4-spades',
    ]);
    expect(g.stock.slice(-3).map((c) => c.id)).toEqual(['6-clubs', '3-diamonds', '9-clubs']);
  });
});

describe('applyMove', () => {
  test('a move for a card that is not on the pile changes nothing', () => {
    const g = createNewGame(5);
    const ghost: Move = {
      type: 'tableau-to-tableau',
      from: { pile: 'tableau', index: 6 },
      to: { pile: 'tableau', index: 0 },
      cardIds: ['not-on-this-pile'],
    };
    expect(applyMove(g, ghost)).toBe(g);
  });

  test('a waste move with an empty waste changes nothing', () => {
    const g = createNewGame(5);
    const move: Move = {
      type: 'waste-to-tableau',
      from: { pile: 'waste', index: 0 },
      to: { pile: 'tableau', index: 0 },
      cardIds: ['x'],
    };
    expect(applyMove(g, move)).toBe(g);
  });

  test('a move the rules do not allow changes nothing', () => {
    const g = createNewGame(5);
    const top = g.tableau[6][g.tableau[6].length - 1];
    const legalTargets = getLegalMoves(g)
      .filter((m) => m.cardIds[0] === top.id && m.to.pile === 'tableau')
      .map((m) => m.to.index);
    const illegalTarget = [0, 1, 2, 3, 4, 5].find((i) => !legalTargets.includes(i))!;
    const move: Move = {
      type: 'tableau-to-tableau',
      from: { pile: 'tableau', index: 6 },
      to: { pile: 'tableau', index: illegalTarget },
      cardIds: [top.id],
    };
    expect(applyMove(g, move)).toBe(g);
  });

  test('a move from an earlier board does not apply to a later one', () => {
    const g = createNewGame(5);
    const draw = getLegalMoves(g).find((m) => m.type === 'draw')!;
    const afterDraw = applyMove(g, draw);
    const wasteMove = getLegalMoves(afterDraw).find((m) => m.from.pile === 'waste');
    if (wasteMove) expect(applyMove(g, wasteMove)).toBe(g);
    expect(afterDraw.waste.length).toBe(3);
    expect(afterDraw.moveCount).toBe(1);
  });

  test('random play keeps all 52 cards and undoes back to the deal', () => {
    const random = seededRandom(42);
    let moves = 0;
    for (let n = 0; n < 150; n++) {
      let g = createNewGame(1000 + n * 7919);
      const trail = [board(g)];
      for (let i = 0; i < 300 && g.gameStatus === 'playing'; i++) {
        const legal = getLegalMoves(g);
        if (legal.length === 0) break;
        g = applyMove(g, legal[Math.floor(random() * legal.length)]);
        moves++;
        trail.push(board(g));
        const ids = new Set(
          [...g.stock, ...g.waste, ...g.foundations.flat(), ...g.tableau.flat()].map((c) => c.id),
        );
        expect(ids.size).toBe(52);
      }
      for (let i = trail.length - 2; i >= 0; i--) {
        const undone = undoMove(g);
        expect(undone).not.toBeNull();
        g = undone!;
        expect(board(g)).toBe(trail[i]);
      }
    }
    expect(moves).toBeGreaterThan(30000);
  });
});
