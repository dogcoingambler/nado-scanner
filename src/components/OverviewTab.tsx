'use client';

import { useState } from 'react';
import { formatVolume } from '@/lib/nado-client';
import VolumeChart from './VolumeChart';
import UserGrowthChart from './UserGrowthChart';
import MarketPieChart from './MarketPieChart';
import type { DashboardData, OpenInterestData } from '@/lib/types';

interface OverviewTabProps {
  data: DashboardData | null;
  isLoading: boolean;
}

type Timeframe = '24h' | '7d' | '30d' | 'all';

function formatLargeNumber(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatCompact(value: number): string {
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString();
}

function OpenInterestTable({ data, total }: { data: OpenInterestData[]; total: number }) {
  return (
    <div className="rounded-lg overflow-hidden h-full" style={{ background: '#141414', border: '1px solid #1F1F1F' }}>
      <div className="p-5 border-b" style={{ borderColor: '#1F1F1F' }}>
        <h2 className="text-lg font-bold text-white">Open Interest per Market</h2>
        <p className="text-sm mt-1" style={{ color: '#6B6B6B' }}>
          Breakdown by perpetual market
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ background: '#0D0D0D' }}>
              <th className="text-left py-2.5 px-5 text-xs font-medium" style={{ color: '#6B6B6B' }}>MARKET</th>
              <th className="text-right py-2.5 px-5 text-xs font-medium" style={{ color: '#6B6B6B' }}>OPEN INTEREST</th>
              <th className="text-right py-2.5 px-5 text-xs font-medium" style={{ color: '#6B6B6B' }}>% OF TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 10).map((item) => (
              <tr key={item.productId} style={{ borderTop: '1px solid #1F1F1F' }}>
                <td className="py-2.5 px-5 text-sm font-medium text-white">{item.name}</td>
                <td className="py-2.5 px-5 text-right">
                  <span className="font-mono text-sm" style={{ color: '#22C55E' }}>
                    {formatVolume(item.openInterestUsd)}
                  </span>
                </td>
                <td className="py-2.5 px-5 text-right">
                  <span className="font-mono text-sm" style={{ color: '#A1A1A1' }}>
                    {total > 0 ? `${((item.openInterestUsd / total) * 100).toFixed(1)}%` : '-'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function OverviewTab({ data, isLoading }: OverviewTabProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>('30d');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-5 rounded-lg animate-pulse" style={{ background: '#141414', border: '1px solid #1F1F1F' }}>
              <div className="h-4 rounded w-24 mb-3" style={{ background: '#2A2A2A' }} />
              <div className="h-8 rounded w-32" style={{ background: '#2A2A2A' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const change1dStr = data?.change1d
    ? `${data.change1d >= 0 ? '+' : ''}${data.change1d.toFixed(1)}%`
    : null;

  const volumeForTimeframe = (): number => {
    if (!data) return 0;
    switch (timeframe) {
      case '24h': return data.totalVolume24h || 0;
      case '7d': return data.totalVolume7d || 0;
      case '30d': return data.totalVolume30d || 0;
      case 'all': return data.totalVolumeAllTime || 0;
    }
  };

  const timeframeLabel = (): string => {
    switch (timeframe) {
      case '24h': return '24h Volume';
      case '7d': return '7D Volume';
      case '30d': return '30D Volume';
      case 'all': return 'All Time Volume';
    }
  };

  const timeframes: { id: Timeframe; label: string }[] = [
    { id: '24h', label: '1D' },
    { id: '7d', label: '7D' },
    { id: '30d', label: '30D' },
    { id: 'all', label: 'All' },
  ];

  // Filter volume history based on timeframe
  const filteredVolumeHistory = (() => {
    if (!data?.volumeHistory) return [];
    const history = data.volumeHistory;
    if (timeframe === 'all') return history;
    const now = Date.now();
    const days = timeframe === '24h' ? 1 : timeframe === '7d' ? 7 : 30;
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    return history.filter(p => new Date(p.timestamp).getTime() >= cutoff);
  })();

  return (
    <div className="space-y-6">
      {/* Row 1: Volume + OI stats with timeframe selector */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div></div>
          {/* Timeframe selector */}
          <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: '#141414', border: '1px solid #1F1F1F' }}>
            {timeframes.map((tf) => (
              <button
                key={tf.id}
                onClick={() => setTimeframe(tf.id)}
                className="px-3 py-1.5 text-xs font-medium rounded-md transition-all"
                style={{
                  background: timeframe === tf.id ? '#22C55E' : 'transparent',
                  color: timeframe === tf.id ? '#000000' : '#6B6B6B',
                }}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Volume stat */}
          <div
            className="p-5 rounded-lg"
            style={{
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
            }}
          >
            <span className="text-sm font-medium" style={{ color: '#6B6B6B' }}>
              {timeframeLabel()}
            </span>
            <div className="text-2xl md:text-3xl font-bold font-mono mt-2" style={{ color: '#22C55E' }}>
              {formatLargeNumber(volumeForTimeframe())}
            </div>
            {timeframe === '24h' && change1dStr && (
              <div
                className="text-xs mt-1 font-mono"
                style={{ color: (data?.change1d || 0) >= 0 ? '#22C55E' : '#EF4444' }}
              >
                {change1dStr} 24h
              </div>
            )}
          </div>

          {/* All-Time Volume (always shown if not already selected) */}
          {timeframe !== 'all' && (
            <div className="p-5 rounded-lg" style={{ background: '#141414', border: '1px solid #1F1F1F' }}>
              <span className="text-sm font-medium" style={{ color: '#6B6B6B' }}>
                All Time Volume
              </span>
              <div className="text-2xl md:text-3xl font-bold font-mono mt-2 text-white">
                {formatLargeNumber(data?.totalVolumeAllTime || 0)}
              </div>
            </div>
          )}

          {/* Open Interest */}
          <div className="p-5 rounded-lg" style={{ background: '#141414', border: '1px solid #1F1F1F' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: '#6B6B6B' }}>
                Open Interest
              </span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                style={{ background: '#22C55E', color: '#000' }}
              >
                LIVE
              </span>
            </div>
            <div className="text-2xl md:text-3xl font-bold font-mono mt-2 text-white">
              {formatLargeNumber(data?.totalOpenInterest || 0)}
            </div>
          </div>
        </div>
      </section>

      {/* Row 2: Volume Chart + Open Interest Table */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VolumeChart
          data={filteredVolumeHistory}
          isLoading={isLoading}
        />
        <OpenInterestTable
          data={data?.openInterest || []}
          total={data?.totalOpenInterest || 0}
        />
      </section>

      {/* Row 3: User stats */}
      <section>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-lg" style={{ background: '#141414', border: '1px solid #1F1F1F' }}>
            <span className="text-sm font-medium" style={{ color: '#6B6B6B' }}>24h Traders</span>
            <div className="text-2xl font-bold font-mono mt-2 text-white">
              {(data?.uniqueTraders24h || 0).toLocaleString()}
            </div>
          </div>
          <div className="p-5 rounded-lg" style={{ background: '#141414', border: '1px solid #1F1F1F' }}>
            <span className="text-sm font-medium" style={{ color: '#6B6B6B' }}>Total Traders</span>
            <div className="text-2xl font-bold font-mono mt-2 text-white">
              {formatCompact(data?.totalUsers || 0)}
            </div>
          </div>
          <div className="p-5 rounded-lg" style={{ background: '#141414', border: '1px solid #1F1F1F' }}>
            <span className="text-sm font-medium" style={{ color: '#6B6B6B' }}>24h New Users</span>
            <div className="text-2xl font-bold font-mono mt-2 text-white">
              {(data?.newUsers24h || 0).toLocaleString()}
            </div>
          </div>
          <div
            className="p-5 rounded-lg"
            style={{
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
            }}
          >
            <span className="text-sm font-medium" style={{ color: '#6B6B6B' }}>Total Users</span>
            <div className="text-2xl font-bold font-mono mt-2" style={{ color: '#22C55E' }}>
              {formatCompact(data?.totalUsers || 0)}
            </div>
          </div>
        </div>
      </section>

      {/* Row 4: User Growth + Market Pie */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UserGrowthChart
          data={data?.userGrowth || []}
          isLoading={isLoading}
        />
        <MarketPieChart
          data={data?.productVolumes || []}
          isLoading={isLoading}
        />
      </section>
    </div>
  );
}
