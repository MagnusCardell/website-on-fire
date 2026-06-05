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
  softLimitMs: 60 * MINUTE,
  gameCountLimit: 5,
  manyRestartsGameCount: 7,
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
  longSessionBudgetsMs: [2 * HOUR, 4 * HOUR, 24 * HOUR],
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
  return { score: 0, signals: [] };
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

  return gate('green', {
    blocksMoves: false,
    blocksNewGames: false,
    title: 'Within normal limits',
    message: 'No limiter action needed.',
    reasons: [],
    doomScore: 0,
  });
}

export function updateSessionForMove(
  session: PlaySession,
  input: LimitMoveInput,
  policy: LimitPolicy = LIMITS
): PlaySession {
  const recentMoveTypes = [...session.recentMoveTypes, input.move.type].slice(-policy.drawRecycleRatioWindow);
  const recentActions: PlaySession['recentActions'] = [...session.recentActions, input.move.type].slice(-MAX_RECENT_ACTIONS);
  const foundationMove = input.move.to.pile === 'foundation';

  return {
    ...session,
    activeMs: Math.max(session.activeMs, input.activeMs),
    moves: session.moves + 1,
    stockDraws: session.stockDraws + (input.move.type === 'draw' ? 1 : 0),
    stockRecycles: session.stockRecycles + (input.move.type === 'recycle' ? 1 : 0),
    foundationMoves: session.foundationMoves + (foundationMove ? 1 : 0),
    tableauProgressMoves: session.tableauProgressMoves,
    progressEvents: session.progressEvents,
    lastProgressAtActiveMs: session.lastProgressAtActiveMs,
    movesSinceProgress: session.movesSinceProgress,
    stockRecyclesThisGame: input.move.type === 'recycle'
      ? session.stockRecyclesThisGame + 1
      : session.stockRecyclesThisGame,
    recentMoveTypes,
    recentActions,
  };
}

export function updateSessionForUndo(session: PlaySession, activeMs: number): PlaySession {
  return {
    ...session,
    activeMs: Math.max(session.activeMs, activeMs),
    undoCount: session.undoCount + 1,
    recentActions: [...session.recentActions, 'undo'].slice(-MAX_RECENT_ACTIONS) as PlaySession['recentActions'],
  };
}

export function isBlockingGate(gate: LimitGate): boolean {
  return gate.blocksMoves || gate.blocksNewGames;
}
