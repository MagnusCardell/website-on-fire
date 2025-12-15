import React, { forwardRef } from 'react';
import type { Card as CardType, Suit } from '../engine/types';
import { cn } from '../lib/utils';

interface CardProps {
  card: CardType;
  isSelected?: boolean;
  isDragging?: boolean;
  isValidTarget?: boolean;
  style?: React.CSSProperties;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onPointerCancel?: (e: React.PointerEvent) => void;
  className?: string;
}

const suitSymbols: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const suitColors: Record<Suit, string> = {
  hearts: 'text-red-600',
  diamonds: 'text-red-600',
  clubs: 'text-gray-900',
  spades: 'text-gray-900',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(({
  card,
  isSelected,
  isDragging,
  isValidTarget,
  style,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  className,
}, ref) => {
  const symbol = suitSymbols[card.suit];
  const colorClass = suitColors[card.suit];

  if (!card.faceUp) {
    return (
      <div
        ref={ref}
        data-card-id={card.id}
        className={cn(
          'absolute w-[60px] h-[84px] rounded-lg shadow-md select-none touch-none',
          'bg-gradient-to-br from-blue-800 via-blue-700 to-blue-900',
          'border-2 border-blue-600',
          className
        )}
        style={{ ...style, transformStyle: 'preserve-3d' }}
      >
        {/* Traditional pattern back */}
        <div className="absolute inset-2 rounded border border-blue-500/30 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(255,255,255,0.05)_4px,rgba(255,255,255,0.05)_8px)]" />
        <div className="absolute inset-3 rounded border border-blue-400/20" />
      </div>
    );
  }

  return (
    <div
      ref={ref}
      data-card-id={card.id}
      className={cn(
        'absolute w-[60px] h-[84px] rounded-lg shadow-md select-none touch-none',
        'bg-white border border-gray-300',
        'transition-shadow duration-150',
        isSelected && 'ring-2 ring-amber-400 shadow-lg shadow-amber-400/30',
        isDragging && 'shadow-xl scale-105 z-50',
        isValidTarget && 'ring-2 ring-green-400',
        !isDragging && 'hover:shadow-lg',
        className
      )}
      style={{ ...style, transformStyle: 'preserve-3d' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {/* Top left rank and suit */}
      <div className={cn('absolute top-1 left-1.5 leading-none', colorClass)}>
        <div className="text-sm font-bold">{card.rank}</div>
        <div className="text-xs -mt-0.5">{symbol}</div>
      </div>
      
      {/* Center suit */}
      <div className={cn('absolute inset-0 flex items-center justify-center text-2xl', colorClass)}>
        {symbol}
      </div>
      
      {/* Bottom right rank and suit (inverted) */}
      <div className={cn('absolute bottom-1 right-1.5 leading-none rotate-180', colorClass)}>
        <div className="text-sm font-bold">{card.rank}</div>
        <div className="text-xs -mt-0.5">{symbol}</div>
      </div>
    </div>
  );
});

Card.displayName = 'Card';

// Empty pile placeholder
export function EmptyPile({ 
  type, 
  isValidTarget,
  onClick,
  children,
}: { 
  type: 'foundation' | 'tableau' | 'stock'; 
  isValidTarget?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'w-[60px] h-[84px] rounded-lg border-2 border-dashed',
        'flex items-center justify-center',
        type === 'foundation' && 'border-green-600/40 bg-green-900/20',
        type === 'tableau' && 'border-gray-500/30 bg-gray-900/10',
        type === 'stock' && 'border-gray-500/30 bg-gray-900/20 cursor-pointer',
        isValidTarget && 'border-green-400 bg-green-400/20',
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
