import React, { useEffect, useState } from 'react';
import { Undo2, RotateCcw, BarChart3, Crown, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';
import { DailyCalendarModal } from './DailyCalendarModal';
import { getCrownCount, isDailyCompleted } from '../persistence/dailyChallenge';
import { getKey } from '../engine/solvableSeeds';
import { Clock } from './Clock';
import type { GameClock } from '../hooks/useGameClock';

interface HeaderProps {
  moveCount: number;
  canUndo: boolean;
  onUndo: () => void;
  onNewGame: () => void;
  onShowStats: () => void;
  clock: GameClock;
  gameId: number;
  clockRunning: boolean;
  onStartDaily: () => void;
  isPlayingDaily: boolean;
  limitStatus?: {
    label: string;
    tone: 'green' | 'amber' | 'red' | 'blue';
    onClick: () => void;
  };
}

// The header's colour, solid: green-900 at 80% over the felt's green-800, as it
// looked before, without the transparency. Also the theme colour in index.html.
const HEADER_BACKGROUND = '#14572e';

function formatMoveCount(moveCount: number): string {
  return `${moveCount} ${moveCount === 1 ? 'move' : 'moves'}`;
}

export function Header({
  moveCount,
  canUndo,
  onUndo,
  onNewGame,
  onShowStats,
  clock,
  gameId,
  clockRunning,
  onStartDaily,
  isPlayingDaily,
  limitStatus,
}: HeaderProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [crownCount, setCrownCount] = useState(0);
  const [todayCompleted, setTodayCompleted] = useState(false);
  const [currentDateKey, setCurrentDateKey] = useState(() => getKey(new Date()));

  useEffect(() => {
    async function checkStatus() {
      const today = new Date();
      const todayKey = getKey(today);
      const completed = await isDailyCompleted(todayKey);
      const crowns = await getCrownCount();
      setTodayCompleted(completed);
      setCrownCount(crowns);
      setCurrentDateKey(todayKey);
    }
    checkStatus();

    // Check if the date has changed (midnight crossing)
    const interval = setInterval(() => {
      const nowKey = getKey(new Date());
      if (nowKey !== currentDateKey) {
        checkStatus();
      }
    }, 60_000); // 1min

    return () => clearInterval(interval);
  }, [isPlayingDaily, currentDateKey]);

  // Finger-sized: 44 pt on every current iPhone, 40 pt where the screen is only 375 pt wide
  const controlHeightClass = 'h-10 min-[390px]:h-11';
  const iconButtonClass = cn(
    controlHeightClass,
    'w-10 min-[390px]:w-11 shrink-0 rounded-xl transition-all flex items-center justify-center'
  );
  const passiveButtonClass = 'bg-green-800/50 hover:bg-green-700/50 text-white';
  const iconClass = 'w-5 h-5';

  return (
    <>
      <header
        // The header is the page's own top edge. It is sticky at the very top
        // with a solid colour, and its padding reaches up behind the status
        // area: that is where iOS takes the status area's colour from, and it
        // keeps the buttons clear of the clock in every state the system has.
        data-sol-top-edge
        className={cn(
          'sticky top-0 z-30',
          // layout
          'grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-1.5 gap-y-1',
          // separation
          'border-b border-green-700/50',
          // spacing: compact for iPhone + safe-area aware
          'pb-2',
          'pl-[calc(env(safe-area-inset-left)+0.5rem)] pr-[calc(env(safe-area-inset-right)+0.5rem)]'
        )}
        style={{
          backgroundColor: HEADER_BACKGROUND,
          paddingTop: 'calc(var(--sol-safe-top, env(safe-area-inset-top, 0px)) + 0.25rem)',
        }}
      >
        {/* Left */}
        <div className='min-w-0 flex items-center gap-1 justify-self-start'>
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={cn(
              iconButtonClass,
              canUndo
                ? passiveButtonClass
                : 'bg-green-900/30 text-green-700 cursor-not-allowed'
            )}
            aria-label='Undo'
          >
            <Undo2 className={iconClass} />
          </button>

          <div
            className={cn(
              controlHeightClass,
              'min-w-[4rem] rounded-xl border border-green-700/25 bg-green-950/25 px-2 flex items-center justify-center text-white/80 text-xs font-medium tabular-nums whitespace-nowrap'
            )}
            aria-label={formatMoveCount(moveCount)}
          >
            {formatMoveCount(moveCount)}
          </div>
        </div>

        {/* Center */}
        <div className='justify-self-center text-white font-medium tabular-nums text-base min-w-0'>
          <button
            onClick={() => setShowCalendar(true)}
            className={cn(
              controlHeightClass,
              'min-w-[5.75rem] flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-black/15 px-2.5 hover:bg-white/10 transition-colors'
            )}
            aria-label='Daily challenge calendar'
          >
            <Clock clock={clock} gameId={gameId} running={clockRunning} />
            <Crown className='w-4 h-4 text-gray-400' />
            <span className='text-gray-400 text-sm font-medium tabular-nums'>{crownCount}</span>
          </button>
        </div>

        {/* Right */}
        <div className='min-w-0 flex items-center gap-1 justify-self-end'>
          <button
            onClick={onStartDaily}
            disabled={todayCompleted}
            className={cn(
              iconButtonClass,
              isPlayingDaily
                ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50'
                : todayCompleted
                  ? 'bg-green-800/30 text-green-400 cursor-default'
                  : 'bg-yellow-600/80 hover:bg-yellow-500/80 text-white'
            )}
            aria-label={todayCompleted ? 'Daily complete' : 'Start daily challenge'}
            title={todayCompleted ? 'Daily complete' : 'Daily challenge'}
          >
            {todayCompleted ? (
              <Crown className={iconClass} />
            ) : (
              <Calendar className={iconClass} />
            )}
          </button>

          <button
            onClick={onShowStats}
            className={cn(iconButtonClass, passiveButtonClass)}
            aria-label='Statistics'
          >
            <BarChart3 className={iconClass} />
          </button>

          <button
            onClick={onNewGame}
            className={cn(iconButtonClass, passiveButtonClass)}
            aria-label='New Game'
          >
            <RotateCcw className={iconClass} />
          </button>
        </div>

        {limitStatus && (
          <button
            onClick={limitStatus.onClick}
            className={cn(
              'col-span-3 justify-self-center h-7 w-full max-w-[18rem] truncate rounded-full border px-3 text-xs leading-7 transition-colors',
              limitStatus.tone === 'green' && 'bg-green-950/45 border-green-700/35 text-green-100/80 hover:bg-green-900/60',
              limitStatus.tone === 'amber' && 'bg-amber-950/60 border-amber-500/50 text-amber-100 hover:bg-amber-900/70',
              limitStatus.tone === 'red' && 'bg-red-950/60 border-red-500/50 text-red-100 hover:bg-red-900/70',
              limitStatus.tone === 'blue' && 'bg-blue-950/60 border-blue-500/50 text-blue-100 hover:bg-blue-900/70'
            )}
            title={limitStatus.label}
          >
            {limitStatus.label}
          </button>
        )}
      </header>
      <DailyCalendarModal
        isOpen={showCalendar}
        onClose={() => setShowCalendar(false)}
      />
    </>
  );
}
