import { describe, expect, test } from 'bun:test';
import { SOLVABLE_SEEDS, getDailySeed, getKey, getLegacyDailySeed } from './solvableSeeds';

describe('daily deals', () => {
  const days = (from: Date, count: number) =>
    Array.from({ length: count }, (_, i) => {
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      return getKey(d);
    });

  test('the list holds 384 different seeds', () => {
    expect(SOLVABLE_SEEDS.length).toBe(384);
    expect(new Set(SOLVABLE_SEEDS).size).toBe(384);
  });

  test('every day gets a seed from the list', () => {
    const list = new Set(SOLVABLE_SEEDS);
    for (const key of days(new Date(2026, 0, 1), 6 * 366)) {
      expect(list.has(getDailySeed(key))).toBe(true);
    }
  });

  test('no deal repeats within 384 consecutive days', () => {
    const seeds = days(new Date(2026, 0, 1), 6 * 366).map(getDailySeed);
    const lastSeen = new Map<number, number>();
    seeds.forEach((seed, i) => {
      const before = lastSeen.get(seed);
      if (before !== undefined) expect(i - before).toBeGreaterThanOrEqual(384);
      lastSeen.set(seed, i);
    });
  });

  test('the old mapping is still available for games saved before the change', () => {
    expect(getLegacyDailySeed('2026-11-23')).toBe(7778697835);
  });
});
