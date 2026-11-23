import React from 'react';
import type { Card as CardType } from '../engine/types';
import { Card, EmptyPile } from './Card';

interface PileProps {
  cards: CardType[];
  pileType: 'stock' | 'waste' | 'foundation' | 'tableau';
  pileIndex: number;
  isSelected?: (cardId: string) => boolean;
  isDragging?: (cardId: string) => boolean;
  onCardPointerDown?: (e: React.PointerEvent, cardId: string) => void;
  onCardPointerMove?: (e: React.PointerEvent) => void;
  onCardPointerUp?: (e: React.PointerEvent) => void;
  onCardPointerCancel?: (e: React.PointerEvent) => void;
  onEmptyClick?: () => void;
  onPileClick?: () => void;
}

// Offsets are written as CSS over the layout variables, so rendering a pile
// never has to read a measurement back from the page.

// How far down a tableau pile the card at `index` sits, as a CSS length sum
function tableauFan(cards: CardType[], index: number): string {
  let faceDown = 0;
  let faceUp = 0;
  for (let i = 0; i < index; i++) {
    if (cards[i].faceUp) faceUp++;
    else faceDown++;
  }
  return `var(--sol-fan-down) * ${faceDown} + var(--sol-fan-up) * ${faceUp}`;
}

function pileHeight(pileType: PileProps['pileType'], cards: CardType[]): string {
  if (pileType === 'tableau') {
    const last = Math.max(0, cards.length - 1);
    return `calc(var(--sol-card-h) + ${tableauFan(cards, last)})`;
  }

  // stock: small extra for the depth effect
  return pileType === 'stock' ? 'calc(var(--sol-card-h) + 10px)' : 'var(--sol-card-h)';
}

export function Pile({
  cards,
  pileType,
  pileIndex,
  isSelected,
  isDragging,
  onCardPointerDown,
  onCardPointerMove,
  onCardPointerUp,
  onCardPointerCancel,
  onEmptyClick,
  onPileClick,
}: PileProps) {
  const pileId = `${pileType}-${pileIndex}`;
  const pileStyle: React.CSSProperties = {
    width: 'var(--sol-card-w)',
    height: pileHeight(pileType, cards),
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
      case 'tableau':
        // Face-down cards stacked tighter, face-up spread more
        return {
          top: `calc(${tableauFan(cards, index)})`,
          zIndex: index,
        };
      default:
        return {};
    }
  };
  const isEmpty = cards.length === 0;

  // For stock pile, show recycle indicator when empty
  if (isEmpty && pileType === 'stock') {
    return (
      <div
        data-pile-id={pileId}
        className='relative'
        style={pileStyle}
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
        data-pile-id={pileId}
        className='relative'
        style={pileStyle}
        onClick={onPileClick}
      >
        <EmptyPile
          type={pileType === 'foundation' ? 'foundation' : 'tableau'}
        />
      </div>
    );
  }

  return (
    <div
      data-pile-id={pileId}
      className='relative'
      style={pileStyle}
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
