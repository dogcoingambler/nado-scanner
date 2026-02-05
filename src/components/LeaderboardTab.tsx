'use client';

import { useState, useMemo } from 'react';
import StatsCards from './StatsCards';
import TraderTable from './TraderTable';
import ProductVolumes from './ProductVolumes';
import EpochSelector from './EpochSelector';
import type { DashboardData, TimePeriod, AggregatedTraderData, EpochLeaderboard } from '@/lib/types';

interface LeaderboardTabProps {
  data: DashboardData | null;
  isLoading: boolean;
}

export default function LeaderboardTab({ data, isLoading }: LeaderboardTabProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('all');
  const [selectedEpochName, setSelectedEpochName] = useState<string | null>(null);

  const epochLabel = data?.currentEpoch?.name || 'Epoch';

  const periods: { value: TimePeriod; label: string }[] = [
    { value: '24h', label: '24H' },
    { value: 'epoch', label: epochLabel },
    { value: 'all', label: 'ALL' },
  ];

  // When a specific epoch is selected from the epoch selector,
  // map its pre-computed data into AggregatedTraderData format
  const epochLeaderboard: EpochLeaderboard | null = useMemo(() => {
    if (!selectedEpochName || !data?.epochLeaderboards) return null;
    // Check if this is the current epoch (use main trader data)
    if (data.currentEpoch?.name === selectedEpochName) return null;
    return data.epochLeaderboards.find(e => e.epochName === selectedEpochName) || null;
  }, [selectedEpochName, data]);

  // Build the trader list to display
  const displayTraders: AggregatedTraderData[] = useMemo(() => {
    if (epochLeaderboard) {
      // Past epoch: convert EpochTraderData to AggregatedTraderData
      return epochLeaderboard.traders.map(t => ({
        address: t.address,
        totalVolumeUsd: t.volume,
        volumeEpoch: t.volume,
        volume24h: 0,
        volumeShare: t.volumeShare,
        volumeShareEpoch: t.volumeShare,
        volumeShare24h: 0,
        tradeCount: 0,
        buyVolumeUsd: 0,
        sellVolumeUsd: 0,
        avgTradeSizeUsd: 0,
        lastActive: '',
        productCount: t.productCount,
        totalFees: 0,
        rank: t.rank,
        rankEpoch: t.rank,
        rank24h: undefined,
      }));
    }
    return data?.traders || [];
  }, [epochLeaderboard, data]);

  // Determine what period to use for display
  const displayPeriod: TimePeriod = epochLeaderboard ? 'epoch' : selectedPeriod;
  const displayEpochName = epochLeaderboard ? selectedEpochName : data?.currentEpoch?.name;

  // Stats for the selected view
  const totalVolumeEpoch = epochLeaderboard
    ? epochLeaderboard.totalVolume
    : (data?.calculatedVolumeEpoch || 0);

  const handleEpochSelect = (epochName: string | null) => {
    setSelectedEpochName(epochName);
    if (epochName) {
      // When selecting an epoch, switch period to 'epoch' view
      setSelectedPeriod('epoch');
    }
  };

  return (
    <div className="space-y-6">
      {/* Epoch selector */}
      <EpochSelector
        epochs={data?.epochs || []}
        currentEpoch={data?.currentEpoch}
        epochLeaderboards={data?.epochLeaderboards || []}
        selectedEpochName={selectedEpochName}
        onSelectEpoch={handleEpochSelect}
      />

      {/* Period selector (only when no specific past epoch is selected) */}
      {!epochLeaderboard && (
        <div className="flex items-center gap-4 mb-2">
          <div className="flex items-center" style={{ background: '#141414', borderRadius: '6px' }}>
            {periods.map((period) => (
              <button
                key={period.value}
                onClick={() => {
                  setSelectedPeriod(period.value);
                  if (period.value !== 'epoch') {
                    setSelectedEpochName(null);
                  } else if (data?.currentEpoch) {
                    setSelectedEpochName(data.currentEpoch.name);
                  }
                }}
                className="px-4 py-2 text-sm font-medium transition-all"
                style={{
                  color: selectedPeriod === period.value ? '#FFFFFF' : '#6B6B6B',
                  background: selectedPeriod === period.value ? '#22C55E' : 'transparent',
                  borderRadius: '6px',
                }}
              >
                {period.label}
              </button>
            ))}
          </div>

          {epochLeaderboard && (
            <span className="text-sm font-medium" style={{ color: '#22C55E' }}>
              Viewing: {selectedEpochName}
            </span>
          )}
        </div>
      )}

      {/* Epoch info banner */}
      {epochLeaderboard && (
        <div
          className="p-3 rounded-lg flex items-center justify-between"
          style={{
            background: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium" style={{ color: '#22C55E' }}>
              {selectedEpochName}
            </span>
            <span className="text-xs font-mono" style={{ color: '#6B6B6B' }}>
              {new Date(epochLeaderboard.epochStart).toLocaleDateString()} — {new Date(epochLeaderboard.epochEnd).toLocaleDateString()}
            </span>
            <span className="text-xs font-mono" style={{ color: '#A1A1A1' }}>
              {epochLeaderboard.traders.length} traders
            </span>
          </div>
          <button
            onClick={() => setSelectedEpochName(null)}
            className="text-xs px-3 py-1 rounded"
            style={{ background: '#1A1A1A', color: '#A1A1A1', border: '1px solid #2A2A2A' }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <StatsCards
        totalVolume24h={data?.totalVolume24h || 0}
        totalVolumeEpoch={totalVolumeEpoch}
        totalVolumeAllTime={data?.totalVolumeAllTime || 0}
        totalTrades={data?.totalTrades24h || 0}
        uniqueTraders={data?.uniqueTraders24h || 0}
        lastUpdated={data?.lastUpdated || ''}
        change1d={data?.change1d || 0}
        isLoading={isLoading}
        selectedPeriod={displayPeriod}
        epochName={displayEpochName || undefined}
      />

      {/* Volume by Market */}
      <ProductVolumes
        data={data?.productVolumes || []}
        isLoading={isLoading}
      />

      {/* Trader Leaderboard */}
      <TraderTable
        traders={displayTraders}
        isLoading={isLoading}
        period={displayPeriod}
        epochName={displayEpochName || undefined}
      />
    </div>
  );
}
