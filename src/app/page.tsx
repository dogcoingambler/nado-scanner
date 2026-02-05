'use client';

import { useState, useEffect } from 'react';
import OverviewTab from '@/components/OverviewTab';
import LeaderboardTab from '@/components/LeaderboardTab';
import type { DashboardData } from '@/lib/types';

interface StaticDashboardData extends DashboardData {
  generatedAt?: string;
}

type TabId = 'overview' | 'leaderboard';

export default function Home() {
  const [data, setData] = useState<StaticDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

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

  const generatedDate = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'leaderboard', label: 'Leaderboard' },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#0D0D0D' }}>
      {/* Header */}
      <header className="border-b" style={{ borderColor: '#1F1F1F', background: '#0D0D0D' }}>
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo + Tabs */}
            <div className="flex items-center gap-4">
              <a href="https://nado.xyz" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                <svg width="28" height="28" viewBox="0 0 100 100" fill="none">
                  <path d="M20 80V20L50 50L80 20V80L50 50L20 80Z" fill="#22C55E"/>
                </svg>
                <span className="text-xl font-bold text-white tracking-tight">NADO</span>
              </a>
              <div className="h-6 w-px" style={{ background: '#2A2A2A' }}></div>

              {/* Tab Navigation */}
              <nav className="flex items-center gap-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="px-4 py-2 text-sm font-medium transition-all rounded-md"
                    style={{
                      color: activeTab === tab.id ? '#FFFFFF' : '#6B6B6B',
                      background: activeTab === tab.id ? '#1A1A1A' : 'transparent',
                      borderBottom: activeTab === tab.id ? '2px solid #22C55E' : '2px solid transparent',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-6">
              {generatedDate && (
                <span className="text-xs font-mono hidden md:block" style={{ color: '#6B6B6B' }}>
                  Data as of {generatedDate}
                </span>
              )}
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

        {activeTab === 'overview' ? (
          <OverviewTab data={data} isLoading={isLoading} />
        ) : (
          <LeaderboardTab data={data} isLoading={isLoading} />
        )}
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
