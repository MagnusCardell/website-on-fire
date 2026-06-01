import type { GameState, Move, MoveType } from '../engine/types';
import { canAutocomplete, checkWin, getLegalMoves } from '../engine/rules';
import type {
  DoomScoreResult,
  LimitGate,
  LimitMoveInput,
  LimitPolicy,
  PersistedLimitState,
  PlayMode,
  PlaySession,
} from './types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const MAX_RECENT_ACTIONS = 60;

export const LIMITS: LimitPolicy = {
  softNudgeMs: 20 * MINUTE,
  breakGateMs: 35 * MINUTE,
  intentGateMs: 50 * MINUTE,
  normalHardCapMs: 75 * MINUTE,
  normalDailyCapMs: 90 * MINUTE,
  progressDroughtMs: 8 * MINUTE,
  progressDroughtMoves: 25,
  recycleWarningCount: 5,
  drawRecycleRatioWindow: 50,
  drawRecycleRatioLimit: 0.65,
  breakPauseMs: 60_000,
  continueBudgetMs: 15 * MINUTE,
  shortCooldownMs: 30 * MINUTE,
  longCooldownMs: 2 * HOUR,
  longSessionBudgetsMs: [2 * HOUR, 4 * HOUR, 8 * HOUR],
  longSessionCheckInMs: 45 * MINUTE,
};

export function getTodayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createPlaySession(
  mode: PlayMode = 'normal',
  now = Date.now(),
  options: Pick<PlaySession, 'reason' | 'longSessionBudgetMs'> = {}
): PlaySession {
  return {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: now,
    mode,
    reason: options.reason,
    activeMs: 0,
    gamesStarted: 0,
    wins: 0,
    losses: 0,
    abandonedGames: 0,
    moves: 0,
    stockDraws: 0,
    stockRecycles: 0,
    undoCount: 0,
    foundationMoves: 0,
    tableauProgressMoves: 0,
    progressEvents: 0,
    overrides: 0,
    doomScoreMax: 0,
    lastProgressAtActiveMs: 0,
    movesSinceProgress: 0,
    stockRecyclesThisGame: 0,
    recentMoveTypes: [],
    recentActions: [],
    wonGameThisSession: false,
    dailyCompletedThisSession: false,
    longSessionStartedAtActiveMs: mode === 'long-session' ? 0 : undefined,
    longSessionLastCheckInAtActiveMs: mode === 'long-session' ? 0 : undefined,
    longSessionBudgetMs: options.longSessionBudgetMs,
  };
}

export function createInitialLimitState(now = Date.now()): PersistedLimitState {
  return {
    id: 'current',
    session: createPlaySession('normal', now),
    dailyNormalActiveMsByDate: {},
    updatedAt: now,
  };
}

function foundationCardCount(state: GameState): number {
  return state.foundations.reduce((total, pile) => total + pile.length, 0);
}

function faceDownTableauCardCount(state: GameState): number {
  return state.tableau.reduce(
    (total, pile) => total + pile.filter(card => !card.faceUp).length,
    0
  );
}

function legalNonDrawMoveCount(state: GameState): number {
  return getLegalMoves(state).filter(move => move.type !== 'draw' && move.type !== 'recycle').length;
}

export function detectProgress({ prev, move, next }: LimitMoveInput): string[] {
  const reasons: string[] = [];
  const foundationBefore = foundationCardCount(prev);
  const foundationAfter = foundationCardCount(next);
  const faceDownBefore = faceDownTableauCardCount(prev);
  const faceDownAfter = faceDownTableauCardCount(next);

  if (foundationAfter > foundationBefore) {
    reasons.push('foundation card added');
  }

  if (faceDownAfter < faceDownBefore) {
    reasons.push('tableau card revealed');
  }

  if (prev.stock.length > next.stock.length && legalNonDrawMoveCount(next) > legalNonDrawMoveCount(prev)) {
    reasons.push('stock draw opened a non-draw move');
  }

  if (next.gameStatus === 'won' || checkWin(next)) {
    reasons.push('game won');
  }

  if (!canAutocomplete(prev) && canAutocomplete(next)) {
    reasons.push('cleanup became available');
  }

  if (
    move.type === 'tableau-to-tableau' &&
    move.flippedCardId &&
    !reasons.includes('tableau card revealed')
  ) {
    reasons.push('tableau card revealed');
  }

  return reasons;
}

function drawRecycleRatio(session: PlaySession, policy: LimitPolicy): number {
  const window = session.recentMoveTypes.slice(-policy.drawRecycleRatioWindow);
  if (window.length === 0) return 0;

  const drawRecycleCount = window.filter(type => type === 'draw' || type === 'recycle').length;
  return drawRecycleCount / window.length;
}

function undoPingPongPairsLast30(session: PlaySession): number {
  const recent = session.recentActions.slice(-30);
  let count = 0;

  for (let i = 1; i < recent.length; i++) {
    if (recent[i] === 'undo' && recent[i - 1] !== 'undo') {
      count++;
    }
  }

  return count;
}

export function calculateDoomScore(
  session: PlaySession,
  policy: LimitPolicy = LIMITS
): DoomScoreResult {
  const signals: DoomScoreResult['signals'] = [];
  const activeMs = session.activeMs;
  const timeSinceProgress = Math.max(0, activeMs - session.lastProgressAtActiveMs);
  const ratio = drawRecycleRatio(session, policy);
  const undoPingPongPairs = undoPingPongPairsLast30(session);

  if (activeMs > 25 * MINUTE) {
    signals.push({ id: 'active-25', label: '25+ min active play', points: 1 });
  }

  if (activeMs > 45 * MINUTE) {
    signals.push({ id: 'active-45', label: '45+ min active play', points: 1 });
  }

  if (timeSinceProgress > policy.progressDroughtMs && session.movesSinceProgress > policy.progressDroughtMoves) {
    signals.push({
      id: 'progress-drought',
      label: `${Math.round(timeSinceProgress / MINUTE)} min and ${session.movesSinceProgress} moves without progress`,
      points: 2,
    });
  }

  if (session.stockRecyclesThisGame >= policy.recycleWarningCount) {
    signals.push({
      id: 'recycle-churn',
      label: `${session.stockRecyclesThisGame} stock cycles this game`,
      points: 1,
    });
  }

  if (
    session.recentMoveTypes.length >= Math.min(10, policy.drawRecycleRatioWindow) &&
    ratio > policy.drawRecycleRatioLimit
  ) {
    signals.push({
      id: 'draw-recycle-ratio',
      label: `${Math.round(ratio * 100)}% draw/recycle moves recently`,
      points: 1,
    });
  }

  if (session.abandonedGames >= 2) {
    signals.push({ id: 'abandoned-games', label: `${session.abandonedGames} abandoned games`, points: 1 });
  }

  if (session.losses >= 3) {
    signals.push({ id: 'losses', label: `${session.losses} losses this session`, points: 1 });
  }

  if (undoPingPongPairs >= 5) {
    signals.push({ id: 'undo-ping-pong', label: `${undoPingPongPairs} undo loops recently`, points: 1 });
  }

  if (session.overrides >= 2) {
    signals.push({ id: 'override-chain', label: `${session.overrides} limit overrides`, points: 2 });
  }

  if (session.wonGameThisSession) {
    signals.push({ id: 'won-game', label: 'win this session', points: -1 });
  }

  if (session.mode === 'daily' || session.dailyCompletedThisSession) {
    signals.push({ id: 'daily', label: 'daily challenge context', points: -1 });
  }

  if (session.mode === 'long-session') {
    signals.push({ id: 'long-session', label: 'long session pass active', points: -4 });
  }

  const score = Math.max(0, signals.reduce((total, signal) => total + signal.points, 0));
  return { score, signals };
}

function activeMinutes(ms: number): number {
  return Math.floor(ms / MINUTE);
}

function gate(
  stage: LimitGate['stage'],
  input: Omit<LimitGate, 'stage'>
): LimitGate {
  return { stage, ...input };
}

export function evaluateLimitState(
  state: PersistedLimitState,
  now = Date.now(),
  todayKey = getTodayKey(),
  policy: LimitPolicy = LIMITS
): LimitGate {
  const session = state.session;
  const activeMs = session.activeMs;
  const dailyNormalActiveMs = state.dailyNormalActiveMsByDate[todayKey] ?? 0;
  const doom = calculateDoomScore(session, policy);
  const reasons = doom.signals.filter(signal => signal.points > 0).map(signal => signal.label);

  if (session.mode === 'long-session') {
    const passElapsed = activeMs - (session.longSessionStartedAtActiveMs ?? 0);
    const budgetMs = session.longSessionBudgetMs ?? policy.longSessionBudgetsMs[0];
    const lastCheckIn = session.longSessionLastCheckInAtActiveMs ?? 0;

    if (passElapsed >= budgetMs) {
      return gate('long-session-ended', {
        blocksMoves: true,
        blocksNewGames: true,
        title: 'Long session budget reached',
        message: 'The selected long-session budget is complete.',
        reasons: [`${activeMinutes(passElapsed)} min used from this pass`],
        doomScore: doom.score,
      });
    }

    if (activeMs - lastCheckIn >= policy.longSessionCheckInMs) {
      return gate('long-session-checkin', {
        blocksMoves: true,
        blocksNewGames: true,
        title: 'Long session check-in',
        message: 'You chose a long session. Check that this still matches your plan.',
        reasons: [`${activeMinutes(passElapsed)} min used from this pass`],
        doomScore: doom.score,
      });
    }

    return gate('green', {
      blocksMoves: false,
      blocksNewGames: false,
      title: 'Long session active',
      message: 'Long session pass is active.',
      reasons: [],
      doomScore: doom.score,
    });
  }

  if (state.lockUntil && state.lockUntil > now) {
    return gate('normal-lock', {
      blocksMoves: true,
      blocksNewGames: true,
      title: 'Normal play is paused',
      message: 'Your current game is saved and normal play can resume after the cooldown.',
      reasons: state.lockReason ? [state.lockReason] : reasons,
      doomScore: doom.score,
      cooldownUntil: state.lockUntil,
    });
  }

  if (dailyNormalActiveMs >= policy.normalDailyCapMs) {
    return gate('daily-cap', {
      blocksMoves: true,
      blocksNewGames: true,
      title: 'Daily normal-mode cap reached',
      message: 'Normal mode is unavailable until tomorrow unless you start a long session pass.',
      reasons: [`${activeMinutes(dailyNormalActiveMs)} min normal-mode play today`],
      doomScore: doom.score,
    });
  }

  const hardLockReason = activeMs >= policy.normalHardCapMs
    ? `${activeMinutes(activeMs)} min active play`
    : doom.score >= 5
      ? reasons.join(', ') || `doom score ${doom.score}`
      : session.overrides >= 3
        ? `${session.overrides} intent overrides`
        : '';

  if (hardLockReason) {
    return gate('normal-lock', {
      blocksMoves: true,
      blocksNewGames: true,
      title: 'Normal play is paused',
      message: 'Your game is saved. Take a cooldown before normal play resumes.',
      reasons: [hardLockReason],
      doomScore: doom.score,
      cooldownUntil: now + policy.shortCooldownMs,
    });
  }

  const intentSnoozed = state.intentSnoozedUntilActiveMs !== undefined && activeMs < state.intentSnoozedUntilActiveMs;
  if (!intentSnoozed && (activeMs >= policy.intentGateMs || doom.score >= 3)) {
    return gate('intent-gate', {
      blocksMoves: true,
      blocksNewGames: true,
      title: 'Continue intentionally?',
      message: 'This looks like loop play. Choose how you want to proceed.',
      reasons: reasons.length > 0 ? reasons : [`${activeMinutes(activeMs)} min active play`],
      doomScore: doom.score,
    });
  }

  const breakSnoozed = state.breakSnoozedUntilActiveMs !== undefined && activeMs < state.breakSnoozedUntilActiveMs;
  const churnGames = session.abandonedGames + session.losses;
  if (!breakSnoozed && (activeMs >= policy.breakGateMs || session.gamesStarted >= 2 || churnGames >= 2)) {
    return gate('break-gate', {
      blocksMoves: true,
      blocksNewGames: true,
      title: 'Break checkpoint',
      message: 'You can continue, but first look away for a short pause.',
      reasons: [
        activeMs >= policy.breakGateMs ? `${activeMinutes(activeMs)} min active play` : '',
        session.gamesStarted >= 2 ? `${session.gamesStarted} games started` : '',
        churnGames >= 2 ? `${churnGames} abandoned or lost games` : '',
      ].filter(Boolean),
      doomScore: doom.score,
      countdownUntil: state.breakReadyAt,
    });
  }

  const softNudgeDismissed = state.softNudgeDismissedForSessionId === session.id;
  if (!softNudgeDismissed && (activeMs >= policy.softNudgeMs || session.dailyCompletedThisSession)) {
    return gate('soft-nudge', {
      blocksMoves: false,
      blocksNewGames: false,
      title: 'Good stopping point soon',
      message: 'Finish this game, then take a break?',
      reasons: [
        activeMs >= policy.softNudgeMs ? `${activeMinutes(activeMs)} min active play` : '',
        session.dailyCompletedThisSession ? 'today\'s daily completed' : '',
      ].filter(Boolean),
      doomScore: doom.score,
    });
  }

  return gate('green', {
    blocksMoves: false,
    blocksNewGames: false,
    title: 'Within normal limits',
    message: 'No limiter action needed.',
    reasons: [],
    doomScore: doom.score,
  });
}

export function updateSessionForMove(
  session: PlaySession,
  input: LimitMoveInput,
  policy: LimitPolicy = LIMITS
): PlaySession {
  const progressReasons = detectProgress(input);
  const progressed = progressReasons.length > 0;
  const recentMoveTypes = [...session.recentMoveTypes, input.move.type].slice(-policy.drawRecycleRatioWindow);
  const recentActions: PlaySession['recentActions'] = [...session.recentActions, input.move.type].slice(-MAX_RECENT_ACTIONS);
  const foundationMove = input.move.to.pile === 'foundation';
  const tableauProgressMove = progressReasons.includes('tableau card revealed');

  const nextSession: PlaySession = {
    ...session,
    activeMs: Math.max(session.activeMs, input.activeMs),
    moves: session.moves + 1,
    stockDraws: session.stockDraws + (input.move.type === 'draw' ? 1 : 0),
    stockRecycles: session.stockRecycles + (input.move.type === 'recycle' ? 1 : 0),
    foundationMoves: session.foundationMoves + (foundationMove ? 1 : 0),
    tableauProgressMoves: session.tableauProgressMoves + (tableauProgressMove ? 1 : 0),
    progressEvents: session.progressEvents + (progressed ? 1 : 0),
    lastProgressAtActiveMs: progressed ? input.activeMs : session.lastProgressAtActiveMs,
    movesSinceProgress: progressed ? 0 : session.movesSinceProgress + 1,
    stockRecyclesThisGame: input.move.type === 'recycle'
      ? session.stockRecyclesThisGame + 1
      : session.stockRecyclesThisGame,
    recentMoveTypes,
    recentActions,
  };

  const doom = calculateDoomScore(nextSession, policy);
  return {
    ...nextSession,
    doomScoreMax: Math.max(nextSession.doomScoreMax, doom.score),
  };
}

export function updateSessionForUndo(session: PlaySession, activeMs: number): PlaySession {
  const nextSession: PlaySession = {
    ...session,
    activeMs: Math.max(session.activeMs, activeMs),
    undoCount: session.undoCount + 1,
    recentActions: [...session.recentActions, 'undo'].slice(-MAX_RECENT_ACTIONS) as PlaySession['recentActions'],
  };
  const doom = calculateDoomScore(nextSession);
  return { ...nextSession, doomScoreMax: Math.max(nextSession.doomScoreMax, doom.score) };
}

export function isBlockingGate(gate: LimitGate): boolean {
  return gate.blocksMoves || gate.blocksNewGames;
}
