import { describe, expect, test } from 'bun:test';
import {
  FROSTED_BAND_BELOW_STATUS,
  computeBoardLayout,
  longestColumnBottom,
  statusAreaHeight,
  statusBarHeightFor,
  topClearance,
} from './layout';

// iPhone screens in points: width, height, status area, home indicator
const IPHONES: [number, number, number, number][] = [
  [375, 667, 20, 0],
  [375, 812, 50, 34],
  [390, 844, 47, 34],
  [393, 852, 59, 34],
  [402, 874, 62, 34],
  [414, 896, 48, 34],
  [420, 912, 68, 34],
  [428, 926, 47, 34],
  [430, 932, 59, 34],
  [440, 956, 62, 34],
];

// The header: 4 pt above the buttons, 44 pt of buttons, 8 pt below
const HEADER = 56;
// What Safari's own bars take from the page when the game runs in a tab
const SAFARI_BARS = 100;

// Card width before the layout pass, for comparison
function oldCardWidth(viewportWidth: number): number {
  const gap = Math.max(5, Math.min(12, Math.round(viewportWidth * 0.018)));
  return Math.max(44, Math.min(60, Math.floor((viewportWidth - 24 - gap * 6) / 7)));
}

// The board area under the header, in each way the game is shown
const spaces = IPHONES.flatMap(([w, h, top, bottom]) => {
  const homeScreenHeader = top + FROSTED_BAND_BELOW_STATUS + HEADER;
  return [
    { name: `${w}x${h} home screen`, w, space: { width: w, height: h - homeScreenHeader, safeBottom: bottom } },
    // iOS 27.2 can give a Home Screen app a page that is one status area short
    { name: `${w}x${h} home screen, short page`, w, space: { width: w, height: h - top - homeScreenHeader, safeBottom: bottom } },
    { name: `${w}x${h} safari tab`, w, space: { width: w, height: h - top - HEADER - SAFARI_BARS, safeBottom: 0 } },
  ];
});

describe('board layout', () => {
  test('the longest possible column ends above the home indicator', () => {
    for (const { name, space } of spaces) {
      const layout = computeBoardLayout(space);
      expect({ name, fits: longestColumnBottom(layout) <= space.height - space.safeBottom })
        .toEqual({ name, fits: true });
    }
  });

  test('seven columns fit across', () => {
    for (const { name, space } of spaces) {
      const l = computeBoardLayout(space);
      expect({ name, fits: l.cardW * 7 + l.gap * 6 + l.padX * 2 <= space.width }).toEqual({ name, fits: true });
    }
  });

  test('cards are larger than before on every iPhone', () => {
    for (const { name, w, space } of spaces) {
      const layout = computeBoardLayout(space);
      expect({ name, larger: layout.cardW > oldCardWidth(w) }).toEqual({ name, larger: true });
    }
  });

  test('columns are fanned wider than before, so more of each card shows', () => {
    // 402 pt wide used to fan face-up cards by 19 pt
    const layout = computeBoardLayout({ width: 402, height: 874 - 62 - HEADER, safeBottom: 34 });
    expect(layout.fanUp).toBeGreaterThan(19);
    expect(layout.fanUp).toBeLessThanOrEqual(Math.round(layout.cardH * 0.4));
  });

  test('cards grow past 60 pt on a large screen, as far as the height allows', () => {
    const big = computeBoardLayout({ width: 1296, height: 760, safeBottom: 0 });
    expect(big.cardW).toBeGreaterThan(60);
    expect(longestColumnBottom(big)).toBeLessThanOrEqual(760);
  });

  test('a short window shrinks the cards instead of cutting the columns off', () => {
    const short = computeBoardLayout({ width: 900, height: 420, safeBottom: 0 });
    expect(longestColumnBottom(short)).toBeLessThanOrEqual(420);
  });

  test('the waste stays inside the empty third column', () => {
    for (const { space } of spaces) {
      const l = computeBoardLayout(space);
      expect(l.wasteOffset * 2).toBeLessThanOrEqual(l.cardW + l.gap);
    }
  });
});

describe('room for the status area', () => {
  const phone = { screenWidth: 402, screenHeight: 874, portrait: true, remembered: null, iosHomeScreen: true };
  const tab = { ...phone, standalone: false, iosHomeScreen: false };

  test('uses the inset the system reports', () => {
    expect(statusAreaHeight({ ...phone, envTop: 62, standalone: true, innerHeight: 874 })).toBe(62);
    expect(statusAreaHeight({ ...tab, envTop: 47, innerHeight: 700 })).toBe(47);
  });

  test('in a browser tab nothing sits above the page', () => {
    expect(statusAreaHeight({ ...tab, envTop: 0, innerHeight: 714 })).toBe(0);
    expect(topClearance({ ...tab, envTop: 0, innerHeight: 714 })).toBe(0);
  });

  test('home screen app under the status bar with no inset reported: still knows the bar', () => {
    expect(statusAreaHeight({ ...phone, envTop: 0, standalone: true, innerHeight: 874 })).toBe(62);
  });

  test('home screen app with the system band above the page: no status area in the page', () => {
    expect(statusAreaHeight({ ...phone, envTop: 0, standalone: true, innerHeight: 812 })).toBe(0);
  });

  test('prefers what this device reported before over the table', () => {
    expect(statusAreaHeight({ ...phone, envTop: 0, standalone: true, innerHeight: 874, remembered: 59 })).toBe(59);
  });

  test('no status bar to clear in landscape', () => {
    expect(topClearance({ ...phone, envTop: 0, standalone: true, innerHeight: 402, portrait: false })).toBe(0);
  });

  test('every listed iPhone is cleared by at least its status area', () => {
    for (const [w, h, top] of IPHONES) {
      if (`${w}x${h}` === '420x912') continue; // not in the table: covered by the default below
      expect(statusBarHeightFor(w, h)).toBe(top);
    }
    expect(statusBarHeightFor(420, 912)).toBeGreaterThanOrEqual(68);
    expect(statusBarHeightFor(912, 420)).toBeGreaterThanOrEqual(68);
  });
});

describe('the frosted band iOS lays over a home screen app', () => {
  const phone = { screenWidth: 402, screenHeight: 874, portrait: true, remembered: null };
  // Where the blur ends on iOS 27.2 with a 62 pt status area (measured)
  const BLUR_ENDS = 98;

  test('controls start below the band, in each state the system has been seen in', () => {
    const states = [
      { envTop: 62, innerHeight: 874 }, // page under the bar, inset reported
      { envTop: 62, innerHeight: 812 }, // the same with a short page (iOS 27.2 simulator)
      { envTop: 0, innerHeight: 874 }, // page under the bar, no inset reported
    ];
    for (const state of states) {
      const top = topClearance({ ...phone, ...state, standalone: true, iosHomeScreen: true });
      expect({ state, clear: top >= BLUR_ENDS }).toEqual({ state, clear: true });
    }
  });

  test('with the system band above the page, the fade below it is still cleared', () => {
    const top = topClearance({ ...phone, envTop: 0, innerHeight: 812, standalone: true, iosHomeScreen: true });
    expect(top).toBe(FROSTED_BAND_BELOW_STATUS);
  });

  test('no band outside an iOS home screen app', () => {
    expect(topClearance({ ...phone, envTop: 62, innerHeight: 874, standalone: true, iosHomeScreen: false })).toBe(62);
    expect(topClearance({ ...phone, envTop: 0, innerHeight: 714, standalone: false, iosHomeScreen: false })).toBe(0);
  });
});
