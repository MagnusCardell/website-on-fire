import React, { forwardRef, useMemo } from 'react';
import type { Card as CardType, Suit } from '../engine/types';
import { cn } from '../lib/utils';
import { HorseSilhouette } from './HorseSilhouette';

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

  // Avoid SVG filter perf cliffs on iOS Safari.
  const reduceEffects = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    return isIOS || prefersReducedMotion;
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    onPointerDown?.(e);
  };
  const handlePointerMove = (e: React.PointerEvent) => onPointerMove?.(e);
  const handlePointerUp = (e: React.PointerEvent) => {
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    onPointerUp?.(e);
  };
  const handlePointerCancel = (e: React.PointerEvent) => {
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    onPointerCancel?.(e);
  };

  const rootClass = cn(
    'absolute rounded-lg shadow-md select-none overflow-hidden',
    'touch-none',
    className,
  );

  const rootStyle: React.CSSProperties = {
    width: 'var(--sol-card-w)',
    height: 'var(--sol-card-h)',
    transformStyle: 'preserve-3d',
    WebkitTapHighlightColor: 'transparent',
    WebkitUserSelect: 'none',
    userSelect: 'none',
    ...style,
  };

  if (!card.faceUp) {
    return (
      <div
        ref={ref}
        data-card-id={card.id}
        className={cn(
          rootClass,
          'border-2 border-amber-700',
          'bg-gradient-to-br from-amber-900 via-amber-800 to-amber-950',
        )}
        style={rootStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div className="pointer-events-none absolute inset-[3px] rounded border border-amber-600/50" />
        <div className="pointer-events-none absolute inset-[6px] rounded border border-amber-500/30" />

        <div
          className="pointer-events-none absolute inset-[8px] rounded opacity-30"
          style={{
            backgroundImage: `
              linear-gradient(45deg, transparent 40%, rgba(255,215,0,0.4) 50%, transparent 60%),
              linear-gradient(-45deg, transparent 40%, rgba(255,215,0,0.4) 50%, transparent 60%)
            `,
            backgroundSize: '8px 8px',
          }}
        />

        {/* Center medallion with horse */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative w-8 h-10 flex items-center justify-center">
            <div className="absolute inset-0 rounded-[50%] border-[1.5px] border-amber-300/80 shadow-[inset_0_0_8px_rgba(251,191,36,0.3)]" />
              <HorseSilhouette reduceEffects={reduceEffects} />
          </div>
        </div>

        {/* Corner flourishes */}
        <div className="pointer-events-none absolute top-1.5 left-1.5 w-2 h-2 border-t-2 border-l-2 border-amber-500/60 rounded-tl-sm" />
        <div className="pointer-events-none absolute top-1.5 right-1.5 w-2 h-2 border-t-2 border-r-2 border-amber-500/60 rounded-tr-sm" />
        <div className="pointer-events-none absolute bottom-1.5 left-1.5 w-2 h-2 border-b-2 border-l-2 border-amber-500/60 rounded-bl-sm" />
        <div className="pointer-events-none absolute bottom-1.5 right-1.5 w-2 h-2 border-b-2 border-r-2 border-amber-500/60 rounded-br-sm" />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent rounded-lg" />
      </div>
    );
  }

  const rankStyle: React.CSSProperties = {
    fontSize: 'clamp(16px, calc(var(--sol-card-w) * 0.28), 20px)',
    lineHeight: 1,
  };
  const pipStyle: React.CSSProperties = {
    fontSize: 'clamp(14px, calc(var(--sol-card-w) * 0.22), 16px)',
    lineHeight: 1,
  };
  const centerStyle: React.CSSProperties = {
    fontSize: 'clamp(24px, calc(var(--sol-card-w) * 0.42), 28px)',
    lineHeight: 1,
  };

  return (
    <div
      ref={ref}
      data-card-id={card.id}
      className={cn(
        rootClass,
        'bg-white border border-gray-200',
        'transition-shadow duration-150',
        isSelected && 'ring-2 ring-sol-selection shadow-lg shadow-sol-selection/30',
        isDragging && 'shadow-xl scale-105 z-50',
        isValidTarget && 'ring-2 ring-sol-valid-target',
        !isDragging && 'hover:shadow-lg',
      )}
      style={rootStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {/* Top left rank and suit */}
      <div className={cn('absolute top-0 left-1.5 leading-none', colorClass)}>
        <div className="font-bold" style={rankStyle}>{card.rank}</div>
      </div>
      <div className={cn('absolute top-1 right-1 leading-none', colorClass)}>
        <div style={pipStyle}>{symbol}</div>
      </div>

      {/* Center suit */}
      <div className={cn('absolute inset-0 flex items-center justify-center', colorClass)}>
        <div style={centerStyle}>{symbol}</div>
      </div>

      {/* Bottom right rank and suit (inverted) */}
      <div className={cn('absolute bottom-0 right-1.5 leading-none rotate-180', colorClass)}>
        <div className="font-bold" style={rankStyle}>{card.rank}</div>
      </div>
      <div className={cn('absolute bottom-1 left-1 leading-none rotate-180', colorClass)}>
        <div style={pipStyle}>{symbol}</div>
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
        'rounded-lg border-2 border-dashed',
        'flex items-center justify-center',
        type === 'foundation' && 'border-green-600/40 bg-green-900/20',
        type === 'tableau' && 'border-gray-500/30 bg-gray-900/10',
        type === 'stock' && 'border-gray-500/30 bg-gray-900/20 cursor-pointer',
        isValidTarget && 'border-green-400 bg-green-400/20',
      )}
      style={{ width: 'var(--sol-card-w)', height: 'var(--sol-card-h)' }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
