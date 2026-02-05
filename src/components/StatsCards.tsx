'use client';

import { formatVolume } from '@/lib/nado-client';
import type { TimePeriod } from '@/lib/types';

interface StatsCardsProps {
  totalVolume24h: number;
  totalVolume7d: number;
  totalVolumeAllTime: number;
  totalTrades: number;
  uniqueTraders: number;
  lastUpdated: string;
  change1d: number;
  isLoading: boolean;
  selectedPeriod: TimePeriod;
}

export default function StatsCards({
  totalVolume24h,
  totalVolume7d,
  totalVolumeAllTime,
  uniqueTraders,
  lastUpdated,
  change1d,
  isLoading,
  selectedPeriod,
}: StatsCardsProps) {
  const periodLabel = selectedPeriod === '24h'
    ? '24H'
    : selectedPeriod === '7d'
      ? '7D'
      : 'All-Time';

  const currentVolume = selectedPeriod === '24h'
    ? totalVolume24h
    : selectedPeriod === '7d'
      ? totalVolume7d
      : totalVolumeAllTime;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="p-5 rounded-lg animate-pulse"
            style={{ background: '#141414', border: '1px solid #1F1F1F' }}
          >
            <div className="h-4 rounded w-24 mb-3" style={{ background: '#2A2A2A' }} />
            <div className="h-8 rounded w-32" style={{ background: '#2A2A2A' }} />
          </div>
        ))}
      </div>
    );
  }

  const stats = [
    {
      label: `${periodLabel} Volume`,
      value: formatVolume(currentVolume),
      subtext: selectedPeriod === '24h' && change1d !== 0
        ? `${change1d >= 0 ? '+' : ''}${change1d.toFixed(1)}%`
        : null,
      subtextColor: change1d >= 0 ? '#22C55E' : '#EF4444',
      highlight: true,
    },
    {
      label: '24H Volume',
      value: formatVolume(totalVolume24h),
      subtext: null,
      highlight: false,
    },
    {
      label: 'Total Traders',
      value: uniqueTraders.toLocaleString(),
      subtext: 'All-time unique',
      subtextColor: '#6B6B6B',
      highlight: false,
    },
    {
      label: 'Last Updated',
      value: lastUpdated ? new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
      subtext: lastUpdated ? new Date(lastUpdated).toLocaleDateString() : null,
      subtextColor: '#6B6B6B',
      highlight: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className="p-5 rounded-lg transition-all"
          style={{
            background: stat.highlight ? 'rgba(34, 197, 94, 0.08)' : '#141414',
            border: stat.highlight ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid #1F1F1F',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: '#6B6B6B' }}>
              [ {stat.label} ]
            </span>
            {index === 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{ background: '#22C55E', color: '#000' }}
              >
                LIVE
              </span>
            )}
          </div>
          <div
            className="text-2xl font-bold font-mono"
            style={{ color: stat.highlight ? '#22C55E' : '#FFFFFF' }}
          >
            {stat.value}
          </div>
          {stat.subtext && (
            <div
              className="text-xs mt-1 font-mono"
              style={{ color: stat.subtextColor || '#6B6B6B' }}
            >
              {stat.subtext}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
