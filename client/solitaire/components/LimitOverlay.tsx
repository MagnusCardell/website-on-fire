import React from 'react';
import { LIMITS } from '../limits/policy';
import type { LimitSnapshot, LongSessionReason } from '../limits/types';

interface LimitOverlayProps {
  snapshot: LimitSnapshot;
  showContinuePrompt: boolean;
  showLongSessionSetup: boolean;
  onCloseContinuePrompt: () => void;
  onCloseLongSessionSetup: () => void;
  onOpenLongSessionSetup: () => void;
  onStopNow: () => void;
  onOneMoreGame: () => void;
  onStartLongSession: (budgetMs: number, reason: LongSessionReason) => void;
  onEndLongSession: () => void;
}

function budgetLabel(ms: number): string {
  if (ms >= 24 * 60 * 60_000) return 'Today';
  return `${Math.round(ms / (60 * 60_000))} hours`;
}

export function LimitOverlay({
  snapshot,
  showContinuePrompt,
  showLongSessionSetup,
  onCloseContinuePrompt,
  onCloseLongSessionSetup,
  onOpenLongSessionSetup,
  onStopNow,
  onOneMoreGame,
  onStartLongSession,
  onEndLongSession,
}: LimitOverlayProps) {
  if (!showContinuePrompt && !showLongSessionSetup) {
    return null;
  }

  const showingLongSession = showLongSessionSetup;

  return (
    <div className='absolute inset-0 z-40 flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-[2px]'>
      <div className='w-full max-w-md rounded-lg border border-green-200/30 bg-green-950/95 p-4 shadow-2xl'>
        {showingLongSession ? (
          <div>
            <div className='flex items-start justify-between gap-3'>
              <div>
                <h2 className='text-lg font-semibold text-white'>Long session</h2>
                <p className='mt-1 text-sm text-white/75'>
                  Long session mode disables reminders for a while.
                </p>
              </div>
              <button
                onClick={onCloseLongSessionSetup}
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
                    onCloseLongSessionSetup();
                  }}
                  className='w-full rounded-lg bg-blue-100 px-3 py-2 text-sm font-medium text-blue-950 hover:bg-white'
                >
                  End long session
                </button>
              </div>
            ) : (
              <div className='mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3'>
                {LIMITS.longSessionBudgetsMs.map(budget => (
                  <button
                    key={budget}
                    onClick={() => {
                      onStartLongSession(budget, 'planned-leisure');
                      onCloseLongSessionSetup();
                    }}
                    className='rounded-lg bg-blue-100 px-3 py-2 text-sm font-medium text-blue-950 hover:bg-white'
                  >
                    {budgetLabel(budget)}
                  </button>
                ))}
                <button
                  onClick={onCloseLongSessionSetup}
                  className='rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15 sm:col-span-3'
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className='flex items-start justify-between gap-3'>
              <div>
                <h2 className='text-lg font-semibold text-white'>Next game?</h2>
                <p className='mt-1 text-sm text-white/75'>{snapshot.promptReason}</p>
              </div>
              <div className='rounded-full border border-white/15 bg-black/20 px-2 py-1 text-xs text-white/70'>
                {snapshot.statusLabel}
              </div>
            </div>

            <div className='mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3'>
              <button
                onClick={onStopNow}
                className='rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15'
              >
                Stop for now
              </button>
              <button
                onClick={onOneMoreGame}
                className='rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-950 hover:bg-white'
              >
                One more game
              </button>
              <button
                onClick={() => {
                  onCloseContinuePrompt();
                  onOpenLongSessionSetup();
                }}
                className='rounded-lg bg-blue-100 px-3 py-2 text-sm font-medium text-blue-950 hover:bg-white'
              >
                Long session
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
