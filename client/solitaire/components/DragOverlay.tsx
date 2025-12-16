import React from 'react';
import type { Card as CardType } from '../engine/types';
import { Card } from './Card';
import type { DragState } from '../hooks/usePointer';

interface DragOverlayProps {
  drag: DragState | null;
  cards: CardType[];
}

export function DragOverlay({ drag, cards }: DragOverlayProps) {
  if (!drag) return null;

  const deltaX = drag.currentX - drag.startX;
  const deltaY = drag.currentY - drag.startY;

  return (
    <div
      className='fixed pointer-events-none z-[1000]'
      style={{
        left: drag.startX - drag.offsetX + deltaX,
        top: drag.startY - drag.offsetY + deltaY,
        transform: 'scale(1.05)',
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
            top: index * 24,
            left: 0,
            zIndex: index,
          }}
        />
      ))}
    </div>
  );
}
