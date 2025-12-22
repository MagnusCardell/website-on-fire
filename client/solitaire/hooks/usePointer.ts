import { useState, useCallback, useRef } from 'react';

export interface DragState {
  cardIds: string[];
  fromPile: 'waste' | 'tableau' | 'foundation';
  fromIndex: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  offsetX: number;
  offsetY: number;
}

interface UsePointerOptions {
  onDragStart?: (cardId: string, fromPile: 'waste' | 'tableau' | 'foundation', fromIndex: number) => string[];
  onDragEnd?: (drag: DragState, dropTarget: { pile: 'foundation' | 'tableau'; index: number } | null) => void;
  onTap?: (cardId: string, fromPile: 'waste' | 'tableau' | 'stock' | 'foundation', fromIndex: number) => void;
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

function expandRect(r: DOMRect, pad: number, padBottomExtra = 0) {
  return new DOMRect(
    r.left - pad,
    r.top - pad,
    r.width + pad * 2,
    r.height + pad * 2 + padBottomExtra
  );
}

function rectCenter(r: DOMRect) {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function dist(a: {x:number;y:number}, b: {x:number;y:number}) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx*dx + dy*dy);
}

// Calculate overlap area between two rectangles
function getOverlapArea(rect1: DOMRect, rect2: DOMRect): number {
  const xOverlap = Math.max(0, Math.min(rect1.right, rect2.right) - Math.max(rect1.left, rect2.left));
  const yOverlap = Math.max(0, Math.min(rect1.bottom, rect2.bottom) - Math.max(rect1.top, rect2.top));
  return xOverlap * yOverlap;
}

function readCssPx(name: string, fallback: number) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function landingRectForPile(pileType: "foundation" | "tableau", pileRect: DOMRect): DOMRect {
  const cardH = readCssPx("--sol-card-h", 84);
  const cardW = readCssPx("--sol-card-w", 60);

  if (pileType === "foundation") {
    // Entire pile is the target
    return new DOMRect(pileRect.left, pileRect.top, pileRect.width, pileRect.height);
  }

  // Tableau: target the bottom "slot" where a drop would land.
  // Use card size; keep width aligned to pile column.
  const w = Math.min(pileRect.width, cardW);
  const x = pileRect.left + (pileRect.width - w) / 2;
  const y = pileRect.bottom - cardH;

  return new DOMRect(x, y, w, cardH);
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function usePointer(options: UsePointerOptions) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [validTargets, setValidTargets] = useState<{ pile: 'foundation' | 'tableau'; index: number }[]>([]);
  const dragRef = useRef<DragState | null>(null);
  const isDraggingRef = useRef(false);
  const tapStartTimeRef = useRef(0);
  const tapStartPosRef = useRef({ x: 0, y: 0 });
  const lastTapRef = useRef<{ cardId: string; time: number } | null>(null);
  const lastBestRef = useRef<{ target: { pile: "foundation" | "tableau"; index: number } | null; score: number }>({
    target: null,
    score: -Infinity,
  });
  
  // Hit test using card overlap instead of pointer position
  const hitTestByOverlap = useCallback(
    (
      draggedCardRect: DOMRect,
      pointerType: "touch" | "mouse" | "pen",
      pointer: { x: number; y: number }, // pass current pointer coords
      allowed?: Set<string>
    ): { pile: "foundation" | "tableau"; index: number } | null => {
  
      const cardArea = draggedCardRect.width * draggedCardRect.height;
      if (!Number.isFinite(cardArea) || cardArea <= 0) return null;
  
      const pad = pointerType === "touch" ? 18 : 10;
      const cardW = readCssPx("--sol-card-w", draggedCardRect.width);
  
      let bestTarget: { pile: "foundation" | "tableau"; index: number } | null = null;
      let bestScore = -Infinity;
  
      const draggedCenter = rectCenter(draggedCardRect);
      const pointerPoint = pointer;
  
      for (const [pileId, pileRectRaw] of pileRects.entries()) {
        const [pileTypeRaw, indexStr] = pileId.split("-");
        if (pileTypeRaw !== "foundation" && pileTypeRaw !== "tableau") continue;
  
        const pileType = pileTypeRaw as "foundation" | "tableau";
        const index = Number.parseInt(indexStr, 10);
        if (!Number.isFinite(index)) continue;
        if (allowed && allowed.size > 0 && !allowed.has(`${pileType}-${index}`)) continue;
  
        // Expand pile rect for magnetism
        const pileRectMag =
          pileType === "tableau"
            ? expandRect(pileRectRaw, pad, 34)
            : expandRect(pileRectRaw, pad);
  
        // Compute landing zone and expand it a bit too (finger-friendly)
        const landing = landingRectForPile(pileType, pileRectMag);
        const landingMag = expandRect(landing, pointerType === "touch" ? 14 : 8);
  
        const overlap = getOverlapArea(draggedCardRect, landingMag);
        const overlapNorm = overlap / cardArea; // ~0..1
  
        // Distance from dragged card center to landing zone center
        const landCenter = rectCenter(landingMag);
        const dCenter = dist(draggedCenter, landCenter);
        const distNorm = clamp(dCenter / (cardW * 1.2), 0, 1);
  
        // Distance from pointer to landing zone center (very important on touch)
        const dPointer = dist(pointerPoint, landCenter);
        const pointerNorm = clamp(dPointer / (cardW * 1.1), 0, 1);
  
        // Proximity is "1 - normalized distance"
        const centerProx = 1 - distNorm;
        const pointerProx = 1 - pointerNorm;
  
        // Score: overlap matters, but proximity matters more for perceived intent
        let score =
          overlapNorm * 0.9 +
          centerProx * 0.65 +
          pointerProx * 0.85;
  
        // Small contextual bias
        if (pileType === "foundation") score += 0.06;
        if (pileType === "tableau") score += 0.04;
  
        // Optional: discourage very far targets even with expanded rects
        if (pointerNorm > 0.98 && overlapNorm < 0.01) score -= 0.25;
  
        if (score > bestScore) {
          bestScore = score;
          bestTarget = { pile: pileType, index };
        }
      }
  
      // Hysteresis: keep the previous target unless new target is clearly better
      const prev = lastBestRef.current;
      if (prev.target) {
        const stickiness = pointerType === "touch" ? 0.08 : 0.05;
        if (bestTarget && bestScore < prev.score + stickiness) {
          return prev.target;
        }
      }
  
      // Acceptance threshold
      const threshold = pointerType === "touch" ? 0.32 : 0.36;
      if (bestScore < threshold) return null;
  
      // Save for hysteresis
      lastBestRef.current = { target: bestTarget, score: bestScore };
  
      return bestTarget;
    },
    []
  );
  

  const handlePointerDown = useCallback((
    e: React.PointerEvent,
    cardId: string,
    fromPile: 'waste' | 'tableau' | 'stock' | 'foundation',
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
    
    tapStartTimeRef.current = Date.now();
    tapStartPosRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
    
    // Get cards to drag
    const cardIds = options.onDragStart?.(cardId, fromPile, fromIndex) ?? [cardId];
    if (cardIds.length === 0) {
      dragRef.current = null;
      setValidTargets([]);
      return;
    }
    
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
      offsetY
    };
    
    dragRef.current = dragState;
    lastBestRef.current = { target: null, score: -Infinity };
    
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
        now - lastTapRef.current.time < 400 &&
        currentDrag.fromPile !== 'foundation'
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
        const allowed = new Set(validTargets.map(t => `${t.pile}-${t.index}`));

        dropTarget = hitTestByOverlap(
          draggedRect,
          e.pointerType as any,
          { x: e.clientX, y: e.clientY },
          allowed
        );
      }
      
      // Check if drop target is valid
      const isValid = dropTarget && validTargets.some(
        t => t.pile === dropTarget.pile && t.index === dropTarget.index
      );
      
      options.onDragEnd?.(currentDrag, isValid ? dropTarget : null);
    }
    lastBestRef.current = { target: null, score: -Infinity };
    dragRef.current = null;
    isDraggingRef.current = false;
    setDrag(null);
    setValidTargets([]);
  }, [options, hitTestByOverlap, validTargets]);

  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    if (dragRef.current) {
      options.onDragEnd?.(dragRef.current, null);
    }
    lastBestRef.current = { target: null, score: -Infinity };
    dragRef.current = null;
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
