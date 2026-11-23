import React, { useEffect, useState } from 'react';
import type { GameClock } from '../hooks/useGameClock';

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface ClockProps {
  clock: GameClock;
  // Restart the display when a different game is on the board
  gameId: number;
  running: boolean;
}

// The only component that renders as time passes: once per shown second.
export function Clock({ clock, gameId, running }: ClockProps) {
  const [seconds, setSeconds] = useState(() => Math.floor(clock.getElapsedMs() / 1000));

  useEffect(() => {
    const tick = () => setSeconds(Math.floor(clock.getElapsedMs() / 1000));
    tick();
    if (!running) return;

    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [clock, gameId, running]);

  return <>{formatTime(seconds)}</>;
}
