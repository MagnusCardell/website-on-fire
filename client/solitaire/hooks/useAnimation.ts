import { useCallback, useRef } from 'react';

export function useAnimation() {
  const isAnimatingRef = useRef(false);

  // Animate a spring-back for invalid drops
  const animateSpringBack = useCallback(async (
    cardIds: string[],
    startX: number,
    startY: number
  ) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    isAnimatingRef.current = true;

    const animations = cardIds.map((cardId, index) => {
      const element = document.querySelector(`[data-card-id="${cardId}"]`) as HTMLElement;
      if (!element) return Promise.resolve();

      const rect = element.getBoundingClientRect();
      const deltaX = startX - rect.left;
      const deltaY = startY - rect.top + (index * 24);

      return new Promise<void>(resolve => {
        const animation = element.animate(
          [
            { transform: `translate(${deltaX}px, ${deltaY}px)` },
            { transform: 'translate(0, 0)' },
          ],
          {
            duration: 150,
            easing: 'cubic-bezier(0.34, 1.2, 0.64, 1)',
          }
        );

        animation.onfinish = () => resolve();
        animation.oncancel = () => resolve();
      });
    });

    await Promise.all(animations);
    isAnimatingRef.current = false;
  }, []);

  return {
    animateSpringBack,
    isAnimating: () => isAnimatingRef.current,
  };
}
