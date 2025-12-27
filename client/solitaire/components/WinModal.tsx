import React, { useEffect, useState } from 'react';
import type { GameStats, Card } from '../engine/types';
import { Trophy, Flame, Clock, Target } from 'lucide-react';
import { cn } from '../lib/utils';
import { BouncingCards } from './BouncingCards';

interface WinModalProps {
  isOpen: boolean;
  stats: GameStats | null;
  gameTime: number;
  moveCount: number;
  foundations: [Card[], Card[], Card[], Card[]];
  onNewGame: () => void;
  onClose: () => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function WinModal({
  isOpen,
  stats,
  gameTime,
  moveCount,
  foundations,
  onNewGame,
  onClose,
}: WinModalProps) {
  const [showBouncing, setShowBouncing] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setShowBouncing(false);
      setShowDialog(false);
      return;
    }

    setShowBouncing(true);
    const t = window.setTimeout(() => setShowDialog(true), 900);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  if (!isOpen) return null;

  const isNewBestTime = stats?.bestTime === gameTime;
  const isMilestoneStreak = stats && stats.currentStreak > 0 && stats.currentStreak % 5 === 0;

  return (

    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        onClick={onClose}
      />

      {/* Bouncing cards above backdrop */}
      <div className="absolute inset-0 z-[5] pointer-events-none">
        <BouncingCards foundations={foundations} isActive={showBouncing} />
      </div>

      <div className="flex items-center justify-center">
        {/* Dialog */}
        {showDialog && (
          <div className='relative bg-gradient-to-b from-green-800 to-green-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full text-white animate-scale-in'>
            <div className='text-center mb-6'>
              <Trophy className='w-16 h-16 mx-auto mb-3 text-amber-400' />
              <h2 className='text-3xl font-bold mb-1'>You Won!</h2>
              <p className='text-green-300/80'>Congratulations!</p>
            </div>

            {/* Stats grid */}
            <div className='grid grid-cols-2 gap-3 mb-6'>
              <div className='bg-green-700/50 rounded-xl p-3 text-center'>
                <Clock className='w-5 h-5 mx-auto mb-1 text-green-300' />
                <div className='text-xl font-bold tabular-nums'>{formatTime(gameTime)}</div>
                <div className='text-xs text-green-300/70'>Time</div>
                {isNewBestTime && (
                  <div className='text-xs text-amber-400 font-medium mt-1'>New Best!</div>
                )}
              </div>

              <div className='bg-green-700/50 rounded-xl p-3 text-center'>
                <Target className='w-5 h-5 mx-auto mb-1 text-green-300' />
                <div className='text-xl font-bold tabular-nums'>{moveCount}</div>
                <div className='text-xs text-green-300/70'>Moves</div>
              </div>

              <div className='bg-green-700/50 rounded-xl p-3 text-center'>
                <Flame className={cn(
                  'w-5 h-5 mx-auto mb-1',
                  isMilestoneStreak ? 'text-orange-400' : 'text-green-300'
                )} />
                <div className={cn(
                  'text-xl font-bold tabular-nums',
                  isMilestoneStreak && 'text-orange-400'
                )}>
                  {stats?.currentStreak ?? 0}
                </div>
                <div className='text-xs text-green-300/70'>Win Streak</div>
              </div>

              <div className='bg-green-700/50 rounded-xl p-3 text-center'>
                <Trophy className='w-5 h-5 mx-auto mb-1 text-amber-400' />
                <div className='text-xl font-bold tabular-nums'>{stats?.wins ?? 0}</div>
                <div className='text-xs text-green-300/70'>Total Wins</div>
              </div>
            </div>

            {/* Milestone celebration */}
            {isMilestoneStreak && (
              <div className='bg-orange-500/20 border border-orange-400/30 rounded-xl p-3 mb-6 text-center'>
                <Flame className='w-6 h-6 mx-auto mb-1 text-orange-400' />
                <div className='text-orange-300 font-medium'>
                  🔥 {stats.currentStreak} Game Win Streak! 🔥
                </div>
              </div>
            )}

            {/* Actions */}
            <button
              onClick={onNewGame}
              className='w-full py-3 bg-amber-500 hover:bg-amber-400 text-amber-900 font-bold rounded-xl transition-colors'
            >
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
