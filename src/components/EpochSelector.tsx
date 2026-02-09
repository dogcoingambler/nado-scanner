'use client';

import type { Epoch, EpochLeaderboard } from '@/lib/types';

interface EpochSelectorProps {
  epochs: Epoch[];
  currentEpoch?: Epoch;
  epochLeaderboards: EpochLeaderboard[];
  selectedEpochName: string | null; // null = use current period selector
  onSelectEpoch: (epochName: string | null) => void;
}

export default function EpochSelector({
  epochs,
  currentEpoch,
  epochLeaderboards,
  selectedEpochName,
  onSelectEpoch,
}: EpochSelectorProps) {
  const now = new Date();
  const cachedNames = new Set(epochLeaderboards.map(e => e.epochName));

  const formatDateShort = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="mb-6">
      <h3 className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: '#6B6B6B' }}>
        Epoch
      </h3>
      <div className="flex flex-wrap gap-2">
        {epochs.map((epoch) => {
          const isCurrent = currentEpoch?.name === epoch.name;
          const isPast = new Date(epoch.end) <= now;
          const isFuture = new Date(epoch.start) > now;
          const hasData = cachedNames.has(epoch.name);
          const isSelected = selectedEpochName === epoch.name;
          const isDisabled = isFuture || (!isCurrent && !hasData);

          return (
            <button
              key={epoch.name}
              onClick={() => {
                if (isDisabled) return;
                onSelectEpoch(isSelected ? null : epoch.name);
              }}
              disabled={isDisabled}
              className="px-3 py-2 text-xs font-medium rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: isSelected
                  ? '#22C55E'
                  : isCurrent && !isSelected
                    ? 'rgba(34, 197, 94, 0.15)'
                    : '#1A1A1A',
                color: isSelected
                  ? '#000'
                  : isCurrent
                    ? '#22C55E'
                    : isPast
                      ? '#A1A1A1'
                      : '#4A4A4A',
                border: isSelected
                  ? '1px solid #22C55E'
                  : isCurrent && !isSelected
                    ? '1px solid rgba(34, 197, 94, 0.4)'
                    : '1px solid #2A2A2A',
              }}
            >
              <div className="flex items-center gap-1.5">
                {isCurrent && (
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: isSelected ? '#000' : '#22C55E' }}
                  />
                )}
                <span>{epoch.name}</span>
              </div>
              <div className="text-[10px] mt-0.5 opacity-70">
                {formatDateShort(epoch.start)} – {formatDateShort(epoch.end)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
