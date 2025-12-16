import React, { useRef, useEffect } from 'react';
import type { Card as CardType } from '../engine/types';
import { Card, EmptyPile } from './Card';
import { registerPile } from '../hooks/usePointer';
import { cn } from '../lib/utils';

interface PileProps {
  cards: CardType[];
  pileType: 'stock' | 'waste' | 'foundation' | 'tableau';
  pileIndex: number;
  isValidTarget?: boolean;
  isSelected?: (cardId: string) => boolean;
  isDragging?: (cardId: string) => boolean;
  onCardPointerDown?: (e: React.PointerEvent, cardId: string) => void;
  onCardPointerMove?: (e: React.PointerEvent) => void;
  onCardPointerUp?: (e: React.PointerEvent) => void;
  onCardPointerCancel?: (e: React.PointerEvent) => void;
  onEmptyClick?: () => void;
  onPileClick?: () => void;
}

export function Pile({
  cards,
  pileType,
  pileIndex,
  isValidTarget,
  isSelected,
  isDragging,
  onCardPointerDown,
  onCardPointerMove,
  onCardPointerUp,
  onCardPointerCancel,
  onEmptyClick,
  onPileClick,
}: PileProps) {
  const pileRef = useRef<HTMLDivElement>(null);
  const pileId = `${pileType}-${pileIndex}`;

  useEffect(() => {
    registerPile(pileId, pileRef.current);
    return () => registerPile(pileId, null);
  }, [pileId]);

  const readVarPx = (name: string, fallback: number) => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const cardH = readVarPx('--sol-card-h', 84);
  const fanUp = readVarPx('--sol-fan-up', 24);
  const fanDown = readVarPx('--sol-fan-down', 8);

  const getPileHeight = () => {
    if (pileType === 'tableau') {
      let h = cardH;
      for (let i = 0; i < cards.length - 1; i++) {
        h += cards[i].faceUp ? fanUp : fanDown;
      }
      return Math.max(h, cardH);
    }
    else if(pileType === 'foundation') {
      return cardH;
    }

    // stock/waste: always at least one card tall
    // small extra for stock depth effect 
    return pileType === 'stock' ? cardH + 10 : cardH;
  };

  // Calculate card positions based on pile type
  const getCardStyle = (index: number): React.CSSProperties => {
    switch (pileType) {
      case 'stock':
        // Stacked with slight offset for depth
        return {
          top: Math.min(index * 0.5, 3),
          left: Math.min(index * 0.5, 3),
          zIndex: index,
        };
      case 'waste': {
        // Show last 3 cards spread
        const wasteOffset = Math.max(0, cards.length - 3);
        const displayIndex = index - wasteOffset;
        if (displayIndex < 0) {
          return { display: 'none' };
        }
        return {
          left: `calc(${displayIndex} * var(--sol-waste-offset))`,
          zIndex: index,
        };
      }
      case 'foundation':
        // Stacked perfectly
        return {
          zIndex: index,
        };
      case 'tableau': {
        // Face-down cards stacked tighter, face-up spread more
        let offset = 0;
        for (let i = 0; i < index; i++) {
          offset += cards[i].faceUp ? fanUp : fanDown;
        }
        return {
          top: offset,
          zIndex: index,
        };
      }
      default:
        return {};
    }
  };
  const isEmpty = cards.length === 0;

  // For stock pile, show recycle indicator when empty
  if (isEmpty && pileType === 'stock') {
    return (
      <div 
        ref={pileRef} 
        data-pile-id={pileId}
        className='relative'
        style={{ width: 'var(--sol-card-w)', height: getPileHeight() }}
      >
        <EmptyPile type='stock' onClick={onEmptyClick}>
          <svg 
            className='w-6 h-6 text-gray-500' 
            fill='none' 
            stroke='currentColor' 
            viewBox='0 0 24 24'
          >
            <path 
              strokeLinecap='round' 
              strokeLinejoin='round' 
              strokeWidth={2} 
              d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' 
            />
          </svg>
        </EmptyPile>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div 
        ref={pileRef} 
        data-pile-id={pileId}
        className='relative'
        style={{ width: 'var(--sol-card-w)', height: getPileHeight() }}
        onClick={onPileClick}
      >
        <EmptyPile 
          type={pileType === 'foundation' ? 'foundation' : 'tableau'} 
          isValidTarget={isValidTarget}
        />
      </div>
    );
  }

  return (
    <div
      ref={pileRef}
      data-pile-id={pileId}
      className={cn(
        'relative',
        isValidTarget && 'after:absolute after:inset-0 after:rounded-lg after:ring-2 after:ring-green-400 after:pointer-events-none'
      )}
      style={{ width: 'var(--sol-card-w)', height: getPileHeight() }}
      onClick={onPileClick}
    >
      {cards.map((card, index) => {
        const style = getCardStyle(index);
        if (style.display === 'none') return null;

        const isTopCard = index === cards.length - 1;
        const isInteractive = card.faceUp && (pileType === 'waste' ? isTopCard : true);
        const cardIsSelected = isSelected?.(card.id) ?? false;
        const cardIsDragging = isDragging?.(card.id) ?? false;

        return (
          <Card
            key={card.id}
            card={card}
            isSelected={cardIsSelected}
            isDragging={cardIsDragging}
            style={{
              ...style,
              visibility: cardIsDragging ? 'hidden' : 'visible',
            }}
            onPointerDown={isInteractive ? (e) => onCardPointerDown?.(e, card.id) : undefined}
            onPointerMove={isInteractive ? onCardPointerMove : undefined}
            onPointerUp={isInteractive ? onCardPointerUp : undefined}
            onPointerCancel={isInteractive ? onCardPointerCancel : undefined}
          />
        );
      })}
    </div>
  );
}
