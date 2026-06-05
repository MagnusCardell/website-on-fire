import { LIMITS, createInitialLimitState, createPlaySession } from './policy';
import type { LimitDebugScenario, LimitDebugScenarioId, PersistedLimitState, PlaySession } from './types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const LIMIT_DEBUG_SCENARIOS: LimitDebugScenario[] = [
  { id: 'green', label: 'Green', description: 'Normal low-time state' },
  { id: 'over-time', label: 'Over time', description: '60 min active session' },
  { id: 'over-games', label: 'Over games', description: '5 games started' },
  { id: 'many-restarts', label: 'Restarts', description: '7 games started' },
  { id: 'long-session', label: 'Long', description: 'Long session active' },
];

function normalSession(now: number, activeMs: number, overrides: Partial<PlaySession> = {}): PlaySession {
  return {
    ...createPlaySession('normal', now),
    activeMs,
    lastProgressAtActiveMs: activeMs,
    ...overrides,
  };
}

function longSession(now: number, activeMs: number, overrides: Partial<PlaySession> = {}): PlaySession {
  return {
    ...createPlaySession('long-session', now, {
      reason: 'planned-leisure',
      longSessionBudgetMs: 2 * HOUR,
    }),
    activeMs,
    longSessionStartedAtActiveMs: 0,
    longSessionLastCheckInAtActiveMs: activeMs,
    ...overrides,
  };
}

export function createDebugLimitState(
  scenarioId: LimitDebugScenarioId,
  now = Date.now()
): PersistedLimitState {
  const state = createInitialLimitState(now);
  switch (scenarioId) {
    case 'green':
      return {
        ...state,
        session: normalSession(now, 8 * MINUTE),
      };

    case 'over-time':
      return {
        ...state,
        session: normalSession(now, LIMITS.softLimitMs + MINUTE, {
          gamesStarted: 2,
        }),
      };

    case 'over-games':
      return {
        ...state,
        session: normalSession(now, 18 * MINUTE, {
          gamesStarted: LIMITS.gameCountLimit,
        }),
      };

    case 'many-restarts':
      return {
        ...state,
        session: normalSession(now, 24 * MINUTE, {
          gamesStarted: LIMITS.manyRestartsGameCount,
        }),
      };

    case 'long-session':
      return {
        ...state,
        longSessionUntil: now + 2 * HOUR,
        session: longSession(now, 30 * MINUTE),
      };
  }
}
