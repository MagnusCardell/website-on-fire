import { useState, useCallback, useEffect, useRef } from 'react';
import { pickDropTarget, type DropTarget, type PileBox } from './dropTarget';

type DragSource = 'waste' | 'tableau' | 'foundation';

// What React needs to know about a drag: which cards, and where they started.
// The position while dragging never goes through React; see moveOverlay.
export interface DragState {
  cardIds: string[];
  fromPile: DragSource;
  fromIndex: number;
  originX: number;
  originY: number;
}

interface UsePointerOptions {
  onDragStart?: (cardId: string, fromPile: DragSource, fromIndex: number) => string[];
  onDragEnd?: (drag: DragState, dropTarget: DropTarget | null) => void;
  onTap?: (cardId: string, fromPile: DragSource | 'stock', fromIndex: number) => void;
  onDoubleTap?: (cardId: string, fromPile: 'waste' | 'tableau', fromIndex: number) => void;
  getValidDropTargets?: (cardId: string) => DropTarget[];
}

// One press, from finger down to finger up
interface Press {
  pointerId: number;
  cardId: string;
  fromPile: DragSource;
  fromIndex: number;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  // The pressed card's box at finger down
  originX: number;
  originY: number;
  cardW: number;
  cardH: number;
  // Set once the finger has travelled far enough to mean a drag
  drag: DragState | null;
  targets: DropTarget[];
  piles: PileBox[];
}

const DRAG_THRESHOLD_PX = 10;
const DOUBLE_TAP_MS = 400;

// Where every pile is on screen right now
function measurePiles(): PileBox[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-pile-id]')).map((el) => {
    const r = el.getBoundingClientRect();
    return {
      id: el.dataset.pileId ?? '',
      box: { left: r.left, top: r.top, width: r.width, height: r.height },
    };
  });
}

export function usePointer(options: UsePointerOptions) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const pressRef = useRef<Press | null>(null);
  const overlayRef = useRef<HTMLElement | null>(null);
  const lastTapRef = useRef<{ cardId: string; time: number } | null>(null);

  // The dragged cards follow the finger by a transform written straight to the
  // overlay element, so a move costs no render at all.
  const moveOverlay = useCallback(() => {
    const press = pressRef.current;
    const el = overlayRef.current;
    if (!press || !el) return;
    el.style.transform = `translate3d(${press.dx}px, ${press.dy}px, 0) scale(1.05)`;
  }, []);

  const setOverlayElement = useCallback((el: HTMLElement | null) => {
    overlayRef.current = el;
    moveOverlay();
  }, [moveOverlay]);

  const endPress = useCallback(() => {
    pressRef.current = null;
    setDrag(null);
  }, []);

  // The pressed card holds the pointer (Card captures it), so its own handlers
  // see the release wherever the finger ends up. If the card loses the pointer
  // anyway (it left the page mid-press), the release would go unseen and every
  // later press would be refused. The window hears every release, after the
  // card's handlers have run; a press still open by then is ended here.
  useEffect(() => {
    const release = (e: PointerEvent) => {
      const press = pressRef.current;
      if (!press || e.pointerId !== press.pointerId) return;

      endPress();
      if (press.drag) {
        optionsRef.current.onDragEnd?.(press.drag, null);
      }
    };

    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [endPress]);

  const handlePointerDown = useCallback((
    e: React.PointerEvent,
    cardId: string,
    fromPile: DragSource,
    fromIndex: number
  ) => {
    // One finger at a time: a second touch must not take over the first
    if (pressRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    pressRef.current = {
      pointerId: e.pointerId,
      cardId,
      fromPile,
      fromIndex,
      startX: e.clientX,
      startY: e.clientY,
      dx: 0,
      dy: 0,
      originX: rect.left,
      originY: rect.top,
      cardW: rect.width,
      cardH: rect.height,
      drag: null,
      targets: [],
      piles: [],
    };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const press = pressRef.current;
    if (!press || e.pointerId !== press.pointerId) return;

    press.dx = e.clientX - press.startX;
    press.dy = e.clientY - press.startY;

    if (!press.drag) {
      if (Math.hypot(press.dx, press.dy) <= DRAG_THRESHOLD_PX) return;

      // The press has become a drag. Read the board once, for this drag.
      const { onDragStart, getValidDropTargets } = optionsRef.current;
      const cardIds = onDragStart?.(press.cardId, press.fromPile, press.fromIndex) ?? [press.cardId];
      press.drag = {
        cardIds: cardIds.length > 0 ? cardIds : [press.cardId],
        fromPile: press.fromPile,
        fromIndex: press.fromIndex,
        originX: press.originX,
        originY: press.originY,
      };
      press.targets = getValidDropTargets?.(press.cardId) ?? [];
      press.piles = measurePiles();
      setDrag(press.drag);
    }

    moveOverlay();
  }, [moveOverlay]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const press = pressRef.current;
    if (!press || e.pointerId !== press.pointerId) return;

    const { onTap, onDoubleTap, onDragEnd } = optionsRef.current;

    if (press.drag) {
      const dropTarget = pickDropTarget({
        dragged: {
          left: press.originX + press.dx,
          top: press.originY + press.dy,
          width: press.cardW,
          height: press.cardH,
        },
        pointer: { x: e.clientX, y: e.clientY },
        pointerType: e.pointerType,
        piles: press.piles,
        allowed: press.targets,
      });
      endPress();
      onDragEnd?.(press.drag, dropTarget);
      return;
    }

    // The finger never left the card: a tap, however long it rested there
    endPress();
    const now = Date.now();
    const last = lastTapRef.current;
    if (
      last &&
      last.cardId === press.cardId &&
      now - last.time < DOUBLE_TAP_MS &&
      press.fromPile !== 'foundation'
    ) {
      lastTapRef.current = null;
      onDoubleTap?.(press.cardId, press.fromPile, press.fromIndex);
    } else {
      lastTapRef.current = { cardId: press.cardId, time: now };
      onTap?.(press.cardId, press.fromPile, press.fromIndex);
    }
  }, [endPress]);

  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    const press = pressRef.current;
    if (!press || e.pointerId !== press.pointerId) return;

    endPress();
    if (press.drag) {
      optionsRef.current.onDragEnd?.(press.drag, null);
    }
  }, [endPress]);

  return {
    drag,
    setOverlayElement,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
  };
}
