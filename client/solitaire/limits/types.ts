import type { GameState, Move, MoveType } from '../engine/types';

export type PlayMode = 'normal' | 'daily' | 'long-session';

export type LongSessionReason =
  | 'travel'
  | 'waiting-room'
  | 'sick-day'
  | 'planned-leisure'
  | 'other';

export type LimitGateStage = 'green';

export type LimitDebugScenarioId =
  | 'green'
  | 'over-time'
  | 'over-games'
  | 'many-restarts'
  | 'long-session';

export interface LimitDebugScenario {
  id: LimitDebugScenarioId;
  label: string;
  description: string;
}

export interface LimitPolicy {
  softLimitMs: number;
  gameCountLimit: number;
  manyRestartsGameCount: number;
  softNudgeMs: number;
  breakGateMs: number;
  intentGateMs: number;
  normalHardCapMs: number;
  normalDailyCapMs: number;
  progressDroughtMs: number;
  progressDroughtMoves: number;
  recycleWarningCount: number;
  drawRecycleRatioWindow: number;
  drawRecycleRatioLimit: number;
  breakPauseMs: number;
  continueBudgetMs: number;
  shortCooldownMs: number;
  longCooldownMs: number;
  longSessionBudgetsMs: number[];
  longSessionCheckInMs: number;
}

export interface PlaySession {
  id: string;
  startedAt: number;
  endedAt?: number;
  mode: PlayMode;
  reason?: LongSessionReason;
  activeMs: number;
  gamesStarted: number;
  wins: number;
  losses: number;
  abandonedGames: number;
  moves: number;
  stockDraws: number;
  stockRecycles: number;
  undoCount: number;
  foundationMoves: number;
  tableauProgressMoves: number;
  progressEvents: number;
  overrides: number;
  doomScoreMax: number;
  lastProgressAtActiveMs: number;
  movesSinceProgress: number;
  stockRecyclesThisGame: number;
  recentMoveTypes: MoveType[];
  recentActions: Array<MoveType | 'undo'>;
  wonGameThisSession: boolean;
  dailyCompletedThisSession: boolean;
  longSessionBudgetMs?: number;
  longSessionStartedAtActiveMs?: number;
  longSessionLastCheckInAtActiveMs?: number;
}

export interface PersistedLimitState {
  id: 'current';
  session: PlaySession;
  dailyNormalActiveMsByDate: Record<string, number>;
  softNudgeDismissedForSessionId?: string;
  breakSnoozedUntilActiveMs?: number;
  intentSnoozedUntilActiveMs?: number;
  breakReadyAt?: number;
  lockUntil?: number;
  lockReason?: string;
  finishCurrentGameOnly?: boolean;
  stopAfterCurrentGame?: boolean;
  remindAfterCurrentGame?: boolean;
  lastSyncedGameKey?: string;
  lastSyncedGameActiveMs?: number;
  longSessionUntil?: number;
  updatedAt: number;
}

export interface DoomSignal {
  id: string;
  label: string;
  points: number;
}

export interface DoomScoreResult {
  score: number;
  signals: DoomSignal[];
}

export interface LimitGate {
  stage: LimitGateStage;
  blocksMoves: boolean;
  blocksNewGames: boolean;
  title: string;
  message: string;
  reasons: string[];
  doomScore: number;
  cooldownUntil?: number;
  countdownUntil?: number;
}

export interface LimitMoveInput {
  prev: GameState;
  move: Move;
  next: GameState;
  activeMs: number;
  playingDaily: boolean;
}

export interface PlayLimiterControls {
  canMakeMove: () => boolean;
  canStartGame: (mode?: PlayMode) => boolean;
  recordMove: (input: LimitMoveInput) => void;
  recordUndo: (activeMs: number) => void;
  recordGameStarted: (mode: PlayMode) => void;
  recordGameAbandoned: (activeMs: number) => void;
  recordLoss: (activeMs: number) => void;
  recordWin: (activeMs: number, mode: PlayMode) => void;
  recordDailyCompleted: () => void;
}

export interface LimitSnapshot {
  isLoaded: boolean;
  session: PlaySession;
  gate: LimitGate;
  dailyNormalActiveMs: number;
  todayKey: string;
  statusLabel: string;
  statusTone: 'green' | 'amber' | 'red' | 'blue';
  longSessionActive: boolean;
  promptDue: boolean;
  promptReason: string;
  finishCurrentGameOnly: boolean;
  stopAfterCurrentGame: boolean;
}
