import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Crown, ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import { cn } from '../lib/utils';
import { getAllCompletions, getStreaks, DailyCompletion } from '../persistence/dailyChallenge';
import { getKey } from '../engine/solvableSeeds';

interface DailyCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DailyCalendarModal({ isOpen, onClose }: DailyCalendarModalProps) {
  const [completions, setCompletions] = useState<DailyCompletion[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [streaks, setStreaks] = useState({ current: 0, best: 0 });

  useEffect(() => {
    if (isOpen) {
      getAllCompletions().then(setCompletions);
      getStreaks().then(setStreaks);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const completedDates = new Set(completions.map(c => c.dateKey));

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPadding = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  const today = new Date();
  const todayKey = getKey(today);

  const days: any[] = [];
  for (let i = 0; i < startPadding; i++) {
    days.push(<div key={`pad-${i}`} className='w-10 h-10' />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateKey = getKey(date);
    const isCompleted = completedDates.has(dateKey);
    const isToday = dateKey === todayKey;
    const completion = completions.find(c => c.dateKey === dateKey);

    days.push(
      <div
        key={day}
        className={cn(
          'w-10 h-10 flex flex-col items-center justify-center rounded-lg relative',
          isToday && 'ring-2 ring-yellow-400/50',
          isCompleted ? 'bg-yellow-500/20' : 'bg-green-900/30'
        )}
        title={completion ? `Time: ${Math.floor(completion.timeSeconds / 60)}:${String(completion.timeSeconds % 60).padStart(2, '0')}, Moves: ${completion.moveCount}` : undefined}
      >
        <span className={cn(
          'text-xs',
          isCompleted ? 'text-yellow-300' : 'text-white/60'
        )}>
          {day}
        </span>
        {isCompleted && (
          <Crown className='w-3 h-3 text-yellow-400 absolute -top-0.5 -right-0.5' />
        )}
      </div>
    );
  }

  const crownCount = completions.length;

  return createPortal(
    <div className='fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm'>
      <div
        className='bg-green-900/95 border border-green-700/50 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-2'>
            <Crown className='w-5 h-5 text-yellow-400' />
            <h2 className='text-xl font-bold text-white'>Daily Challenges</h2>
          </div>
          <div className='flex items-center gap-1'>
            <button
              onClick={onClose}
              className='p-1 rounded-lg hover:bg-green-800/50 text-white/70 hover:text-white transition-colors'
            >
              <X className='w-5 h-5' />
            </button>
          </div>
        </div>

        <div className='grid grid-cols-3 gap-2 mb-4'>
          <div className='bg-yellow-500/20 rounded-lg p-2 text-center'>
            <Crown className='w-5 h-5 mx-auto mb-1 text-yellow-400' />
            <span className='text-xl font-bold text-yellow-400'>{crownCount}</span>
            <p className='text-white/50 text-xs'>Crowns</p>
          </div>
          <div className={cn(
            'rounded-lg p-2 text-center',
            streaks.current > 0 ? 'bg-orange-500/20' : 'bg-green-800/30'
          )}>
            <Flame className={cn('w-5 h-5 mx-auto mb-1', streaks.current > 0 ? 'text-orange-400' : 'text-white/40')} />
            <span className={cn('text-xl font-bold', streaks.current > 0 ? 'text-orange-400' : 'text-white/40')}>{streaks.current}</span>
            <p className='text-white/50 text-xs'>Streak</p>
          </div>
          <div className='bg-green-800/30 rounded-lg p-2 text-center'>
            <Flame className='w-5 h-5 mx-auto mb-1 text-green-400' />
            <span className='text-xl font-bold text-green-400'>{streaks.best}</span>
            <p className='text-white/50 text-xs'>Best</p>
          </div>
        </div>

        <div className='flex items-center justify-between mb-3'>
          <button
            onClick={prevMonth}
            className='p-1 rounded-lg hover:bg-green-800/50 text-white/70 hover:text-white transition-colors'
          >
            <ChevronLeft className='w-5 h-5' />
          </button>
          <span className='text-white font-medium'>{monthName}</span>
          <button
            onClick={nextMonth}
            className='p-1 rounded-lg hover:bg-green-800/50 text-white/70 hover:text-white transition-colors'
          >
            <ChevronRight className='w-5 h-5' />
          </button>
        </div>

        <div className='grid grid-cols-7 gap-1 mb-2'>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className='w-10 h-6 flex items-center justify-center text-white/40 text-xs font-medium'>
              {d}
            </div>
          ))}
        </div>

        <div className='grid grid-cols-7 gap-1'>
          {days}
        </div>

        <p className='text-white/40 text-xs text-center mt-4'>
          Complete the daily challenge to earn a crown!
        </p>

      </div>
    </div>,
    document.body
  );
}
