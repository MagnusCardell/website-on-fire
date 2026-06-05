import React, { useState } from 'react';
import { LIMIT_DEBUG_SCENARIOS } from '../limits/debug';
import type { LimitDebugScenarioId, LimitSnapshot } from '../limits/types';
import { cn } from '../lib/utils';

interface LimitDebugPanelProps {
  snapshot: LimitSnapshot;
  onApplyScenario: (scenarioId: LimitDebugScenarioId) => void;
  onReset: () => void;
}

export function LimitDebugPanel({
  snapshot,
  onApplyScenario,
  onReset,
}: LimitDebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className='fixed bottom-3 left-3 z-[10000] max-w-[calc(100vw-1.5rem)] text-white'>
      <button
        onClick={() => setIsOpen(value => !value)}
        className={cn(
          'rounded-lg border px-3 py-2 text-xs font-medium shadow-lg backdrop-blur-sm',
          isOpen
            ? 'border-blue-300/60 bg-blue-950/90 text-blue-50'
            : 'border-white/15 bg-black/50 text-white/85 hover:bg-black/65'
        )}
      >
        Limit tester: {snapshot.longSessionActive ? 'long-session' : snapshot.promptDue ? 'prompt-due' : 'green'}
      </button>

      {isOpen && (
        <div className='mt-2 w-[min(27rem,calc(100vw-1.5rem))] rounded-lg border border-white/15 bg-black/80 p-3 shadow-2xl backdrop-blur-md'>
          <div className='mb-3 flex items-start justify-between gap-3'>
            <div>
              <div className='text-sm font-semibold'>Limit Playtest</div>
              <div className='mt-0.5 text-xs text-white/60'>{snapshot.statusLabel}</div>
            </div>
            <button
              onClick={onReset}
              className='rounded-md bg-white/10 px-2 py-1 text-xs text-white/80 hover:bg-white/15'
            >
              Reset
            </button>
          </div>

          <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
            {LIMIT_DEBUG_SCENARIOS.map(scenario => (
              <button
                key={scenario.id}
                onClick={() => onApplyScenario(scenario.id)}
                title={scenario.description}
                className={cn(
                  'min-h-12 rounded-lg border px-2 py-2 text-left text-xs transition-colors',
                  (scenario.id === 'green' && !snapshot.promptDue && !snapshot.longSessionActive) ||
                  (scenario.id === 'long-session' && snapshot.longSessionActive)
                    ? 'border-blue-200 bg-blue-100 text-blue-950'
                    : 'border-white/15 bg-white/5 text-white hover:bg-white/10'
                )}
              >
                <div className='font-medium'>{scenario.label}</div>
                <div className='mt-0.5 truncate text-[10px] opacity-70'>{scenario.description}</div>
              </button>
            ))}
          </div>

          <div className='mt-3 rounded-md bg-white/5 px-2 py-1.5 text-[11px] text-white/55'>
            Enabled by <span className='font-mono'>?limitsDebug=1</span>. These buttons mutate local limiter state only.
          </div>
        </div>
      )}
    </div>
  );
}
