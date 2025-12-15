import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState } from '../engine/types';

interface UseGameTimerOptions {
  gameState: GameState | null;
  onElapsedChange: (elapsedMs: number) => void;
  onPersistRequest: () => void;
}

export function useGameTimer({ gameState, onElapsedChange, onPersistRequest }: UseGameTimerOptions) {
  // lastActiveTs is null when paused/hidden, otherwise the timestamp when we started counting
  const [lastActiveTs, setLastActiveTs] = useState<number | null>(null);
  const [displayMs, setDisplayMs] = useState(0);
  const persistRef = useRef(onPersistRequest);
  persistRef.current = onPersistRequest;
  const onElapsedChangeRef = useRef(onElapsedChange);
  onElapsedChangeRef.current = onElapsedChange;

  // Get the base elapsed from game state
  const baseElapsedMs = gameState?.elapsedActiveMs ?? 0;
  const isPlaying = gameState?.gameStatus === 'playing';

  // Pause: accumulate time and clear lastActiveTs
  const pause = useCallback(() => {
    setLastActiveTs((prev) => {
      if (prev === null) return null;
      const now = Date.now();
      const delta = now - prev;
      onElapsedChangeRef.current(baseElapsedMs + delta);
      return null;
    });
  }, [baseElapsedMs]);

  // Resume: set lastActiveTs to now
  const resume = useCallback(() => {
    if (!isPlaying) return;
    setLastActiveTs(Date.now());
  }, [isPlaying]);

  // Initialize on game state change
  useEffect(() => {
    if (!gameState || !isPlaying) {
      setLastActiveTs(null);
      setDisplayMs(baseElapsedMs);
      return;
    }

    // Start tracking if visible
    if (document.visibilityState === 'visible') {
      setLastActiveTs(Date.now());
    }
    setDisplayMs(baseElapsedMs);
  }, [gameState?.seed, isPlaying, baseElapsedMs]);

  // Update display every 100ms
  useEffect(() => {
    if (!isPlaying) return;

    const updateDisplay = () => {
      const now = Date.now();
      const active = lastActiveTs ? now - lastActiveTs : 0;
      setDisplayMs(baseElapsedMs + active);
    };

    updateDisplay();
    const interval = setInterval(updateDisplay, 100);
    return () => clearInterval(interval);
  }, [isPlaying, baseElapsedMs, lastActiveTs]);

  // Visibility change handler
  useEffect(() => {
    if (!isPlaying) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Pause and persist
        setLastActiveTs((prev) => {
          if (prev === null) return null;
          const now = Date.now();
          const delta = now - prev;
          const newElapsed = baseElapsedMs + delta;
          onElapsedChangeRef.current(newElapsed);
          // Request persist after state update
          setTimeout(() => persistRef.current(), 0);
          return null;
        });
      } else {
        // Resume
        setLastActiveTs(Date.now());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isPlaying, baseElapsedMs]);

  // Pagehide handler (important for iOS)
  useEffect(() => {
    if (!isPlaying) return;

    const handlePageHide = () => {
      setLastActiveTs((prev) => {
        if (prev === null) return null;
        const now = Date.now();
        const delta = now - prev;
        onElapsedChangeRef.current(baseElapsedMs + delta);
        persistRef.current();
        return null;
      });
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, [isPlaying, baseElapsedMs]);

  // Focus/blur handlers (optional additional precision)
  useEffect(() => {
    if (!isPlaying) return;

    const handleBlur = () => {
      setLastActiveTs((prev) => {
        if (prev === null) return null;
        const now = Date.now();
        const delta = now - prev;
        onElapsedChangeRef.current(baseElapsedMs + delta);
        return null;
      });
    };

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        setLastActiveTs(Date.now());
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isPlaying, baseElapsedMs]);

  return {
    displayMs,
    displaySeconds: Math.floor(displayMs / 1000),
    pause,
    resume,
    isActive: lastActiveTs !== null,
  };
}
