import React from 'react';
import type { Card as CardType } from '../engine/types';
import { Card } from './Card';
import type { DragState } from '../hooks/usePointer';

interface DragOverlayProps {
  drag: DragState | null;
  cards: CardType[];
  // Receives the overlay element; the pointer hook moves it with a transform
  overlayRef: (el: HTMLElement | null) => void;
}

export function DragOverlay({ drag, cards, overlayRef }: DragOverlayProps) {
  if (!drag) return null;

  return (
    <div
      ref={overlayRef}
      className='fixed pointer-events-none z-[1000]'
      style={{
        left: drag.originX,
        top: drag.originY,
        transform: 'scale(1.05)',
        willChange: 'transform',
        filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))',
      }}
    >
      {cards.map((card, index) => (
        <Card
          key={card.id}
          card={card}
          isDragging
          style={{
            position: index === 0 ? 'relative' : 'absolute',
            top: `calc(var(--sol-fan-up) * ${index})`,
            left: 0,
            zIndex: index,
          }}
        />
      ))}
    </div>
  );
}
