import React, { useEffect, useRef, useState } from 'react';
import type { Card as CardType, Suit } from '../engine/types';

interface BouncingCard {
  id: string;
  suit: Suit;
  rank: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  trail: { x: number; y: number }[];
}

const CARD_WIDTH = 71;
const CARD_HEIGHT = 96;
const GRAVITY = 0.4;
const BOUNCE_DAMPING = 0.85;
const TRAIL_LENGTH = 8;
const SPAWN_INTERVAL = 150;

function getSuitColor(suit: Suit): string {
  return suit === 'hearts' || suit === 'diamonds' ? '#dc2626' : '#1e293b';
}

function getSuitSymbol(suit: Suit): string {
  switch (suit) {
    case 'hearts': return '♥';
    case 'diamonds': return '♦';
    case 'clubs': return '♣';
    case 'spades': return '♠';
  }
}

interface BouncingCardsProps {
  foundations: [CardType[], CardType[], CardType[], CardType[]];
  isActive: boolean;
}

export function BouncingCards({ foundations, isActive }: BouncingCardsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const cardsRef = useRef<BouncingCard[]>([]);
  const spawnIndexRef = useRef(0);
  const lastSpawnRef = useRef(0);
  
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Get all cards from foundations in order
  const allCards = foundations.flat().reverse();

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!isActive || !canvasRef.current || dimensions.width === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get actual foundation positions from DOM
    const foundationPositions: { x: number; y: number }[] = [];
    for (let i = 0; i < 4; i++) {
      const pile = document.querySelector(`[data-pile-id="foundation-${i}"]`);
      if (pile) {
        const rect = pile.getBoundingClientRect();
        foundationPositions.push({ x: rect.left, y: rect.top });
      } else {
        // Fallback position if element not found
        foundationPositions.push({ x: dimensions.width - (4 - i) * 70, y: 60 });
      }
    }

    // Reset state
    cardsRef.current = [];
    spawnIndexRef.current = 0;
    lastSpawnRef.current = 0;

    const animate = (timestamp: number) => {
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Spawn new cards periodically
      if (
        spawnIndexRef.current < allCards.length &&
        timestamp - lastSpawnRef.current > SPAWN_INTERVAL
      ) {
        const card = allCards[spawnIndexRef.current];
        const foundationIndex = Math.floor(spawnIndexRef.current / 13) % 4;
        const pos = foundationPositions[foundationIndex];
        
        cardsRef.current.push({
          id: card.id,
          suit: card.suit,
          rank: card.rank,
          x: pos.x,
          y: pos.y,
          vx: (Math.random() - 0.5) * 12,
          vy: Math.random() * -2 - 1,
          trail: [],
        });
        
        spawnIndexRef.current++;
        lastSpawnRef.current = timestamp;
      }

      // Update and draw cards
      cardsRef.current.forEach((card) => {
        // Add current position to trail
        card.trail.push({ x: card.x, y: card.y });
        if (card.trail.length > TRAIL_LENGTH) {
          card.trail.shift();
        }

        // Apply gravity
        card.vy += GRAVITY;

        // Update position
        card.x += card.vx;
        card.y += card.vy;

        // Bounce off bottom
        if (card.y + CARD_HEIGHT > dimensions.height) {
          card.y = dimensions.height - CARD_HEIGHT;
          card.vy = -card.vy * BOUNCE_DAMPING;
        }

        // Bounce off sides
        if (card.x < 0) {
          card.x = 0;
          card.vx = -card.vx * BOUNCE_DAMPING;
        }
        if (card.x + CARD_WIDTH > dimensions.width) {
          card.x = dimensions.width - CARD_WIDTH;
          card.vx = -card.vx * BOUNCE_DAMPING;
        }

        // Draw trail (cards at previous positions)
        card.trail.forEach((pos, i) => {
          const alpha = (i + 1) / TRAIL_LENGTH * 0.8;
          drawCard(ctx, pos.x, pos.y, card.suit, card.rank, alpha);
        });

        // Draw main card
        drawCard(ctx, card.x, card.y, card.suit, card.rank, 1);
      });

      // Continue animation if cards are still moving or spawning
      const hasMovingCards = cardsRef.current.some(
        (c) => Math.abs(c.vy) > 0.5 || c.y + CARD_HEIGHT < dimensions.height - 1
      );
      
      if (spawnIndexRef.current < allCards.length || hasMovingCards) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, dimensions, allCards]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      width={dimensions.width}
      height={dimensions.height}
      className="fixed inset-0 z-40 pointer-events-none"
    />
  );
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  suit: Suit,
  rank: string,
  alpha: number
) {
  ctx.save();
  ctx.globalAlpha = alpha;

  // Card background
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  
  // Rounded rectangle
  const radius = 6;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + CARD_WIDTH - radius, y);
  ctx.quadraticCurveTo(x + CARD_WIDTH, y, x + CARD_WIDTH, y + radius);
  ctx.lineTo(x + CARD_WIDTH, y + CARD_HEIGHT - radius);
  ctx.quadraticCurveTo(x + CARD_WIDTH, y + CARD_HEIGHT, x + CARD_WIDTH - radius, y + CARD_HEIGHT);
  ctx.lineTo(x + radius, y + CARD_HEIGHT);
  ctx.quadraticCurveTo(x, y + CARD_HEIGHT, x, y + CARD_HEIGHT - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Card content
  const color = getSuitColor(suit);
  const symbol = getSuitSymbol(suit);
  
  ctx.fillStyle = color;
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  
  // Top left rank and suit
  ctx.fillText(rank, x + 6, y + 6);
  ctx.fillText(symbol, x + 6, y + 22);
  
  // Center suit (larger)
  ctx.font = 'bold 32px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, x + CARD_WIDTH / 2, y + CARD_HEIGHT / 2);

  ctx.restore();
}
