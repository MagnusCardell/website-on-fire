import React, { useEffect, useMemo, useState } from 'react';
import { LIMITS } from '../limits/policy';
import type { LimitSnapshot, LongSessionReason } from '../limits/types';
import { cn } from '../lib/utils';

const INTENT_PHRASE = 'I choose to continue';
const LONG_SESSION_PHRASE = 'I am choosing a long session';
const HIGH_FRICTION_DELAY_MS = 90_000;

const reasonLabels: Array<{ value: LongSessionReason; label: string }> = [
  { value: 'travel', label: 'Travel' },
  { value: 'waiting-room', label: 'Waiting room' },
  { value: 'sick-day', label: 'Sick day' },
  { value: 'planned-leisure', label: 'Planned leisure' },
  { value: 'other', label: 'Other' },
];

interface LimitOverlayProps {
  snapshot: LimitSnapshot;
  showLongSessionSetup: boolean;
  onCloseLongSessionSetup: () => void;
  onDismissSoftNudge: () => void;
  onRemindAfterGame: () => void;
  onStopAfterGame: () => void;
  onStopNow: () => void;
  onContinueAfterBreak: () => void;
  onFinishCurrentGame: () => void;
  onContinueIntentionally: () => void;
  onStartLongSession: (budgetMs: number, reason: LongSessionReason) => void;
  onEndLongSession: () => void;
  onAcknowledgeLongSessionCheckIn: () => void;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function budgetLabel(ms: number): string {
  return `${Math.round(ms / (60 * 60_000))}h`;
}

function ReasonList({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) return null;

  return (
    <div className='mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/75'>
      {reasons.slice(0, 4).map(reason => (
        <div key={reason} className='truncate'>{reason}</div>
      ))}
    </div>
  );
}

export function LimitOverlay({
  snapshot,
  showLongSessionSetup,
  onCloseLongSessionSetup,
  onDismissSoftNudge,
  onRemindAfterGame,
  onStopAfterGame,
  onStopNow,
  onContinueAfterBreak,
  onFinishCurrentGame,
  onContinueIntentionally,
  onStartLongSession,
  onEndLongSession,
  onAcknowledgeLongSessionCheckIn,
}: LimitOverlayProps) {
  const [showLongSessionForm, setShowLongSessionForm] = useState(false);
  const [selectedBudgetMs, setSelectedBudgetMs] = useState(LIMITS.longSessionBudgetsMs[0]);
  const [selectedReason, setSelectedReason] = useState<LongSessionReason>('planned-leisure');
  const [intentPhrase, setIntentPhrase] = useState('');
  const [longSessionPhrase, setLongSessionPhrase] = useState('');
  const [formOpenedAt, setFormOpenedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, []);

  const gate = snapshot.gate;
  const showingLongSession = showLongSessionSetup || showLongSessionForm;
  const needsLongSessionFriction = gate.doomScore >= 3 || gate.stage === 'intent-gate' || gate.stage === 'normal-lock';

  useEffect(() => {
    if (showingLongSession) {
      setFormOpenedAt(Date.now());
      setLongSessionPhrase('');
    }
  }, [showingLongSession]);

  const breakRemainingMs = Math.max(0, (gate.countdownUntil ?? 0) - now);
  const cooldownRemainingMs = Math.max(0, (gate.cooldownUntil ?? 0) - now);
  const longSessionDelayRemainingMs = needsLongSessionFriction
    ? Math.max(0, formOpenedAt + HIGH_FRICTION_DELAY_MS - now)
    : 0;

  const canStartLongSession = useMemo(() => {
    if (snapshot.longSessionActive) return false;
    if (needsLongSessionFriction && longSessionPhrase.trim() !== LONG_SESSION_PHRASE) return false;
    return longSessionDelayRemainingMs === 0;
  }, [longSessionDelayRemainingMs, longSessionPhrase, needsLongSessionFriction, snapshot.longSessionActive]);

  const closeLongSessionForm = () => {
    setShowLongSessionForm(false);
    onCloseLongSessionSetup();
  };

  const openLongSessionForm = () => {
    setShowLongSessionForm(true);
    setFormOpenedAt(Date.now());
  };

  if (gate.stage === 'green' && !showingLongSession) {
    return null;
  }

  const panelTone = gate.stage === 'normal-lock' || gate.stage === 'daily-cap' || gate.stage === 'long-session-ended'
    ? 'border-red-400/40 bg-red-950/95'
    : gate.stage === 'soft-nudge'
      ? 'border-amber-400/40 bg-amber-950/95'
      : snapshot.longSessionActive
        ? 'border-blue-400/40 bg-blue-950/95'
        : 'border-green-300/30 bg-green-950/95';

  return (
    <div className='absolute inset-0 z-40 flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-[2px]'>
      <div className={cn('w-full max-w-md rounded-lg border p-4 shadow-2xl', panelTone)}>
        {showingLongSession ? (
          <div>
            <div className='flex items-start justify-between gap-3'>
              <div>
                <h2 className='text-lg font-semibold text-white'>Long Session</h2>
                <p className='mt-1 text-sm text-white/75'>
                  {snapshot.longSessionActive
                    ? 'This pass is active and tracked separately from normal play.'
                    : 'Choose a deliberate active-play budget.'}
                </p>
              </div>
              <button
                onClick={closeLongSessionForm}
                className='rounded-md px-2 py-1 text-sm text-white/70 hover:bg-white/10 hover:text-white'
              >
                Close
              </button>
            </div>

            {snapshot.longSessionActive ? (
              <div className='mt-4 space-y-3'>
                <div className='rounded-lg border border-blue-300/30 bg-blue-900/30 px-3 py-2 text-sm text-blue-50'>
                  {snapshot.statusLabel}
                </div>
                <button
                  onClick={() => {
                    onEndLongSession();
                    closeLongSessionForm();
                  }}
                  className='w-full rounded-lg bg-blue-100 px-3 py-2 text-sm font-medium text-blue-950 hover:bg-white'
                >
                  End pass early
                </button>
              </div>
            ) : (
              <div className='mt-4 space-y-4'>
                <div>
                  <div className='mb-2 text-xs font-medium uppercase tracking-wide text-white/60'>Budget</div>
                  <div className='grid grid-cols-3 gap-2'>
                    {LIMITS.longSessionBudgetsMs.map(budget => (
                      <button
                        key={budget}
                        onClick={() => setSelectedBudgetMs(budget)}
                        className={cn(
                          'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                          selectedBudgetMs === budget
                            ? 'border-blue-200 bg-blue-100 text-blue-950'
                            : 'border-white/15 bg-white/5 text-white hover:bg-white/10'
                        )}
                      >
                        {budgetLabel(budget)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className='mb-2 text-xs font-medium uppercase tracking-wide text-white/60'>Reason</div>
                  <div className='grid grid-cols-2 gap-2'>
                    {reasonLabels.map(reason => (
                      <button
                        key={reason.value}
                        onClick={() => setSelectedReason(reason.value)}
                        className={cn(
                          'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                          selectedReason === reason.value
                            ? 'border-blue-200 bg-blue-100 text-blue-950'
                            : 'border-white/15 bg-white/5 text-white hover:bg-white/10'
                        )}
                      >
                        {reason.label}
                      </button>
                    ))}
                  </div>
                </div>

                {needsLongSessionFriction && (
                  <div className='space-y-2'>
                    <p className='text-xs text-white/70'>
                      Because this follows limiter signals, wait {formatDuration(longSessionDelayRemainingMs)} and type the phrase.
                    </p>
                    <input
                      value={longSessionPhrase}
                      onChange={(event) => setLongSessionPhrase(event.target.value)}
                      className='w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-blue-200'
                      placeholder={LONG_SESSION_PHRASE}
                    />
                  </div>
                )}

                <button
                  onClick={() => {
                    onStartLongSession(selectedBudgetMs, selectedReason);
                    closeLongSessionForm();
                  }}
                  disabled={!canStartLongSession}
                  className={cn(
                    'w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    canStartLongSession
                      ? 'bg-blue-100 text-blue-950 hover:bg-white'
                      : 'cursor-not-allowed bg-white/10 text-white/40'
                  )}
                >
                  Start Long Session
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className='flex items-start justify-between gap-3'>
              <div>
                <h2 className='text-lg font-semibold text-white'>{gate.title}</h2>
                <p className='mt-1 text-sm text-white/75'>{gate.message}</p>
              </div>
              <div className='rounded-full border border-white/15 bg-black/20 px-2 py-1 text-xs text-white/70'>
                {snapshot.statusLabel}
              </div>
            </div>

            <ReasonList reasons={gate.reasons} />

            {gate.stage === 'soft-nudge' && (
              <div className='mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3'>
                <button onClick={onDismissSoftNudge} className='rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15'>
                  Keep playing
                </button>
                <button onClick={onRemindAfterGame} className='rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15'>
                  Remind after this game
                </button>
                <button onClick={onStopAfterGame} className='rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-950 hover:bg-white'>
                  Stop after this game
                </button>
              </div>
            )}

            {gate.stage === 'break-gate' && (
              <div className='mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2'>
                <button
                  onClick={onContinueAfterBreak}
                  disabled={breakRemainingMs > 0}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    breakRemainingMs > 0
                      ? 'cursor-not-allowed bg-white/10 text-white/40'
                      : 'bg-green-100 text-green-950 hover:bg-white'
                  )}
                >
                  {breakRemainingMs > 0 ? `Continue in ${formatDuration(breakRemainingMs)}` : 'Continue 15 min'}
                </button>
                <button onClick={onStopNow} className='rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15'>
                  Stop now
                </button>
              </div>
            )}

            {gate.stage === 'intent-gate' && (
              <div className='mt-4 space-y-3'>
                <input
                  value={intentPhrase}
                  onChange={(event) => setIntentPhrase(event.target.value)}
                  className='w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-amber-200'
                  placeholder={INTENT_PHRASE}
                />
                <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                  <button onClick={onStopNow} className='rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15'>
                    Stop and save
                  </button>
                  <button onClick={onFinishCurrentGame} className='rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15'>
                    Finish current game
                  </button>
                  <button
                    onClick={() => {
                      onContinueIntentionally();
                      setIntentPhrase('');
                    }}
                    disabled={intentPhrase.trim() !== INTENT_PHRASE}
                    className={cn(
                      'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      intentPhrase.trim() === INTENT_PHRASE
                        ? 'bg-amber-100 text-amber-950 hover:bg-white'
                        : 'cursor-not-allowed bg-white/10 text-white/40'
                    )}
                  >
                    Continue intentionally
                  </button>
                  <button onClick={openLongSessionForm} className='rounded-lg bg-blue-100 px-3 py-2 text-sm font-medium text-blue-950 hover:bg-white'>
                    Long Session...
                  </button>
                </div>
              </div>
            )}

            {(gate.stage === 'normal-lock' || gate.stage === 'daily-cap' || gate.stage === 'long-session-ended') && (
              <div className='mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2'>
                <button
                  disabled
                  className='cursor-not-allowed rounded-lg bg-white/10 px-3 py-2 text-sm text-white/45'
                >
                  {gate.stage === 'daily-cap'
                    ? 'Resume tomorrow'
                    : cooldownRemainingMs > 0
                      ? `Resume in ${formatDuration(cooldownRemainingMs)}`
                      : 'Resume later'}
                </button>
                <button onClick={openLongSessionForm} className='rounded-lg bg-blue-100 px-3 py-2 text-sm font-medium text-blue-950 hover:bg-white'>
                  Start Long Session
                </button>
              </div>
            )}

            {gate.stage === 'long-session-checkin' && (
              <div className='mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2'>
                <button onClick={onAcknowledgeLongSessionCheckIn} className='rounded-lg bg-blue-100 px-3 py-2 text-sm font-medium text-blue-950 hover:bg-white'>
                  Continue pass
                </button>
                <button onClick={onEndLongSession} className='rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15'>
                  End pass early
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
