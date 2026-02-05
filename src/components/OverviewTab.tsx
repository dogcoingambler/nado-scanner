'use client';

import { formatVolume } from '@/lib/nado-client';
import VolumeChart from './VolumeChart';
import UserGrowthChart from './UserGrowthChart';
import MarketPieChart from './MarketPieChart';
import type { DashboardData, OpenInterestData } from '@/lib/types';

interface OverviewTabProps {
  data: DashboardData | null;
  isLoading: boolean;
}

function formatLargeNumber(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatCompact(value: number): string {
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toString();
}

function StatCard({ label, value, subtext, highlight, badge }: {
  label: string;
  value: string;
  subtext?: string | null;
  highlight?: boolean;
  badge?: string;
}) {
  return (
    <div
      className="p-5 rounded-lg"
      style={{
        background: highlight ? 'rgba(34, 197, 94, 0.08)' : '#141414',
        border: highlight ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid #1F1F1F',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium" style={{ color: '#6B6B6B' }}>
          {label}
        </span>
        {badge && (
          <span
            className="text-xs px-2 py-0.5 rounded"
            style={{ background: '#22C55E', color: '#000' }}
          >
            {badge}
          </span>
        )}
      </div>
      <div
        className="text-2xl font-bold font-mono"
        style={{ color: highlight ? '#22C55E' : '#FFFFFF' }}
      >
        {value}
      </div>
      {subtext && (
        <div className="text-xs mt-1 font-mono" style={{ color: '#6B6B6B' }}>
          {subtext}
        </div>
      )}
    </div>
  );
}

function OpenInterestTable({ data, total }: { data: OpenInterestData[]; total: number }) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#141414', border: '1px solid #1F1F1F' }}>
      <div className="p-5 border-b" style={{ borderColor: '#1F1F1F' }}>
        <h2 className="text-lg font-bold text-white">Open Interest</h2>
        <p className="text-sm mt-1" style={{ color: '#6B6B6B' }}>
          Total: {formatVolume(total)}
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
  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(7)].map((_, i) => (
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
    ? `${data.change1d >= 0 ? '+' : ''}${data.change1d.toFixed(1)}% 24h`
    : null;

  return (
    <div className="space-y-8">
      {/* User stats row */}
      <section>
        <h3 className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: '#6B6B6B' }}>
          Users
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard
            label="Total Users"
            value={formatCompact(data?.totalUsers || 0)}
            highlight
          />
          <StatCard
            label="24h New Users"
            value={(data?.newUsers24h || 0).toLocaleString()}
          />
          <StatCard
            label="Active Traders"
            value={(data?.uniqueTraders24h || 0).toLocaleString()}
            subtext="With perp volume"
          />
        </div>
      </section>

      {/* Volume stats row */}
      <section>
        <h3 className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: '#6B6B6B' }}>
          Volume
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="1D Volume"
            value={formatLargeNumber(data?.totalVolume24h || 0)}
            subtext={change1dStr}
            highlight
          />
          <StatCard
            label="7D Volume"
            value={formatLargeNumber(data?.totalVolume7d || 0)}
          />
          <StatCard
            label="30D Volume"
            value={formatLargeNumber(data?.totalVolume30d || 0)}
          />
          <StatCard
            label="All-Time Volume"
            value={formatLargeNumber(data?.totalVolumeAllTime || 0)}
          />
        </div>
      </section>

      {/* Open Interest card */}
      <section>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Open Interest"
            value={formatLargeNumber(data?.totalOpenInterest || 0)}
            badge="LIVE"
          />
        </div>
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UserGrowthChart
          data={data?.userGrowth || []}
          isLoading={isLoading}
        />
        <VolumeChart
          data={data?.volumeHistory || []}
          isLoading={isLoading}
        />
      </section>

      {/* Market breakdown + Open Interest */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MarketPieChart
          data={data?.productVolumes || []}
          isLoading={isLoading}
        />
        <OpenInterestTable
          data={data?.openInterest || []}
          total={data?.totalOpenInterest || 0}
        />
      </section>
    </div>
  );
}
