import React from 'react';
import type { GameStats } from '../engine/types';
import { Trophy, Flame, Target, X, TrendingUp } from 'lucide-react';

interface StatsModalProps {
  isOpen: boolean;
  stats: GameStats | null;
  onClose: () => void;
}

function formatTime(seconds: number): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function StatsModal({ isOpen, stats, onClose }: StatsModalProps) {
  if (!isOpen || !stats) return null;

  const winRate = stats.gamesPlayed > 0 
    ? Math.round((stats.wins / stats.gamesPlayed) * 100) 
    : 0;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      {/* Backdrop */}
      <div 
        className='absolute inset-0 bg-black/60 backdrop-blur-sm'
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className='relative bg-gradient-to-b from-green-800 to-green-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full text-white animate-scale-in'>
        <button
          onClick={onClose}
          className='absolute top-4 right-4 p-1 rounded-lg hover:bg-green-700/50 transition-colors'
        >
          <X className='w-5 h-5' />
        </button>
        
        <h2 className='text-2xl font-bold mb-6 text-center'>Statistics</h2>
        
        {/* Stats grid */}
        <div className='grid grid-cols-2 gap-3 mb-4'>
          <div className='bg-green-700/50 rounded-xl p-4 text-center'>
            <Target className='w-6 h-6 mx-auto mb-2 text-green-300' />
            <div className='text-2xl font-bold tabular-nums'>{stats.gamesPlayed}</div>
            <div className='text-sm text-green-300/70'>Games Played</div>
          </div>
          
          <div className='bg-green-700/50 rounded-xl p-4 text-center'>
            <Trophy className='w-6 h-6 mx-auto mb-2 text-amber-400' />
            <div className='text-2xl font-bold tabular-nums'>{stats.wins}</div>
            <div className='text-sm text-green-300/70'>Wins</div>
          </div>
          
          <div className='bg-green-700/50 rounded-xl p-4 text-center'>
            <TrendingUp className='w-6 h-6 mx-auto mb-2 text-blue-400' />
            <div className='text-2xl font-bold tabular-nums'>{winRate}%</div>
            <div className='text-sm text-green-300/70'>Win Rate</div>
          </div>
          
          <div className='bg-green-700/50 rounded-xl p-4 text-center'>
            <Flame className='w-6 h-6 mx-auto mb-2 text-orange-400' />
            <div className='text-2xl font-bold tabular-nums'>{stats.currentStreak}</div>
            <div className='text-sm text-green-300/70'>Current Streak</div>
          </div>
        </div>
        
        {/* Best stats */}
        <div className='bg-green-700/30 rounded-xl p-4 space-y-3'>
          <div className='flex justify-between items-center'>
            <span className='text-green-300/70'>Best Streak</span>
            <span className='font-bold tabular-nums'>{stats.bestStreak}</span>
          </div>
          <div className='flex justify-between items-center'>
            <span className='text-green-300/70'>Best Time</span>
            <span className='font-bold tabular-nums'>{formatTime(stats.bestTime ?? 0)}</span>
          </div>
          <div className='flex justify-between items-center'>
            <span className='text-green-300/70'>Losses</span>
            <span className='font-bold tabular-nums'>{stats.losses}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
