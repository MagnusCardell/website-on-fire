import { useState, useCallback, useRef } from 'react';

export interface DragState {
  cardIds: string[];
  fromPile: 'waste' | 'tableau';
  fromIndex: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  offsetX: number;
  offsetY: number;
}

interface UsePointerOptions {
  onDragStart?: (cardId: string, fromPile: 'waste' | 'tableau', fromIndex: number) => string[];
  onDragEnd?: (drag: DragState, dropTarget: { pile: 'foundation' | 'tableau'; index: number } | null) => void;
  onTap?: (cardId: string, fromPile: 'waste' | 'tableau' | 'stock', fromIndex: number) => void;
  onDoubleTap?: (cardId: string, fromPile: 'waste' | 'tableau', fromIndex: number) => void;
  getValidDropTargets?: (cardId: string) => { pile: 'foundation' | 'tableau'; index: number }[];
}

// Track pile element positions for hit testing
const pileRects = new Map<string, DOMRect>();

export function registerPile(pileId: string, element: HTMLElement | null) {
  if (element) {
    pileRects.set(pileId, element.getBoundingClientRect());
  } else {
    pileRects.delete(pileId);
  }
}

export function updatePileRects() {
  document.querySelectorAll('[data-pile-id]').forEach((el) => {
    const pileId = el.getAttribute('data-pile-id');
    if (pileId) {
      pileRects.set(pileId, el.getBoundingClientRect());
    }
  });
}

// Calculate overlap area between two rectangles
function getOverlapArea(rect1: DOMRect, rect2: DOMRect): number {
  const xOverlap = Math.max(0, Math.min(rect1.right, rect2.right) - Math.max(rect1.left, rect2.left));
  const yOverlap = Math.max(0, Math.min(rect1.bottom, rect2.bottom) - Math.max(rect1.top, rect2.top));
  return xOverlap * yOverlap;
}

export function usePointer(options: UsePointerOptions) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [validTargets, setValidTargets] = useState<{ pile: 'foundation' | 'tableau'; index: number }[]>([]);
  const dragRef = useRef<DragState | null>(null);
  const isDraggingRef = useRef(false);
  const tapStartTimeRef = useRef(0);
  const tapStartPosRef = useRef({ x: 0, y: 0 });
  const dragElementRef = useRef<HTMLElement | null>(null);
  const lastTapRef = useRef<{ cardId: string; time: number } | null>(null);

  // Hit test using card overlap instead of pointer position
  const hitTestByOverlap = useCallback((draggedCardRect: DOMRect): { pile: 'foundation' | 'tableau'; index: number } | null => {
    updatePileRects();
    
    let bestTarget: { pile: 'foundation' | 'tableau'; index: number } | null = null;
    let maxOverlap = 0;
    
    for (const [pileId, pileRect] of pileRects.entries()) {
      const [pileType, indexStr] = pileId.split('-');
      if (pileType !== 'foundation' && pileType !== 'tableau') continue;
      
      const overlap = getOverlapArea(draggedCardRect, pileRect);
      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        bestTarget = { pile: pileType as 'foundation' | 'tableau', index: parseInt(indexStr, 10) };
      }
    }
    
    // Require minimum overlap (at least 20% of card area)
    const cardArea = draggedCardRect.width * draggedCardRect.height;
    if (maxOverlap < cardArea * 0.2) {
      return null;
    }
    
    return bestTarget;
  }, []);

  const handlePointerDown = useCallback((
    e: React.PointerEvent,
    cardId: string,
    fromPile: 'waste' | 'tableau' | 'stock',
    fromIndex: number
  ) => {
    // Stock cards are just tapped, not dragged
    if (fromPile === 'stock') {
      options.onTap?.(cardId, fromPile, fromIndex);
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    dragElementRef.current = target;
    
    tapStartTimeRef.current = Date.now();
    tapStartPosRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
    
    // Get cards to drag
    const cardIds = options.onDragStart?.(cardId, fromPile, fromIndex) ?? [cardId];
    
    // Get card position for offset calculation
    const rect = target.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    
    const dragState: DragState = {
      cardIds,
      fromPile,
      fromIndex,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      offsetX,
      offsetY: offsetY + 20, // Offset so card is visible under finger
    };
    
    dragRef.current = dragState;
    
    // Get valid drop targets
    if (options.getValidDropTargets) {
      setValidTargets(options.getValidDropTargets(cardId));
    }
  }, [options]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    
    const dx = e.clientX - tapStartPosRef.current.x;
    const dy = e.clientY - tapStartPosRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Start dragging if moved more than 10px
    if (distance > 10) {
      isDraggingRef.current = true;
    }
    
    if (isDraggingRef.current) {
      const newDrag = {
        ...dragRef.current,
        currentX: e.clientX,
        currentY: e.clientY,
      };
      dragRef.current = newDrag;
      setDrag(newDrag);
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const currentDrag = dragRef.current;
    if (!currentDrag) return;
    
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    
    const tapDuration = Date.now() - tapStartTimeRef.current;
    const dx = e.clientX - tapStartPosRef.current.x;
    const dy = e.clientY - tapStartPosRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // If it was a quick tap with minimal movement, treat as tap
    if (tapDuration < 300 && distance < 10) {
      const cardId = currentDrag.cardIds[0];
      const now = Date.now();
      
      // Check for double-tap (same card, within 400ms)
      if (
        lastTapRef.current &&
        lastTapRef.current.cardId === cardId &&
        now - lastTapRef.current.time < 400
      ) {
        // Double-tap detected
        lastTapRef.current = null;
        options.onDoubleTap?.(cardId, currentDrag.fromPile, currentDrag.fromIndex);
      } else {
        // Single tap
        lastTapRef.current = { cardId, time: now };
        options.onTap?.(cardId, currentDrag.fromPile, currentDrag.fromIndex);
      }
    } else if (isDraggingRef.current) {
      // Calculate the dragged card's current position
      const deltaX = currentDrag.currentX - currentDrag.startX;
      const deltaY = currentDrag.currentY - currentDrag.startY;
      
      // Get original card rect and calculate new position
      const originalElement = document.querySelector(`[data-card-id="${currentDrag.cardIds[0]}"]`) as HTMLElement;
      let dropTarget: { pile: 'foundation' | 'tableau'; index: number } | null = null;
      
      if (originalElement) {
        const originalRect = originalElement.getBoundingClientRect();
        // Create a virtual rect representing where the card currently is being dragged
        const draggedRect = new DOMRect(
          originalRect.left + deltaX,
          originalRect.top + deltaY,
          originalRect.width,
          originalRect.height
        );
        dropTarget = hitTestByOverlap(draggedRect);
      }
      
      // Check if drop target is valid
      const isValid = dropTarget && validTargets.some(
        t => t.pile === dropTarget.pile && t.index === dropTarget.index
      );
      
      options.onDragEnd?.(currentDrag, isValid ? dropTarget : null);
    }
    
    dragRef.current = null;
    dragElementRef.current = null;
    isDraggingRef.current = false;
    setDrag(null);
    setValidTargets([]);
  }, [options, hitTestByOverlap, validTargets]);

  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    if (dragRef.current) {
      options.onDragEnd?.(dragRef.current, null);
    }
    dragRef.current = null;
    dragElementRef.current = null;
    isDraggingRef.current = false;
    setDrag(null);
    setValidTargets([]);
  }, [options]);

  return {
    drag,
    validTargets,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
  };
}
