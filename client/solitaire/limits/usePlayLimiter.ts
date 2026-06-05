import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LIMITS,
  createInitialLimitState,
  createPlaySession,
  evaluateLimitState,
  getTodayKey,
  updateSessionForMove,
  updateSessionForUndo,
} from './policy';
import type {
  LimitDebugScenarioId,
  LimitMoveInput,
  LimitSnapshot,
  LongSessionReason,
  PersistedLimitState,
  PlayLimiterControls,
  PlayMode,
  PlaySession,
} from './types';
import { createDebugLimitState } from './debug';
import { loadLimitState, saveCompletedSession, saveLimitState } from '../persistence/sessionStorage';

const SAVE_DEBOUNCE_MS = 500;

function clampActiveDelta(nextGameActiveMs: number, previousGameActiveMs: number): number {
  if (!Number.isFinite(nextGameActiveMs) || nextGameActiveMs < 0) return 0;
  return Math.max(0, nextGameActiveMs - Math.max(0, previousGameActiveMs));
}

function touch(state: PersistedLimitState): PersistedLimitState {
  return { ...state, updatedAt: Date.now() };
}

function clearGateDeferrals(state: PersistedLimitState): PersistedLimitState {
  return {
    ...state,
    breakReadyAt: undefined,
    breakSnoozedUntilActiveMs: undefined,
    intentSnoozedUntilActiveMs: undefined,
    remindAfterCurrentGame: undefined,
  };
}

function clearLockedSession(state: PersistedLimitState, now = Date.now()): PersistedLimitState {
  return {
    ...clearGateDeferrals(state),
    lockUntil: undefined,
    lockReason: undefined,
    finishCurrentGameOnly: undefined,
    stopAfterCurrentGame: undefined,
    softNudgeDismissedForSessionId: undefined,
    remindAfterCurrentGame: undefined,
    longSessionUntil: undefined,
    lastSyncedGameKey: undefined,
    lastSyncedGameActiveMs: undefined,
    session: createPlaySession('normal', now),
  };
}

function completeSession(session: PlaySession): PlaySession {
  return { ...session, endedAt: Date.now() };
}

function formatMinutes(ms: number): string {
  return `${Math.floor(ms / 60_000)}m`;
}

function formatStatus(session: PlaySession, dailyNormalActiveMs: number): LimitSnapshot['statusLabel'] {
  if (session.mode === 'long-session') {
    const budget = session.longSessionBudgetMs ?? LIMITS.longSessionBudgetsMs[0];
    const used = Math.max(0, session.activeMs - (session.longSessionStartedAtActiveMs ?? 0));
    return `Long ${formatMinutes(used)} / ${formatMinutes(budget)}`;
  }

  return `${formatMinutes(session.activeMs)} / ${formatMinutes(LIMITS.softLimitMs)} · ${session.gamesStarted} / ${LIMITS.gameCountLimit} games`;
}

function sessionPromptReason(session: PlaySession): string {
  if (session.gamesStarted >= LIMITS.manyRestartsGameCount) {
    return `You've started ${session.gamesStarted} games this session. Want to stop here?`;
  }

  if (session.activeMs >= LIMITS.softLimitMs) {
    return `You've played for ${formatMinutes(session.activeMs)}. Want to stop here or keep playing?`;
  }

  return `You've started ${session.gamesStarted} games this session. Want to stop here or keep playing?`;
}

export function usePlayLimiter() {
  const [state, setState] = useState<PersistedLimitState>(() => createInitialLimitState());
  const [isLoaded, setIsLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const persisted = await loadLimitState();
      if (cancelled) return;

      const loadNow = Date.now();
      const loaded = persisted ?? createInitialLimitState(loadNow);
      setState(
        (loaded.lockUntil && loaded.lockUntil <= loadNow) ||
        (loaded.longSessionUntil && loaded.longSessionUntil <= loadNow)
          ? clearLockedSession(loaded, loadNow)
          : loaded
      );
      setIsLoaded(true);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveLimitState(stateRef.current);
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [isLoaded, state]);

  const todayKey = useMemo(() => getTodayKey(new Date(now)), [now]);
  const gate = useMemo(() => evaluateLimitState(state, now, todayKey), [state, now, todayKey]);
  const gateRef = useRef(gate);
  gateRef.current = gate;

  useEffect(() => {
    if (!isLoaded) return;
    if ((!state.lockUntil || state.lockUntil > now) && (!state.longSessionUntil || state.longSessionUntil > now)) return;

    setState(prev => {
      const resetNow = Date.now();
      const lockExpired = Boolean(prev.lockUntil && prev.lockUntil <= resetNow);
      const longSessionExpired = Boolean(prev.longSessionUntil && prev.longSessionUntil <= resetNow);
      if (!lockExpired && !longSessionExpired) return prev;

      saveCompletedSession(completeSession(prev.session));
      return touch(clearLockedSession(prev, resetNow));
    });
  }, [isLoaded, now, state.lockUntil, state.longSessionUntil]);

  const syncActiveGame = useCallback((gameKey: string, gameActiveMs: number, mode: PlayMode) => {
    if (!isLoaded) return;

    setState(prev => {
      const sameGame = prev.lastSyncedGameKey === gameKey;
      const previousGameActiveMs = sameGame ? (prev.lastSyncedGameActiveMs ?? 0) : gameActiveMs;
      const delta = sameGame ? clampActiveDelta(gameActiveMs, previousGameActiveMs) : 0;
      const sessionMode = prev.session.mode === 'long-session' ? 'long-session' : mode;
      const session = {
        ...prev.session,
        mode: sessionMode,
        activeMs: prev.session.activeMs + delta,
      };
      const dailyNormalActiveMsByDate = { ...prev.dailyNormalActiveMsByDate };

      if (delta > 0 && sessionMode === 'normal') {
        const key = getTodayKey();
        dailyNormalActiveMsByDate[key] = (dailyNormalActiveMsByDate[key] ?? 0) + delta;
      }

      return touch({
        ...prev,
        session,
        dailyNormalActiveMsByDate,
        lastSyncedGameKey: gameKey,
        lastSyncedGameActiveMs: gameActiveMs,
      });
    });
  }, [isLoaded]);

  const canMakeMove = useCallback(() => {
    return true;
  }, []);

  const canStartGame = useCallback((mode: PlayMode = 'normal') => {
    return true;
  }, []);

  const recordMove = useCallback((input: LimitMoveInput) => {
    setState(prev => {
      const activeMs = Math.max(prev.session.activeMs, input.activeMs);
      const session = updateSessionForMove(prev.session, {
        ...input,
        activeMs,
      });
      return touch({ ...prev, session });
    });
  }, []);

  const recordUndo = useCallback((activeMs: number) => {
    setState(prev => touch({
      ...prev,
      session: updateSessionForUndo(prev.session, Math.max(prev.session.activeMs, activeMs)),
    }));
  }, []);

  const recordGameStarted = useCallback((mode: PlayMode) => {
    setState(prev => {
      const sessionMode = prev.session.mode === 'long-session' ? 'long-session' : mode;
      return touch({
        ...prev,
        finishCurrentGameOnly: undefined,
        stopAfterCurrentGame: undefined,
        remindAfterCurrentGame: undefined,
        session: {
          ...prev.session,
          mode: sessionMode,
          gamesStarted: prev.session.gamesStarted + 1,
          stockRecyclesThisGame: 0,
          movesSinceProgress: 0,
          lastProgressAtActiveMs: prev.session.activeMs,
        },
      });
    });
  }, []);

  const recordGameAbandoned = useCallback((activeMs: number) => {
    setState(prev => touch({
      ...prev,
      softNudgeDismissedForSessionId: prev.remindAfterCurrentGame
        ? undefined
        : prev.softNudgeDismissedForSessionId,
      remindAfterCurrentGame: undefined,
      session: {
        ...prev.session,
        activeMs: Math.max(prev.session.activeMs, activeMs),
        abandonedGames: prev.session.abandonedGames + 1,
        stockRecyclesThisGame: 0,
      },
    }));
  }, []);

  const recordLoss = useCallback((activeMs: number) => {
    setState(prev => touch({
      ...prev,
      softNudgeDismissedForSessionId: prev.remindAfterCurrentGame
        ? undefined
        : prev.softNudgeDismissedForSessionId,
      remindAfterCurrentGame: undefined,
      session: {
        ...prev.session,
        activeMs: Math.max(prev.session.activeMs, activeMs),
        losses: prev.session.losses + 1,
        stockRecyclesThisGame: 0,
      },
    }));
  }, []);

  const recordWin = useCallback((activeMs: number, mode: PlayMode) => {
    setState(prev => {
      return touch({
        ...prev,
        softNudgeDismissedForSessionId: prev.remindAfterCurrentGame
          ? undefined
          : prev.softNudgeDismissedForSessionId,
        finishCurrentGameOnly: undefined,
        stopAfterCurrentGame: undefined,
        remindAfterCurrentGame: undefined,
        session: {
          ...prev.session,
          mode: prev.session.mode === 'long-session' ? 'long-session' : mode,
          activeMs: Math.max(prev.session.activeMs, activeMs),
          wins: prev.session.wins + 1,
          wonGameThisSession: true,
          progressEvents: prev.session.progressEvents + 1,
          lastProgressAtActiveMs: Math.max(prev.session.activeMs, activeMs),
          movesSinceProgress: 0,
          stockRecyclesThisGame: 0,
        },
      });
    });
  }, []);

  const recordDailyCompleted = useCallback(() => {
    setState(prev => touch({
      ...prev,
      session: {
        ...prev.session,
        dailyCompletedThisSession: true,
      },
    }));
  }, []);

  const dismissSoftNudge = useCallback(() => {
    setState(prev => touch({
      ...prev,
      softNudgeDismissedForSessionId: prev.session.id,
      remindAfterCurrentGame: undefined,
    }));
  }, []);

  const remindAfterThisGame = useCallback(() => {
    setState(prev => touch({
      ...prev,
      softNudgeDismissedForSessionId: prev.session.id,
      remindAfterCurrentGame: true,
    }));
  }, []);

  const stopAfterThisGame = useCallback(() => {
    setState(prev => touch({
      ...prev,
      softNudgeDismissedForSessionId: prev.session.id,
      stopAfterCurrentGame: true,
      remindAfterCurrentGame: undefined,
    }));
  }, []);

  const stopNow = useCallback(() => {
    setState(prev => touch({
      ...prev,
      finishCurrentGameOnly: undefined,
      stopAfterCurrentGame: undefined,
      remindAfterCurrentGame: undefined,
    }));
  }, []);

  const continueAfterBreak = useCallback(() => {
    setState(prev => {
      const readyAt = prev.breakReadyAt ?? 0;
      if (readyAt > Date.now()) return prev;

      return touch({
        ...prev,
        breakReadyAt: undefined,
        remindAfterCurrentGame: undefined,
        breakSnoozedUntilActiveMs: prev.session.activeMs + LIMITS.continueBudgetMs,
        session: {
          ...prev.session,
          overrides: prev.session.overrides + 1,
        },
      });
    });
  }, []);

  const finishCurrentGame = useCallback(() => {
    setState(prev => touch({
      ...prev,
      finishCurrentGameOnly: true,
      remindAfterCurrentGame: undefined,
      intentSnoozedUntilActiveMs: prev.session.activeMs + LIMITS.continueBudgetMs,
      session: {
        ...prev.session,
        overrides: prev.session.overrides + 1,
      },
    }));
  }, []);

  const continueIntentionally = useCallback(() => {
    setState(prev => touch({
      ...prev,
      intentSnoozedUntilActiveMs: prev.session.activeMs + LIMITS.continueBudgetMs,
      session: {
        ...prev.session,
        overrides: prev.session.overrides + 1,
      },
    }));
  }, []);

  const startLongSession = useCallback((budgetMs: number, reason: LongSessionReason) => {
    const now = Date.now();
    setState(prev => {
      saveCompletedSession(completeSession(prev.session));
      return touch({
        ...clearGateDeferrals(prev),
        lockUntil: undefined,
        lockReason: undefined,
        longSessionUntil: now + budgetMs,
        finishCurrentGameOnly: undefined,
        stopAfterCurrentGame: undefined,
        softNudgeDismissedForSessionId: undefined,
        remindAfterCurrentGame: undefined,
        session: createPlaySession('long-session', now, {
          reason,
          longSessionBudgetMs: budgetMs,
        }),
      });
    });
  }, []);

  const endLongSession = useCallback(() => {
    setState(prev => {
      saveCompletedSession(completeSession(prev.session));
      return touch({
        ...clearGateDeferrals(prev),
        session: createPlaySession('normal', Date.now()),
        lockUntil: undefined,
        lockReason: undefined,
        longSessionUntil: undefined,
        finishCurrentGameOnly: undefined,
        stopAfterCurrentGame: undefined,
        softNudgeDismissedForSessionId: undefined,
        remindAfterCurrentGame: undefined,
      });
    });
  }, []);

  const acknowledgeLongSessionCheckIn = useCallback(() => {
    setState(prev => touch({
      ...prev,
      session: {
        ...prev.session,
        longSessionLastCheckInAtActiveMs: prev.session.activeMs,
      },
    }));
  }, []);

  const applyDebugScenario = useCallback((scenarioId: LimitDebugScenarioId) => {
    const debugNow = Date.now();
    setNow(debugNow);
    setState(createDebugLimitState(scenarioId, debugNow));
  }, []);

  const resetLimitState = useCallback(() => {
    const resetNow = Date.now();
    setNow(resetNow);
    setState(createInitialLimitState(resetNow));
  }, []);

  const controls: PlayLimiterControls = useMemo(() => ({
    canMakeMove,
    canStartGame,
    recordMove,
    recordUndo,
    recordGameStarted,
    recordGameAbandoned,
    recordLoss,
    recordWin,
    recordDailyCompleted,
  }), [
    canMakeMove,
    canStartGame,
    recordMove,
    recordUndo,
    recordGameStarted,
    recordGameAbandoned,
    recordLoss,
    recordWin,
    recordDailyCompleted,
  ]);

  const dailyNormalActiveMs = state.dailyNormalActiveMsByDate[todayKey] ?? 0;
  const snapshot: LimitSnapshot = useMemo(() => {
    const longSessionActive = Boolean(state.longSessionUntil && state.longSessionUntil > now) || state.session.mode === 'long-session';
    const overLimit = state.session.activeMs >= LIMITS.softLimitMs || state.session.gamesStarted >= LIMITS.gameCountLimit;
    const promptDue = !longSessionActive && overLimit;
    const statusTone: LimitSnapshot['statusTone'] = longSessionActive
      ? 'blue'
      : promptDue
        ? 'amber'
        : 'green';

    return {
      isLoaded,
      session: state.session,
      gate,
      dailyNormalActiveMs,
      todayKey,
      statusLabel: formatStatus(state.session, dailyNormalActiveMs),
      statusTone,
      longSessionActive,
      promptDue,
      promptReason: sessionPromptReason(state.session),
      finishCurrentGameOnly: Boolean(state.finishCurrentGameOnly),
      stopAfterCurrentGame: Boolean(state.stopAfterCurrentGame),
    };
  }, [dailyNormalActiveMs, gate, isLoaded, now, state.finishCurrentGameOnly, state.longSessionUntil, state.session, state.stopAfterCurrentGame, todayKey]);

  return {
    snapshot,
    controls,
    syncActiveGame,
    dismissSoftNudge,
    remindAfterThisGame,
    stopAfterThisGame,
    stopNow,
    continueAfterBreak,
    finishCurrentGame,
    continueIntentionally,
    startLongSession,
    endLongSession,
    acknowledgeLongSessionCheckIn,
    applyDebugScenario,
    resetLimitState,
  };
}
