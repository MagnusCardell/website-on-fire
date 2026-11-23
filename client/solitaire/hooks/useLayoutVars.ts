import { useLayoutEffect } from 'react';
import { computeBoardLayout, topClearance } from '../layout';

const SAFE_TOP_KEY = 'solitaire.safeTop';
// Header height without the status area: 4 px above the buttons, 44 px of buttons, 8 px below
const HEADER_CONTENT_HEIGHT = 56;

// Home Screen app on an iPhone or iPad
function isIosHomeScreen(): boolean {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isStandalone(): boolean {
  return isIosHomeScreen() || window.matchMedia?.('(display-mode: standalone)')?.matches === true;
}

function readRemembered(): number | null {
  try {
    const value = Number.parseFloat(window.localStorage.getItem(SAFE_TOP_KEY) ?? '');
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function remember(value: number) {
  try {
    window.localStorage.setItem(SAFE_TOP_KEY, String(value));
  } catch {
    // Private mode: the table of known devices still applies
  }
}

// Measures the page and publishes the layout as CSS variables on :root.
// `board` is the element the game board fills (the area under the header).
export function useLayoutVars(board: HTMLElement | null) {
  useLayoutEffect(() => {
    const root = document.documentElement;

    // The safe-area insets exist only in CSS, so a hidden element carries them
    // into a place script can read. Read on layout changes, never while rendering.
    const probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);';
    document.body.appendChild(probe);

    const apply = () => {
      const probeStyle = getComputedStyle(probe);
      const envTop = Number.parseFloat(probeStyle.paddingTop) || 0;
      const envBottom = Number.parseFloat(probeStyle.paddingBottom) || 0;
      const standalone = isStandalone();
      const portrait = window.innerHeight >= window.innerWidth;

      if (envTop > 0 && standalone && portrait) remember(envTop);

      const safeTop = topClearance({
        envTop,
        standalone,
        iosHomeScreen: isIosHomeScreen(),
        portrait,
        innerHeight: window.innerHeight,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        remembered: readRemembered(),
      });

      const width = board?.clientWidth || window.innerWidth;
      const height = board?.clientHeight || window.innerHeight - safeTop - HEADER_CONTENT_HEIGHT;
      const layout = computeBoardLayout({ width, height, safeBottom: envBottom });

      root.style.setProperty('--sol-safe-top', `${safeTop}px`);
      root.style.setProperty('--sol-card-w', `${layout.cardW}px`);
      root.style.setProperty('--sol-card-h', `${layout.cardH}px`);
      root.style.setProperty('--sol-gap', `${layout.gap}px`);
      root.style.setProperty('--sol-pad-x', `${layout.padX}px`);
      root.style.setProperty('--sol-pad-top', `${layout.padTop}px`);
      root.style.setProperty('--sol-row-gap', `${layout.rowGap}px`);
      root.style.setProperty('--sol-waste-offset', `${layout.wasteOffset}px`);
      root.style.setProperty('--sol-fan-up', `${layout.fanUp}px`);
      root.style.setProperty('--sol-fan-down', `${layout.fanDown}px`);
    };

    apply();

    // The board area changes size when the header does, or the window
    const observer = board && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null;
    if (board) observer?.observe(board);

    // iOS can change how it lays a Home Screen app out while it is in the
    // background, so look again every time the app comes back
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    window.addEventListener('pageshow', apply);
    document.addEventListener('visibilitychange', apply);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
      window.removeEventListener('pageshow', apply);
      document.removeEventListener('visibilitychange', apply);
      probe.remove();
    };
  }, [board]);
}
