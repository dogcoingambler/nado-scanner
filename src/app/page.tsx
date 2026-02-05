'use client';

import { useState, useEffect } from 'react';
import StatsCards from '@/components/StatsCards';
import TraderTable from '@/components/TraderTable';
import VolumeChart from '@/components/VolumeChart';
import ProductVolumes from '@/components/ProductVolumes';
import type { DashboardData, TimePeriod } from '@/lib/types';

interface StaticDashboardData extends DashboardData {
  generatedAt?: string;
}

export default function Home() {
  const [data, setData] = useState<StaticDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('all');

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const response = await fetch('/data/leaderboard.json');
        if (!response.ok) {
          throw new Error(`Failed to load data (${response.status})`);
        }
        const result: StaticDashboardData = await response.json();
        setData(result);
        setError(null);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err || 'An error occurred');
        console.error('Failed to load leaderboard data:', message);
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  const periods: { value: TimePeriod; label: string }[] = [
    { value: '24h', label: '24H' },
    { value: '7d', label: '7D' },
    { value: 'all', label: 'ALL' },
  ];

  const generatedDate = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="min-h-screen" style={{ background: '#0D0D0D' }}>
      {/* Header - Nado Style */}
      <header className="border-b" style={{ borderColor: '#1F1F1F', background: '#0D0D0D' }}>
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <a href="https://nado.xyz" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                <svg width="28" height="28" viewBox="0 0 100 100" fill="none">
                  <path d="M20 80V20L50 50L80 20V80L50 50L20 80Z" fill="#22C55E"/>
                </svg>
                <span className="text-xl font-bold text-white tracking-tight">NADO</span>
              </a>
              <div className="h-6 w-px" style={{ background: '#2A2A2A' }}></div>
              <span className="text-sm font-medium" style={{ color: '#A1A1A1' }}>Leaderboard</span>
            </div>

            {/* Right side controls */}
            <div className="flex items-center gap-6">
              {/* Period selector */}
              <div className="flex items-center" style={{ background: '#141414', borderRadius: '6px' }}>
                {periods.map((period) => (
                  <button
                    key={period.value}
                    onClick={() => setSelectedPeriod(period.value)}
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

              {/* Data timestamp */}
              {generatedDate && (
                <span className="text-xs font-mono" style={{ color: '#6B6B6B' }}>
                  Data as of {generatedDate}
                </span>
              )}

              {/* Trade link */}
              <a
                href="https://app.nado.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-sm font-medium transition-all"
                style={{
                  background: '#22C55E',
                  color: '#000000',
                  borderRadius: '6px',
                }}
              >
                Trade on Nado
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        {error && (
          <div
            className="mb-6 p-4 rounded-lg text-sm"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#EF4444'
            }}
          >
            {error}
          </div>
        )}

        {/* Stats Cards */}
        <section className="mb-8">
          <StatsCards
            totalVolume24h={data?.totalVolume24h || 0}
            totalVolume7d={data?.totalVolume7d || 0}
            totalVolumeAllTime={data?.totalVolumeAllTime || 0}
            totalTrades={data?.totalTrades24h || 0}
            uniqueTraders={data?.uniqueTraders24h || 0}
            lastUpdated={data?.lastUpdated || ''}
            change1d={data?.change1d || 0}
            isLoading={isLoading}
            selectedPeriod={selectedPeriod}
          />
        </section>

        {/* Charts Row */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <VolumeChart
            data={data?.volumeHistory || []}
            isLoading={isLoading}
          />
          <ProductVolumes
            data={data?.productVolumes || []}
            isLoading={isLoading}
          />
        </section>

        {/* Trader Leaderboard */}
        <section>
          <TraderTable
            traders={data?.traders || []}
            isLoading={isLoading}
            period={selectedPeriod}
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 mt-12" style={{ borderColor: '#1F1F1F' }}>
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="flex items-center justify-between text-sm" style={{ color: '#6B6B6B' }}>
            <div className="flex items-center gap-2">
              <span>Powered by</span>
              <a
                href="https://nado.xyz"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#22C55E' }}
                className="hover:underline"
              >
                Nado
              </a>
              <span>on Ink Chain</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="https://docs.nado.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                Docs
              </a>
              <a href="https://x.com/nadohq" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                Twitter
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
