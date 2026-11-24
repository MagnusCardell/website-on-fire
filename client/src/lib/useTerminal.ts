import { useCallback, useState } from 'react';
import { recall, startSession, submit, suggest, type Session } from './shell';

// The terminal's one piece of state. Everything the screen shows (the output, the
// prompt's folder, the ghost text) is read from this session.
export const useTerminal = () => {
  const [session, setSession] = useState<Session>(() => startSession(new Date()));
  const [position, setPosition] = useState<number | null>(null);

  const enter = useCallback((input: string) => {
    setSession((current) => submit(current, input));
    setPosition(null);
  }, []);

  // The line ↑ or ↓ brings back, or null when there is nothing further that way
  const step = useCallback((direction: 'older' | 'newer'): string | null => {
    const found = recall(session.history, position, direction);
    if (!found) return null;
    setPosition(found.position);
    return found.value;
  }, [session.history, position]);

  const ghost = useCallback((input: string) => suggest(session, input), [session]);

  return { session, enter, step, ghost };
};
