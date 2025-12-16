import { useEffect } from 'react';

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function useLayoutVars() {
  useEffect(() => {
    const apply = () => {
      const vw = window.innerWidth;

      // conservative padding inside the board (not the whole page)
      const padX = 12;
      const gap = clamp(Math.round(vw * 0.018), 5, 12);

      // 7 tableau piles must fit
      const wTableau = (vw - padX * 2 - gap * 6) / 7;

      // Top row: stock (1 col) + waste (1 col, but spills into col3) + foundations (cols 4-7)
      // We will leave column 3 empty and allow waste to overflow into it.
      // Constraint: waste spread must not go beyond (col2 + gap + col3).
      // So max offset must satisfy 2*offset <= cardW + gap.
      // We'll pick offset ~ 0.32*cardW, but clamp to fit.
      let cardW = clamp(Math.floor(wTableau), 44, 60);

      let wasteOffset = clamp(Math.round(cardW * 0.32), 10, 18);
      wasteOffset = Math.min(wasteOffset, Math.floor((cardW + gap) / 2)); // ensure stays within col3

      const cardH = Math.round(cardW * 1.4);

      const fanUp = clamp(Math.round(cardH * 0.28), 14, 24);
      const fanDown = clamp(Math.round(cardH * 0.10), 6, 10);

      const root = document.documentElement;
      root.style.setProperty("--sol-card-w", `${cardW}px`);
      root.style.setProperty("--sol-card-h", `${cardH}px`);
      root.style.setProperty("--sol-gap", `${gap}px`);
      root.style.setProperty("--sol-pad-x", `${padX}px`);
      root.style.setProperty("--sol-waste-offset", `${wasteOffset}px`);
      root.style.setProperty("--sol-fan-up", `${fanUp}px`);
      root.style.setProperty("--sol-fan-down", `${fanDown}px`);
    };

    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);
}
