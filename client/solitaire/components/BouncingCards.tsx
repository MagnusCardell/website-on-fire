import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const GRAVITY = 0.22;
const BOUNCE_DAMPING = 0.92;
const AIR_DRAG = 0.995;
const FLOOR_FRICTION = 0.985;
const SPAWN_INTERVAL = 220;
const MAX_V = 22;
const TRAIL_LENGTH = 10;

function readCssPx(name: string, fallback: number) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function getCardSize() {
  const w = readCssPx("--sol-card-w", 60);
  const h = readCssPx("--sol-card-h", 84);
  return { w, h };
}

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

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

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

  const cardsWithPile = useMemo(() => {
    const withPile = foundations.flatMap((pile, pileIndex) =>
      pile.map((c) => ({ c, pileIndex }))
    );
    return withPile.reverse();
  }, [foundations]);

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
    const { w: CARD_WIDTH, h: CARD_HEIGHT } = getCardSize();

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(dimensions.width * dpr);
    canvas.height = Math.floor(dimensions.height * dpr);
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Get actual foundation positions from DOM
    const foundationPositions: { x: number; y: number }[] = [];
    for (let i = 0; i < 4; i++) {
      const pile = document.querySelector(`[data-pile-id='foundation-${i}']`);
      if (pile) {
        const rect = pile.getBoundingClientRect();
        foundationPositions.push({
          x: rect.left + (rect.width - CARD_WIDTH) / 2,
          y: rect.top + (rect.height - CARD_HEIGHT) / 2
        });
      } else {
        // Fallback position if element not found
        foundationPositions.push({ x: dimensions.width - (4 - i) * (CARD_WIDTH + 10), y: 60 });
      }
    }

    // Reset state
    cardsRef.current = [];
    spawnIndexRef.current = 0;
    lastSpawnRef.current = 0;
    let lastTs = 0;

    const animate = (timestamp: number) => {
      if (!lastTs) lastTs = timestamp;
      const dt = Math.min(2, (timestamp - lastTs) / 16.67); // 60fps baseline, clamp
      lastTs = timestamp;

      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Spawn new cards periodically
      if (
        spawnIndexRef.current < cardsWithPile.length &&
        timestamp - lastSpawnRef.current > SPAWN_INTERVAL
      ) {
        const item = cardsWithPile[spawnIndexRef.current];
        const pos = foundationPositions[item.pileIndex];
        cardsRef.current.push({
          id: item.c.id,
          suit: item.c.suit,
          rank: item.c.rank,
          x: pos.x,
          y: pos.y,
          vx: (Math.random() - 0.5) * 8,   // was *12 (too fast)
          vy: -6 - Math.random() * 6,      // strong initial pop up
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

        /// Apply physics using dt
        card.vy += GRAVITY * dt;

        card.vx *= Math.pow(AIR_DRAG, dt);
        card.vy *= Math.pow(AIR_DRAG, dt);

        card.x += card.vx * dt;
        card.y += card.vy * dt;

        // Bounce off bottom
        if (card.y + CARD_HEIGHT > dimensions.height) {
          card.y = dimensions.height - CARD_HEIGHT;
          card.vy = -card.vy * BOUNCE_DAMPING;

          // friction only when on ground
          card.vx *= Math.pow(FLOOR_FRICTION, dt);

          // tiny “rest” threshold to stop jitter
          if (Math.abs(card.vy) < 0.35) card.vy = 0;
          if (Math.abs(card.vx) < 0.05) card.vx = 0;
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
        card.vx = clamp(card.vx, -MAX_V, MAX_V);
        card.vy = clamp(card.vy, -MAX_V, MAX_V);

        // Draw trail (cards at previous positions)
        card.trail.forEach((pos, i) => {
          const alpha = (i + 1) / TRAIL_LENGTH * 0.8;
          drawCard(ctx, CARD_WIDTH, CARD_HEIGHT, pos.x, pos.y, card.suit, card.rank, alpha);
        });

        // Draw main card
        drawCard(ctx, CARD_WIDTH, CARD_HEIGHT, card.x, card.y, card.suit, card.rank, 1);
      });

      // Continue animation if cards are still moving or spawning
      const hasMovingCards = cardsRef.current.some(
        (c) => Math.abs(c.vx) > 0.2 || Math.abs(c.vy) > 0.2 || c.y + CARD_HEIGHT < dimensions.height - 1
      );

      if (spawnIndexRef.current < cardsWithPile.length || hasMovingCards) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, dimensions.width, dimensions.height, cardsWithPile]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
    />
  );
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  CARD_WIDTH: number,
  CARD_HEIGHT: number,
  x: number,
  y: number,
  suit: Suit,
  rank: string,
  alpha: number
) {
  ctx.save();
  ctx.globalAlpha = alpha;

  const pad = Math.max(4, Math.round(CARD_WIDTH * 0.08));
  const rankSize = Math.max(12, Math.round(CARD_WIDTH * 0.22));
  const pipSize = Math.max(12, Math.round(CARD_WIDTH * 0.22));
  const centerSize = Math.max(22, Math.round(CARD_WIDTH * 0.45));
  const radius = Math.max(5, Math.round(CARD_WIDTH * 0.09));

  // Card background
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;

  // Rounded rectangle
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
  ctx.font = `bold ${rankSize}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  ctx.fillText(rank, x + pad, y + pad);
  ctx.font = `700 ${pipSize}px system-ui, sans-serif`;
  ctx.fillText(symbol, x + pad, y + pad + rankSize + 2);

  ctx.font = `bold ${centerSize}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, x + CARD_WIDTH / 2, y + CARD_HEIGHT / 2);

  ctx.restore();
}
