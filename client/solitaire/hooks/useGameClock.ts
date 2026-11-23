import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';

export interface GameClock {
  // Active play time of the game on the board, in milliseconds
  getElapsedMs: () => number;
}

interface UseGameClockOptions {
  // Changes whenever a different game is put on the board
  gameId: number;
  // Play time that game already carries
  baseMs: number;
  // The game is being played (not loading, not won)
  running: boolean;
  // The page left the foreground: the time so far, to be stored with the game
  onPause: (elapsedMs: number) => void;
}

// Keeps the play time of the current game. The time lives in refs and is read
// on demand, so the clock running never renders anything by itself; whoever
// shows the time polls it (see components/Clock).
export function useGameClock({ gameId, baseMs, running, onPause }: UseGameClockOptions): GameClock {
  // Time banked from earlier stretches in the foreground
  const bankedRef = useRef(0);
  // When the current foreground stretch began, null while paused
  const sinceRef = useRef<number | null>(null);
  const onPauseRef = useRef(onPause);
  onPauseRef.current = onPause;
  const baseRef = useRef(baseMs);
  baseRef.current = baseMs;

  const getElapsedMs = useCallback(() => {
    const since = sinceRef.current;
    return bankedRef.current + (since === null ? 0 : Date.now() - since);
  }, []);

  // A new game, or the game starting or stopping: take its time as the base.
  // A layout effect, so the base is in place before any display reads it.
  useLayoutEffect(() => {
    bankedRef.current = baseRef.current;
    sinceRef.current = running && document.visibilityState === 'visible' ? Date.now() : null;
  }, [gameId, running]);

  // Only time in the foreground counts
  useEffect(() => {
    if (!running) return;

    const pause = () => {
      const since = sinceRef.current;
      if (since === null) return;
      bankedRef.current += Date.now() - since;
      sinceRef.current = null;
      onPauseRef.current(bankedRef.current);
    };

    const resume = () => {
      if (sinceRef.current === null && document.visibilityState === 'visible') {
        sinceRef.current = Date.now();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') pause();
      else resume();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    // pagehide/pageshow: iOS does not always send visibilitychange
    window.addEventListener('pagehide', pause);
    window.addEventListener('pageshow', resume);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', pause);
      window.removeEventListener('pageshow', resume);
    };
  }, [running]);

  return useMemo(() => ({ getElapsedMs }), [getElapsedMs]);
}
