'use client';

import { useState, useMemo } from 'react';
import type { AggregatedTraderData, TimePeriod, WalletLookupResult } from '@/lib/types';
import { truncateAddress, formatVolume } from '@/lib/nado-client';

interface TraderTableProps {
  traders: AggregatedTraderData[];
  isLoading: boolean;
  period: TimePeriod;
}

type SortField = 'rank' | 'volume' | 'share' | 'products';
type SortDirection = 'asc' | 'desc';

// Get volume for the selected period
function getVolume(trader: AggregatedTraderData, period: TimePeriod): number {
  if (period === '24h') return trader.volume24h ?? 0;
  if (period === '7d') return trader.volume7d ?? 0;
  return trader.totalVolumeUsd;
}

// Get volume share for the selected period
function getShare(trader: AggregatedTraderData, period: TimePeriod): number {
  if (period === '24h') return trader.volumeShare24h ?? 0;
  if (period === '7d') return trader.volumeShare7d ?? 0;
  return trader.volumeShare ?? 0;
}

// Get rank for the selected period
function getRank(trader: AggregatedTraderData, period: TimePeriod): number | undefined {
  if (period === '24h') return trader.rank24h;
  if (period === '7d') return trader.rank7d;
  return trader.rank;
}

export default function TraderTable({ traders, isLoading, period }: TraderTableProps) {
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showCount, setShowCount] = useState(50);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<WalletLookupResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const periodLabel = period === '24h' ? '24H' : period === '7d' ? '7D' : 'All-Time';

  // Filter out traders with 0 volume for the selected period (for 24h/7d)
  const activeTraders = useMemo(() => {
    if (period === 'all') return traders;
    return traders.filter(t => getVolume(t, period) > 0);
  }, [traders, period]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'rank' ? 'asc' : 'desc');
    }
  };

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) return;

    if (!/^0x[a-fA-F0-9]{40}$/.test(query)) {
      setSearchError('Invalid address format. Enter a full 0x address (42 characters).');
      setSearchResult(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSearchResult(null);

    try {
      const response = await fetch(`/api/lookup?address=${encodeURIComponent(query)}`);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || `Server error (${response.status})`);
      }
      const result: WalletLookupResult = await response.json();

      // Enrich with rank from the loaded leaderboard data
      if (result.found && !result.rank) {
        const match = traders.find(t => t.address.toLowerCase() === query.toLowerCase());
        if (match?.rank) {
          result.rank = match.rank;
        } else if (result.totalVolume > 0) {
          const rank = traders.filter(t => t.totalVolumeUsd > result.totalVolume).length + 1;
          result.rank = rank;
        }
      }

      setSearchResult(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err || 'Search failed');
      setSearchError(message);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResult(null);
    setSearchError(null);
  };

  const sortedTraders = useMemo(() => {
    return [...activeTraders].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'rank':
          comparison = (getRank(a, period) || 99999) - (getRank(b, period) || 99999);
          break;
        case 'volume':
          comparison = getVolume(a, period) - getVolume(b, period);
          break;
        case 'share':
          comparison = getShare(a, period) - getShare(b, period);
          break;
        case 'products':
          comparison = a.productCount - b.productCount;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [activeTraders, sortField, sortDirection, period]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span style={{ color: '#6B6B6B' }} className="ml-1">↕</span>;
    return <span style={{ color: '#22C55E' }} className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  if (isLoading) {
    return (
      <div className="rounded-lg overflow-hidden" style={{ background: '#141414', border: '1px solid #1F1F1F' }}>
        <div className="p-5 border-b" style={{ borderColor: '#1F1F1F' }}>
          <h2 className="text-lg font-bold text-white">[ LEADERBOARD ]</h2>
        </div>
        <div className="p-5 animate-pulse space-y-3">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-12 rounded" style={{ background: '#1A1A1A' }} />
          ))}
        </div>
      </div>
    );
  }

  if (traders.length === 0) {
    return (
      <div className="rounded-lg overflow-hidden" style={{ background: '#141414', border: '1px solid #1F1F1F' }}>
        <div className="p-5 border-b" style={{ borderColor: '#1F1F1F' }}>
          <h2 className="text-lg font-bold text-white">[ LEADERBOARD ]</h2>
        </div>
        <div className="p-12 text-center" style={{ color: '#6B6B6B' }}>
          <p>No trading data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#141414', border: '1px solid #1F1F1F' }}>
      {/* Header */}
      <div className="p-5 border-b" style={{ borderColor: '#1F1F1F' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">[ LEADERBOARD ]</h2>
            <p className="text-sm mt-1" style={{ color: '#6B6B6B' }}>
              Top traders by {periodLabel} volume • {activeTraders.length} active traders
            </p>
          </div>
          <div className="flex items-center gap-2">
            {[50, 100, 200].map((count) => (
              <button
                key={count}
                onClick={() => setShowCount(count)}
                className="px-3 py-1.5 text-sm font-medium rounded transition-all"
                style={{
                  background: showCount === count ? '#22C55E' : '#1A1A1A',
                  color: showCount === count ? '#000' : '#6B6B6B',
                  border: showCount === count ? 'none' : '1px solid #2A2A2A',
                }}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by wallet address (0x...)"
              className="w-full px-4 py-2.5 text-sm font-mono rounded-lg outline-none transition-all"
              style={{
                background: '#0D0D0D',
                color: '#FFFFFF',
                border: '1px solid #2A2A2A',
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#22C55E'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#2A2A2A'}
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm transition-colors"
                style={{ color: '#6B6B6B' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#FFFFFF'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#6B6B6B'}
              >
                ✕
              </button>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="px-5 py-2.5 text-sm font-medium rounded-lg transition-all disabled:opacity-40"
            style={{
              background: '#22C55E',
              color: '#000000',
            }}
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Search Error */}
      {searchError && (
        <div
          className="mx-5 mt-4 p-3 rounded-lg text-sm"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#EF4444',
          }}
        >
          {searchError}
        </div>
      )}

      {/* Search Result Card */}
      {searchResult && (
        <div className="mx-5 mt-4">
          <div
            className="p-4 rounded-lg"
            style={{
              background: searchResult.found ? 'rgba(34, 197, 94, 0.08)' : 'rgba(107, 107, 107, 0.1)',
              border: `1px solid ${searchResult.found ? 'rgba(34, 197, 94, 0.3)' : '#2A2A2A'}`,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium px-2 py-1 rounded" style={{
                  background: searchResult.found ? '#22C55E' : '#2A2A2A',
                  color: searchResult.found ? '#000' : '#6B6B6B',
                }}>
                  {searchResult.found ? (searchResult.rank ? `RANK #${searchResult.rank}` : 'FOUND') : 'NOT FOUND'}
                </span>
                <a
                  href={`https://explorer.inkonchain.com/address/${searchResult.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm hover:underline"
                  style={{ color: '#FFFFFF' }}
                >
                  {truncateAddress(searchResult.address)}
                </a>
              </div>
              <button
                onClick={clearSearch}
                className="text-xs px-2 py-1 rounded transition-colors"
                style={{ color: '#6B6B6B', background: '#1A1A1A' }}
              >
                Dismiss
              </button>
            </div>

            {searchResult.found ? (
              <div>
                <div className="flex items-center gap-6 mb-3">
                  <div>
                    <div className="text-xs" style={{ color: '#6B6B6B' }}>Total Volume</div>
                    <div className="font-mono font-bold text-lg" style={{ color: '#22C55E' }}>
                      {formatVolume(searchResult.totalVolume)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: '#6B6B6B' }}>Markets</div>
                    <div className="font-mono font-bold text-lg text-white">
                      {searchResult.productCount}
                    </div>
                  </div>
                  {searchResult.rank && (
                    <div>
                      <div className="text-xs" style={{ color: '#6B6B6B' }}>Leaderboard Rank</div>
                      <div className="font-mono font-bold text-lg" style={{
                        color: searchResult.rank === 1 ? '#FFD700' :
                               searchResult.rank === 2 ? '#C0C0C0' :
                               searchResult.rank === 3 ? '#CD7F32' : '#FFFFFF'
                      }}>
                        #{searchResult.rank}
                      </div>
                    </div>
                  )}
                </div>

                {searchResult.products.length > 0 && (
                  <div>
                    <div className="text-xs mb-2" style={{ color: '#6B6B6B' }}>Volume by Market</div>
                    <div className="flex flex-wrap gap-2">
                      {searchResult.products.map((p) => (
                        <span
                          key={p.name}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono"
                          style={{ background: '#1A1A1A', border: '1px solid #2A2A2A' }}
                        >
                          <span style={{ color: '#A1A1A1' }}>{p.name}</span>
                          <span style={{ color: '#22C55E' }}>{formatVolume(p.volume)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm" style={{ color: '#6B6B6B' }}>
                No perp trading activity found for this address on Nado.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ background: '#0D0D0D' }}>
              <th
                className="text-left py-3 px-5 text-xs font-medium cursor-pointer hover:text-white transition-colors"
                style={{ color: '#6B6B6B' }}
                onClick={() => handleSort('rank')}
              >
                RANK <SortIcon field="rank" />
              </th>
              <th className="text-left py-3 px-5 text-xs font-medium" style={{ color: '#6B6B6B' }}>
                TRADER
              </th>
              <th
                className="text-right py-3 px-5 text-xs font-medium cursor-pointer hover:text-white transition-colors"
                style={{ color: '#6B6B6B' }}
                onClick={() => handleSort('volume')}
              >
                {periodLabel} VOLUME <SortIcon field="volume" />
              </th>
              <th
                className="text-right py-3 px-5 text-xs font-medium cursor-pointer hover:text-white transition-colors"
                style={{ color: '#6B6B6B' }}
                onClick={() => handleSort('share')}
              >
                % VOL <SortIcon field="share" />
              </th>
              <th
                className="text-right py-3 px-5 text-xs font-medium cursor-pointer hover:text-white transition-colors"
                style={{ color: '#6B6B6B' }}
                onClick={() => handleSort('products')}
              >
                MARKETS <SortIcon field="products" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedTraders.slice(0, showCount).map((trader) => {
              const rank = getRank(trader, period);
              const volume = getVolume(trader, period);
              const share = getShare(trader, period);
              const isTop3 = rank !== undefined && rank <= 3;
              const isSearched = searchResult?.found && trader.address.toLowerCase() === searchResult.address.toLowerCase();

              return (
                <tr
                  key={trader.address}
                  className="transition-colors"
                  style={{
                    borderTop: '1px solid #1F1F1F',
                    background: isSearched ? 'rgba(34, 197, 94, 0.12)' : isTop3 ? 'rgba(34, 197, 94, 0.05)' : 'transparent',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#1A1A1A'}
                  onMouseLeave={(e) => e.currentTarget.style.background = isSearched ? 'rgba(34, 197, 94, 0.12)' : isTop3 ? 'rgba(34, 197, 94, 0.05)' : 'transparent'}
                >
                  {/* Rank */}
                  <td className="py-4 px-5">
                    <span
                      className="font-mono font-bold text-sm"
                      style={{
                        color: rank === 1 ? '#FFD700' :
                               rank === 2 ? '#C0C0C0' :
                               rank === 3 ? '#CD7F32' : '#6B6B6B'
                      }}
                    >
                      {rank ? `#${rank}` : '-'}
                    </span>
                  </td>

                  {/* Trader Address */}
                  <td className="py-4 px-5">
                    <a
                      href={`https://explorer.inkonchain.com/address/${trader.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm flex items-center gap-2 group"
                      style={{ color: '#FFFFFF' }}
                    >
                      {truncateAddress(trader.address)}
                      <svg
                        className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: '#6B6B6B' }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </td>

                  {/* Volume */}
                  <td className="py-4 px-5 text-right">
                    <span className="font-mono font-bold" style={{ color: '#22C55E' }}>
                      {formatVolume(volume)}
                    </span>
                  </td>

                  {/* Volume Share */}
                  <td className="py-4 px-5 text-right">
                    <span className="font-mono text-sm" style={{ color: '#A1A1A1' }}>
                      {share >= 0.01 ? `${share.toFixed(2)}%` : share > 0 ? '<0.01%' : '-'}
                    </span>
                  </td>

                  {/* Markets */}
                  <td className="py-4 px-5 text-right">
                    <span
                      className="inline-flex items-center px-2 py-1 rounded text-xs font-mono"
                      style={{ background: '#1A1A1A', color: '#A1A1A1' }}
                    >
                      {trader.productCount}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {activeTraders.length > showCount && (
        <div className="p-4 border-t text-center" style={{ borderColor: '#1F1F1F' }}>
          <button
            onClick={() => setShowCount(Math.min(showCount + 50, activeTraders.length))}
            className="px-4 py-2 text-sm font-medium rounded transition-all"
            style={{ background: '#1A1A1A', color: '#A1A1A1', border: '1px solid #2A2A2A' }}
          >
            Load More ({Math.min(50, activeTraders.length - showCount)} more)
          </button>
        </div>
      )}
    </div>
  );
}
