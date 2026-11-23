// Sizes for the board, worked out from the space it has, and how much room
// the system's status area needs above the header. Pure functions: the hook in
// hooks/useLayoutVars.ts measures the page and applies what these return.

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ---------------------------------------------------------------- the board

export interface BoardSpace {
  // The area under the header, in CSS pixels
  width: number;
  height: number;
  // Height of the home indicator area at the bottom
  safeBottom: number;
}

export interface BoardLayout {
  cardW: number;
  cardH: number;
  gap: number;
  padX: number;
  padTop: number;
  rowGap: number;
  fanUp: number;
  fanDown: number;
  wasteOffset: number;
}

const CARD_RATIO = 1.4;
// Room between the header and the top row; the autocomplete button lives here
export const PAD_TOP = 52;
const ROW_GAP = 12;
const PAD_BOTTOM = 8;
// The stock pile is drawn a little taller than a card, for its depth effect
const STOCK_DEPTH = 10;
// How much of a card shows under the next one, as a share of card height
const FAN_DOWN = 0.12;
const FAN_UP = 0.4;
// The tightest face-up fan that still shows rank and suit
const FAN_UP_MIN = 0.24;
// The longest column the game can produce: 6 face-down cards under 13 face-up
const LONGEST_FACE_DOWN = 6;
const LONGEST_FACE_UP_FANS = 12;

export function computeBoardLayout({ width, height, safeBottom }: BoardSpace): BoardLayout {
  const padX = width < 500 ? 6 : 12;
  const gap = clamp(Math.round(width * 0.012), 4, 12);

  // Seven columns across
  const widthFit = Math.floor((width - padX * 2 - gap * 6) / 7);

  // Down the screen: the top row, then the longest column at its tightest fan
  const room = height - PAD_TOP - ROW_GAP - PAD_BOTTOM - safeBottom - STOCK_DEPTH;
  const cardsTall = 2 + LONGEST_FACE_DOWN * FAN_DOWN + LONGEST_FACE_UP_FANS * FAN_UP_MIN;
  const heightFit = Math.floor(room / cardsTall / CARD_RATIO);

  const cardW = clamp(Math.min(widthFit, heightFit), 24, 110);
  const cardH = Math.round(cardW * CARD_RATIO);

  // Spread the columns as far as the room allows, so each card shows more of
  // itself and is easier to touch, but never so far that the longest runs off
  const fanDown = Math.max(3, Math.round(cardH * FAN_DOWN));
  const fanFit = Math.floor((room - cardH * 2 - fanDown * LONGEST_FACE_DOWN) / LONGEST_FACE_UP_FANS);
  const fanUp = Math.max(4, Math.min(Math.round(cardH * FAN_UP), fanFit));

  // The waste shows three cards side by side and may spill into the empty
  // third column, but not past it
  const wasteOffset = Math.min(clamp(Math.round(cardW * 0.34), 10, 40), Math.floor((cardW + gap) / 2));

  return { cardW, cardH, gap, padX, padTop: PAD_TOP, rowGap: ROW_GAP, fanUp, fanDown, wasteOffset };
}

// Where the longest possible column ends, measured from the top of the board area
export function longestColumnBottom(layout: BoardLayout): number {
  return (
    layout.padTop + layout.cardH + STOCK_DEPTH + layout.rowGap +
    layout.cardH + layout.fanDown * LONGEST_FACE_DOWN + layout.fanUp * LONGEST_FACE_UP_FANS
  );
}

// ------------------------------------------------- room for the status area

export interface TopInsetInput {
  // What CSS reports for env(safe-area-inset-top)
  envTop: number;
  // Running as an app from the Home Screen
  standalone: boolean;
  // ... on an iPhone or iPad (navigator.standalone)
  iosHomeScreen: boolean;
  portrait: boolean;
  innerHeight: number;
  screenWidth: number;
  screenHeight: number;
  // A top inset this device reported earlier, if any
  remembered: number | null;
}

// Status bar heights by screen size (points), for when the system does not say
const STATUS_BAR_HEIGHT: Record<string, number> = {
  '440x956': 62,
  '402x874': 62,
  '430x932': 59,
  '393x852': 59,
  '428x926': 47,
  '390x844': 47,
  '414x896': 48,
  '375x812': 50,
  '414x736': 20,
  '375x667': 20,
  '320x568': 20,
};

export function statusBarHeightFor(screenWidth: number, screenHeight: number): number {
  const w = Math.min(screenWidth, screenHeight);
  const h = Math.max(screenWidth, screenHeight);
  const known = STATUS_BAR_HEIGHT[`${w}x${h}`];
  if (known !== undefined) return known;
  // Unknown device: tall screens have a sensor housing, short ones a plain bar.
  // Too much room costs a few points of green; too little hides the buttons.
  return h >= 780 ? 68 : 20;
}

// Since iOS 26.1 the system lays a frosted band over the top of a Home Screen
// app: everything behind the status area is blurred out, and the blur fades
// away below it. The page cannot switch it off (WebKit bug 301994). Measured
// on iOS 27.2 with a 62 pt status area: a stripe pattern is 10% sharp at
// 66 pt, 51% at 84 pt, 97% at 96 pt and untouched from 100 pt.
// Controls placed in that fade look out of focus, so they start below it.
//
// That one measurement can be read two ways: the fade is 36 pt deep under
// whatever status area the phone has, or the band ends 98 pt from the top of
// the screen. Phones with a sensor housing get the larger of the two; a few
// points of extra header cost nothing, a header in the blur is the bug.
export const FROSTED_BAND_BELOW_STATUS = 36;
export const FROSTED_BAND_END = 98;
// Status areas at least this tall belong to phones with a sensor housing
const HOUSING_STATUS_AREA = 44;

// How much of the page's top belongs to the system's status area.
//
// Normally that is env(safe-area-inset-top). On iOS 26.1 and again on iOS 27
// (the same WebKit bug) a Home Screen app can be laid out under the status bar
// while that inset reads 0. That state is recognisable: the page is as tall as
// the whole screen and yet reports no inset.
export function statusAreaHeight(input: TopInsetInput): number {
  if (input.envTop > 0) return input.envTop;
  if (!input.standalone || !input.portrait) return 0;

  const pageCoversScreen = input.innerHeight >= input.screenHeight - 1;
  if (!pageCoversScreen) return 0; // the system keeps its own band above the page

  return input.remembered ?? statusBarHeightFor(input.screenWidth, input.screenHeight);
}

// How far the header's controls must stay from the top of the page: clear of
// the status area and, in an iOS Home Screen app, of the frosted band under it.
export function topClearance(input: TopInsetInput): number {
  const statusArea = statusAreaHeight(input);
  if (!input.iosHomeScreen || !input.portrait) return statusArea;

  // Where the page begins on the screen: at the very top, under the status
  // bar, or below a band the system keeps for itself
  const pageTop = statusArea > 0 ? 0 : Math.max(0, input.screenHeight - input.innerHeight);
  const statusBottom = pageTop + statusArea;

  let bandEnd = statusBottom + FROSTED_BAND_BELOW_STATUS;
  if (statusBottom >= HOUSING_STATUS_AREA) bandEnd = Math.max(bandEnd, FROSTED_BAND_END);

  return bandEnd - pageTop;
}
