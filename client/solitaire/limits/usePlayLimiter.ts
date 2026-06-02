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

  return `${formatMinutes(session.activeMs)} / ${formatMinutes(LIMITS.normalHardCapMs)} · Today ${formatMinutes(dailyNormalActiveMs)} / ${formatMinutes(LIMITS.normalDailyCapMs)}`;
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
      setState(
        persisted?.lockUntil && persisted.lockUntil <= loadNow
          ? clearLockedSession(persisted, loadNow)
          : persisted ?? createInitialLimitState(loadNow)
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
    if (!isLoaded || !state.lockUntil || state.lockUntil > now) return;

    setState(prev => {
      const resetNow = Date.now();
      if (!prev.lockUntil || prev.lockUntil > resetNow) return prev;

      saveCompletedSession(completeSession(prev.session));
      return touch(clearLockedSession(prev, resetNow));
    });
  }, [isLoaded, now, state.lockUntil]);

  useEffect(() => {
    if (!isLoaded) return;

    if (gate.stage === 'break-gate' && !state.breakReadyAt) {
      setState(prev => touch({ ...prev, breakReadyAt: Date.now() + LIMITS.breakPauseMs }));
    }

    if (gate.stage !== 'break-gate' && state.breakReadyAt) {
      setState(prev => touch({ ...prev, breakReadyAt: undefined }));
    }
  }, [gate.stage, isLoaded, state.breakReadyAt]);

  useEffect(() => {
    if (!isLoaded) return;
    if (state.lockUntil && state.lockUntil <= now) return;

    if (gate.stage === 'normal-lock' && gate.cooldownUntil && (!state.lockUntil || state.lockUntil < now)) {
      setState(prev => touch({
        ...prev,
        lockUntil: gate.cooldownUntil,
        lockReason: gate.reasons[0] ?? 'normal play limit reached',
      }));
    }
  }, [gate.stage, gate.cooldownUntil, gate.reasons, isLoaded, now, state.lockUntil]);

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
    return !gateRef.current.blocksMoves;
  }, []);

  const canStartGame = useCallback((mode: PlayMode = 'normal') => {
    const current = stateRef.current;
    const currentGate = gateRef.current;

    if (mode === 'long-session') return true;
    if (current.finishCurrentGameOnly || current.stopAfterCurrentGame) return false;
    return !currentGate.blocksNewGames;
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
      const shouldPause = prev.stopAfterCurrentGame || prev.finishCurrentGameOnly;
      return touch({
        ...prev,
        softNudgeDismissedForSessionId: prev.remindAfterCurrentGame
          ? undefined
          : prev.softNudgeDismissedForSessionId,
        finishCurrentGameOnly: undefined,
        stopAfterCurrentGame: undefined,
        remindAfterCurrentGame: undefined,
        lockUntil: shouldPause ? Date.now() + LIMITS.shortCooldownMs : prev.lockUntil,
        lockReason: shouldPause ? 'stopped after the current game' : prev.lockReason,
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
      lockUntil: Date.now() + LIMITS.shortCooldownMs,
      lockReason: 'stopped at limiter checkpoint',
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
    setState(prev => {
      saveCompletedSession(completeSession(prev.session));
      return touch({
        ...clearGateDeferrals(prev),
        lockUntil: undefined,
        lockReason: undefined,
        finishCurrentGameOnly: undefined,
        stopAfterCurrentGame: undefined,
        softNudgeDismissedForSessionId: undefined,
        remindAfterCurrentGame: undefined,
        session: createPlaySession('long-session', Date.now(), {
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
    const statusTone: LimitSnapshot['statusTone'] = state.session.mode === 'long-session'
      ? 'blue'
      : gate.stage === 'normal-lock' || gate.stage === 'daily-cap' || gate.stage === 'long-session-ended'
        ? 'red'
        : gate.stage === 'soft-nudge' || gate.stage === 'break-gate' || gate.stage === 'intent-gate'
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
      longSessionActive: state.session.mode === 'long-session',
      finishCurrentGameOnly: Boolean(state.finishCurrentGameOnly),
      stopAfterCurrentGame: Boolean(state.stopAfterCurrentGame),
    };
  }, [dailyNormalActiveMs, gate, isLoaded, state.finishCurrentGameOnly, state.session, state.stopAfterCurrentGame, todayKey]);

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
