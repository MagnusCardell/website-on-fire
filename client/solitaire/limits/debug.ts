import { LIMITS, createInitialLimitState, createPlaySession, getTodayKey } from './policy';
import type { LimitDebugScenario, LimitDebugScenarioId, PersistedLimitState, PlaySession } from './types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const LIMIT_DEBUG_SCENARIOS: LimitDebugScenario[] = [
  { id: 'green', label: 'Green', description: 'Normal low-time state' },
  { id: 'soft-nudge', label: 'Soft', description: '20 min nudge' },
  { id: 'daily-complete', label: 'Daily done', description: 'Daily completion nudge' },
  { id: 'break-gate', label: 'Break', description: '60s break checkpoint' },
  { id: 'break-ready', label: 'Break ready', description: 'Break checkpoint after countdown' },
  { id: 'intent-gate', label: 'Intent', description: '50 min intent choice' },
  { id: 'doom-intent', label: 'Doom 3+', description: 'Loop-play intent gate' },
  { id: 'normal-lock', label: 'Lock', description: 'Normal-mode cooldown' },
  { id: 'daily-cap', label: 'Daily cap', description: '90 min normal-mode cap' },
  { id: 'long-session-checkin', label: 'Long check', description: 'Long Session check-in' },
  { id: 'long-session-ended', label: 'Long end', description: 'Long Session budget reached' },
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
  const todayKey = getTodayKey(new Date(now));

  switch (scenarioId) {
    case 'green':
      return {
        ...state,
        session: normalSession(now, 8 * MINUTE),
      };

    case 'soft-nudge':
      return {
        ...state,
        session: normalSession(now, LIMITS.softNudgeMs),
      };

    case 'daily-complete':
      return {
        ...state,
        session: normalSession(now, 12 * MINUTE, {
          dailyCompletedThisSession: true,
        }),
      };

    case 'break-gate':
      return {
        ...state,
        breakReadyAt: now + LIMITS.breakPauseMs,
        session: normalSession(now, LIMITS.breakGateMs + MINUTE),
      };

    case 'break-ready':
      return {
        ...state,
        breakReadyAt: now - 1_000,
        session: normalSession(now, LIMITS.breakGateMs + MINUTE),
      };

    case 'intent-gate':
      return {
        ...state,
        session: normalSession(now, LIMITS.intentGateMs + MINUTE),
      };

    case 'doom-intent':
      return {
        ...state,
        session: normalSession(now, 30 * MINUTE, {
          lastProgressAtActiveMs: 12 * MINUTE,
          movesSinceProgress: 31,
          stockRecyclesThisGame: 4,
          recentMoveTypes: Array(20).fill('draw'),
        }),
      };

    case 'normal-lock':
      return {
        ...state,
        lockUntil: now + LIMITS.shortCooldownMs,
        lockReason: 'debug normal-mode lock',
        session: normalSession(now, LIMITS.normalHardCapMs + MINUTE),
      };

    case 'daily-cap':
      return {
        ...state,
        dailyNormalActiveMsByDate: {
          [todayKey]: LIMITS.normalDailyCapMs,
        },
        session: normalSession(now, 14 * MINUTE),
      };

    case 'long-session-checkin':
      return {
        ...state,
        session: longSession(now, LIMITS.longSessionCheckInMs + MINUTE, {
          longSessionLastCheckInAtActiveMs: 0,
        }),
      };

    case 'long-session-ended':
      return {
        ...state,
        session: longSession(now, 2 * HOUR + MINUTE),
      };
  }
}
