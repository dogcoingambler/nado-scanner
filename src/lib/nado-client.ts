// Nado API Client for fetching trader and volume data
// Based on Nado API documentation: https://docs.nado.xyz/developer-resources/api

import type {
  AggregatedTraderData,
  VolumeDataPoint,
  ProductVolume,
  DashboardData,
} from './types';

// API endpoints (Production)
const ARCHIVE_URL = 'https://archive.prod.nado.xyz/v1';
const GATEWAY_URL = 'https://gateway.prod.nado.xyz/v1';
const DEFILLAMA_DERIVATIVES_URL = 'https://api.llama.fi/summary/derivatives/nado';

// Required headers for Nado API
const API_HEADERS = {
  'Content-Type': 'application/json',
  'Accept-Encoding': 'gzip, deflate, br',
};

// Product name mapping from Nado Gateway API
const PRODUCT_NAMES: Record<number, string> = {
  0: 'USDT0',
  1: 'KBTC',
  2: 'BTC-PERP',
  3: 'WETH',
  4: 'ETH-PERP',
  5: 'USDC',
  8: 'SOL-PERP',
  10: 'XRP-PERP',
  14: 'BNB-PERP',
  16: 'HYPE-PERP',
  18: 'ZEC-PERP',
  20: 'MON-PERP',
  22: 'FARTCOIN-PERP',
  24: 'SUI-PERP',
  26: 'AAVE-PERP',
  28: 'XAUT-PERP',
  30: 'PUMP-PERP',
  32: 'TAO-PERP',
  34: 'XMR-PERP',
  36: 'LIT-PERP',
  38: 'kPEPE-PERP',
  40: 'PENGU-PERP',
  42: 'USELESS-PERP',
  44: 'SKR-PERP',
  46: 'UNI-PERP',
  48: 'ASTER-PERP',
  50: 'XPL-PERP',
};

// Spot product IDs (not perps)
const SPOT_PRODUCT_IDS = [0, 1, 3, 5];

// Convert x18 format to number
function fromX18(value: string): number {
  try {
    const num = BigInt(value);
    const divisor = BigInt(10 ** 18);
    const integerPart = num / divisor;
    const fractionalPart = num % divisor;
    const result = Number(integerPart) + Number(fractionalPart) / 10 ** 18;
    return result;
  } catch {
    return 0;
  }
}

// Truncate address for display
export function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Extract wallet address from subaccount (first 42 chars)
function extractWalletAddress(subaccount: string): string {
  if (!subaccount || subaccount.length < 42) return subaccount;
  return subaccount.slice(0, 42).toLowerCase();
}

// Format large numbers
export function formatVolume(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

// Check if product is a perp (not spot)
function isPerpProduct(productId: number): boolean {
  return !SPOT_PRODUCT_IDS.includes(productId) && productId >= 2;
}

function getProductName(productId: number): string {
  return PRODUCT_NAMES[productId] || `PERP-${productId}`;
}

// Subaccount info from archive
interface SubaccountInfo {
  id: string;
  address: string;
  subaccount: string;
  subaccount_name: string;
  created_at: string;
  isolated: boolean;
}

// Account snapshot product data
interface AccountSnapshotProduct {
  product_id: number;
  quote_volume_cumulative: string;
  net_funding_cumulative: string;
  net_entry_cumulative: string;
}

interface DefiLlamaDerivativesResponse {
  total24h: number;
  total7d: number;
  total30d: number;
  totalAllTime: number;
  change_1d: number;
  totalDataChart: [number, number][];
}

// Fetch derivatives volume stats from DefiLlama
async function fetchDerivativesStats(): Promise<DefiLlamaDerivativesResponse | null> {
  try {
    const response = await fetch(DEFILLAMA_DERIVATIVES_URL);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Error fetching DefiLlama derivatives data:', error);
    return null;
  }
}

// ============================================================
// WALLET LOOKUP - instant lookup for any address
// ============================================================

// Find subaccounts for a given wallet address
// Uses cached index from leaderboard scan when available (instant)
// Falls back to full API scan if index is stale/missing (~8s)
async function findSubaccountsForWallet(walletAddress: string): Promise<string[]> {
  const addr = walletAddress.toLowerCase();

  // Try cached index first (instant lookup)
  if (subaccountIndex && Date.now() - subaccountIndexTimestamp < SUBACCOUNT_INDEX_TTL_MS) {
    const cached = subaccountIndex.get(addr);
    if (cached && cached.length > 0) {
      console.log(`Found ${cached.length} subaccounts for ${addr} from index (instant)`);
      return cached;
    }
    // Address not in index — they may have no subaccounts, but let's verify with API
    // since the index may not be 100% complete
  }

  // Build the index if we don't have one (fetches all subaccounts once)
  if (!subaccountIndex || Date.now() - subaccountIndexTimestamp >= SUBACCOUNT_INDEX_TTL_MS) {
    console.log('Building subaccount index for wallet lookup...');
    const allSubs = await fetchAllSubaccounts(40000);
    buildSubaccountIndex(allSubs);

    const cached = subaccountIndex!.get(addr);
    if (cached && cached.length > 0) {
      console.log(`Found ${cached.length} subaccounts for ${addr} from fresh index`);
      return cached;
    }
  }

  // Not found in complete index
  console.log(`No subaccounts found for ${addr}`);
  return [];
}

// Fetch snapshot for specific subaccounts
async function fetchSnapshotsForSubaccounts(
  subaccountIds: string[]
): Promise<Map<string, AccountSnapshotProduct[]>> {
  const result = new Map<string, AccountSnapshotProduct[]>();
  const now = Math.floor(Date.now() / 1000);
  const batchSize = 40;

  for (let i = 0; i < subaccountIds.length; i += batchSize) {
    const batch = subaccountIds.slice(i, i + batchSize);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(ARCHIVE_URL, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({
          account_snapshots: { subaccounts: batch, timestamps: [now] },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!response.ok) continue;

      const data = await response.json();
      if (data.error) continue;

      const snapshots = data.snapshots || {};
      for (const [subaccount, timestampData] of Object.entries(snapshots)) {
        const tsData = timestampData as Record<string, unknown>;
        const tsKeys = Object.keys(tsData);
        if (tsKeys.length > 0) {
          const products = tsData[tsKeys[0]] as AccountSnapshotProduct[];
          if (Array.isArray(products)) {
            result.set(subaccount, products);
          }
        }
      }
    } catch {
      continue;
    }
  }

  return result;
}

// Wallet lookup result type
export interface WalletLookupResult {
  address: string;
  totalVolume: number;
  productCount: number;
  products: { name: string; volume: number }[];
  rank: number | null;
  found: boolean;
}

// Lookup a single wallet's trading data
// Completely standalone — finds subaccounts and fetches snapshots directly
export async function lookupWallet(walletAddress: string): Promise<WalletLookupResult> {
  const addr = walletAddress.toLowerCase();
  console.log(`[lookupWallet] Looking up ${addr}`);

  // Find subaccounts for this wallet (uses cached index if available)
  const subaccounts = await findSubaccountsForWallet(addr);
  if (subaccounts.length === 0) {
    console.log(`[lookupWallet] No subaccounts found for ${addr}`);
    return { address: addr, totalVolume: 0, productCount: 0, products: [], rank: null, found: false };
  }

  console.log(`[lookupWallet] Found ${subaccounts.length} subaccounts, fetching snapshots...`);
  const snapshots = await fetchSnapshotsForSubaccounts(subaccounts);

  let totalVolume = 0;
  const productVolumes = new Map<number, number>();

  for (const [, products] of snapshots) {
    for (const product of products) {
      if (!isPerpProduct(product.product_id)) continue;
      const volume = Math.abs(fromX18(product.quote_volume_cumulative || '0'));
      if (volume === 0) continue;
      totalVolume += volume;
      const prev = productVolumes.get(product.product_id) || 0;
      productVolumes.set(product.product_id, prev + volume);
    }
  }

  const products = Array.from(productVolumes.entries())
    .map(([pid, vol]) => ({ name: getProductName(pid), volume: vol }))
    .sort((a, b) => b.volume - a.volume);

  // Check cached leaderboard for rank
  let rank: number | null = null;
  const cached = dataCache.get('all');
  if (cached) {
    const existing = cached.data.traders.find(t => t.address.toLowerCase() === addr);
    if (existing?.rank) rank = existing.rank;
  }

  console.log(`[lookupWallet] ${addr}: vol=$${totalVolume.toFixed(0)}, ${products.length} markets, rank=${rank}`);

  return {
    address: addr,
    totalVolume,
    productCount: products.length,
    products,
    rank,
    found: totalVolume > 0 || subaccounts.length > 0,
  };
}

// ============================================================
// LEADERBOARD - full scan with optimized batching
// ============================================================

// Fetch all subaccounts with concurrent pagination
async function fetchAllSubaccounts(maxSubaccounts: number = 40000): Promise<SubaccountInfo[]> {
  const pageSize = 500;
  const maxPages = Math.ceil(maxSubaccounts / pageSize);
  const concurrency = 10;

  console.log('Fetching subaccounts concurrently...');
  const startTime = Date.now();

  const allResults: { start: number; subs: SubaccountInfo[] }[] = [];

  for (let pageStart = 0; pageStart < maxPages; pageStart += concurrency) {
    const pagePromises = [];

    for (let p = 0; p < concurrency && (pageStart + p) < maxPages; p++) {
      const start = (pageStart + p) * pageSize;
      pagePromises.push(
        (async () => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(ARCHIVE_URL, {
              method: 'POST',
              headers: API_HEADERS,
              body: JSON.stringify({ subaccounts: { start, limit: pageSize } }),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);
            if (!response.ok) return { start, subs: [] as SubaccountInfo[] };

            const data = await response.json();
            return { start, subs: (data.subaccounts || []) as SubaccountInfo[] };
          } catch {
            return { start, subs: [] as SubaccountInfo[] };
          }
        })()
      );
    }

    const results = await Promise.all(pagePromises);
    allResults.push(...results);

    const sorted = results.sort((a, b) => a.start - b.start);
    const lastNonEmpty = sorted.filter(r => r.subs.length > 0);
    if (lastNonEmpty.length === 0) break;
    if (sorted.some(r => r.subs.length > 0 && r.subs.length < pageSize)) break;
  }

  allResults.sort((a, b) => a.start - b.start);
  const allSubaccounts: SubaccountInfo[] = [];

  for (const { subs } of allResults) {
    for (const sub of subs) {
      if (sub.address && !sub.address.includes('0000000000000000000000000000000000000000')) {
        allSubaccounts.push(sub);
      }
    }
  }

  console.log(`Fetched ${allSubaccounts.length} subaccounts in ${Date.now() - startTime}ms`);
  return allSubaccounts;
}

// Fetch a single batch of account snapshots with retry
async function fetchSnapshotBatch(
  batch: string[],
  timestamp: number,
  retries = 2
): Promise<[string, AccountSnapshotProduct[]][]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(ARCHIVE_URL, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({
          account_snapshots: {
            subaccounts: batch,
            timestamps: [timestamp],
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
          continue;
        }
        return [];
      }

      const data = await response.json();
      if (data.error) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
          continue;
        }
        return [];
      }

      const entries: [string, AccountSnapshotProduct[]][] = [];
      const snapshots = data.snapshots || {};

      for (const [subaccount, timestampData] of Object.entries(snapshots)) {
        const tsData = timestampData as Record<string, unknown>;
        const tsKeys = Object.keys(tsData);
        if (tsKeys.length > 0) {
          const products = tsData[tsKeys[0]] as AccountSnapshotProduct[];
          if (Array.isArray(products)) {
            entries.push([subaccount, products]);
          }
        }
      }
      return entries;
    } catch {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
        continue;
      }
      return [];
    }
  }
  return [];
}

// Fetch account snapshots for multiple subaccounts
async function fetchAccountSnapshots(
  subaccounts: string[],
  timestamp: number
): Promise<Map<string, AccountSnapshotProduct[]>> {
  const result = new Map<string, AccountSnapshotProduct[]>();

  const batchSize = 40;
  const concurrency = 5; // Lower concurrency = less rate limiting = more reliable
  const batches: string[][] = [];

  for (let i = 0; i < subaccounts.length; i += batchSize) {
    batches.push(subaccounts.slice(i, i + batchSize));
  }

  console.log(`Fetching snapshots: ${batches.length} batches of ${batchSize}, ${concurrency} concurrent`);
  const startTime = Date.now();

  for (let i = 0; i < batches.length; i += concurrency) {
    const concurrentBatches = batches.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      concurrentBatches.map(batch => fetchSnapshotBatch(batch, timestamp))
    );

    for (const entries of batchResults) {
      for (const [subaccount, products] of entries) {
        result.set(subaccount, products);
      }
    }

    // Delay between concurrent rounds to avoid rate limiting
    if (i + concurrency < batches.length) {
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    const processed = Math.min(i + concurrency, batches.length);
    if (processed % 50 === 0) {
      console.log(`  Snapshots: ${processed}/${batches.length} batches (${result.size} subaccounts so far)`);
    }
  }

  console.log(`Fetched snapshots for ${result.size}/${subaccounts.length} subaccounts in ${Date.now() - startTime}ms`);
  return result;
}

// Aggregate trader data from account snapshots
function aggregateTraderDataFromSnapshots(
  snapshotsMap: Map<string, AccountSnapshotProduct[]>
): {
  traders: AggregatedTraderData[];
  productVolumes: Map<number, number>;
  totalVolume: number;
} {
  const traderMap = new Map<string, {
    address: string;
    totalVolume: number;
    products: Set<number>;
  }>();

  const productVolumes = new Map<number, number>();
  let totalVolume = 0;

  for (const [subaccount, products] of snapshotsMap) {
    const address = extractWalletAddress(subaccount);

    for (const product of products) {
      if (!isPerpProduct(product.product_id)) continue;

      const volume = Math.abs(fromX18(product.quote_volume_cumulative || '0'));
      if (volume === 0) continue;

      totalVolume += volume;

      if (!traderMap.has(address)) {
        traderMap.set(address, {
          address,
          totalVolume: 0,
          products: new Set(),
        });
      }

      const trader = traderMap.get(address)!;
      trader.totalVolume += volume;
      trader.products.add(product.product_id);

      const currentProductVol = productVolumes.get(product.product_id) || 0;
      productVolumes.set(product.product_id, currentProductVol + volume);
    }
  }

  const traders: AggregatedTraderData[] = Array.from(traderMap.values())
    .map((t) => ({
      address: t.address,
      totalVolumeUsd: t.totalVolume,
      tradeCount: 0,
      buyVolumeUsd: t.totalVolume / 2,
      sellVolumeUsd: t.totalVolume / 2,
      avgTradeSizeUsd: 0,
      lastActive: new Date().toISOString(),
      productCount: t.products.size,
      totalFees: 0,
      rank: 0,
    }))
    .sort((a, b) => b.totalVolumeUsd - a.totalVolumeUsd)
    .map((trader, index) => ({ ...trader, rank: index + 1 }));

  return { traders, productVolumes, totalVolume };
}

function formatProductVolumes(productVolumes: Map<number, number>): ProductVolume[] {
  return Array.from(productVolumes.entries())
    .map(([productId, volume]) => ({
      productId,
      name: getProductName(productId),
      volume24h: volume,
      tradeCount: 0,
    }))
    .sort((a, b) => b.volume24h - a.volume24h);
}

// ============================================================
// CACHE + SUBACCOUNT INDEX
// ============================================================

interface CacheEntry {
  data: DashboardData;
  timestamp: number;
}

const dataCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
let isRefreshing = false;

// Subaccount index: maps wallet address → subaccount IDs
// Populated by the leaderboard scan so wallet lookups are instant
let subaccountIndex: Map<string, string[]> | null = null;
let subaccountIndexTimestamp = 0;
const SUBACCOUNT_INDEX_TTL_MS = 10 * 60 * 1000; // 10 minutes

function buildSubaccountIndex(subaccounts: SubaccountInfo[]): void {
  const index = new Map<string, string[]>();
  for (const sub of subaccounts) {
    if (!sub.address) continue;
    const addr = sub.address.toLowerCase();
    const existing = index.get(addr) || [];
    existing.push(sub.subaccount);
    index.set(addr, existing);
  }
  subaccountIndex = index;
  subaccountIndexTimestamp = Date.now();
  console.log(`Built subaccount index: ${index.size} wallets → ${subaccounts.length} subaccounts`);
}

// Main function to fetch dashboard data
export async function fetchDashboardData(
  period: 'all' | '7d' | '24h' = '24h'
): Promise<DashboardData> {
  // Check cache first
  const cached = dataCache.get(period);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`Returning cached data for period: ${period} (${Math.round((Date.now() - cached.timestamp) / 1000)}s old)`);
    return cached.data;
  }

  // If stale cache exists and another refresh is in progress, return stale data
  if (cached && isRefreshing) {
    console.log(`Returning stale cached data while refresh in progress`);
    return cached.data;
  }

  console.log(`Fetching dashboard data for period: ${period}`);
  isRefreshing = true;

  try {
    // Fetch derivatives stats and all subaccounts concurrently
    const [volumeStats, subaccounts] = await Promise.all([
      fetchDerivativesStats(),
      fetchAllSubaccounts(40000),
    ]);

    console.log('DefiLlama derivatives stats:', {
      total24h: volumeStats?.total24h,
      total7d: volumeStats?.total7d,
      totalAllTime: volumeStats?.totalAllTime,
    });
    console.log(`Processing ${subaccounts.length} subaccounts`);

    // Build subaccount index for fast wallet lookups
    buildSubaccountIndex(subaccounts);

    const now = Math.floor(Date.now() / 1000);

    const subaccountIds = subaccounts.map(s => s.subaccount);
    const snapshots = await fetchAccountSnapshots(subaccountIds, now);
    console.log(`Got snapshots for ${snapshots.size} subaccounts`);

    const { traders, productVolumes, totalVolume } = aggregateTraderDataFromSnapshots(snapshots);
    console.log(`Aggregated ${traders.length} traders with $${formatVolume(totalVolume)} total volume`);

    const formattedProductVolumes = formatProductVolumes(productVolumes);

    const volumeHistory: VolumeDataPoint[] = [];
    if (volumeStats?.totalDataChart) {
      const chartData = volumeStats.totalDataChart;
      const dataToUse = period === '24h'
        ? chartData.slice(-2)
        : period === '7d'
          ? chartData.slice(-7)
          : chartData.slice(-30);

      for (const [timestamp, volume] of dataToUse) {
        const date = new Date(timestamp * 1000);
        volumeHistory.push({
          timestamp: date.toISOString(),
          date: date.toLocaleDateString(),
          volume,
          tradeCount: 0,
        });
      }
    }

    const result: DashboardData = {
      traders,
      totalVolume24h: volumeStats?.total24h || 0,
      totalVolume7d: volumeStats?.total7d || 0,
      totalVolumeAllTime: volumeStats?.totalAllTime || 0,
      totalTrades24h: 0,
      uniqueTraders24h: traders.length,
      volumeHistory,
      productVolumes: formattedProductVolumes,
      lastUpdated: new Date().toISOString(),
      change1d: volumeStats?.change_1d || 0,
      calculatedVolume: totalVolume,
    };

    dataCache.set(period, { data: result, timestamp: Date.now() });
    isRefreshing = false;

    return result;
  } catch (error) {
    isRefreshing = false;
    const message = error instanceof Error ? error.message : String(error);
    console.error('fetchDashboardData error:', message);
    throw new Error(`Failed to fetch dashboard data: ${message}`);
  }
}

// Export utilities
export {
  fetchDerivativesStats,
  fetchAllSubaccounts,
  fetchAccountSnapshots,
  fromX18,
  getProductName,
  isPerpProduct,
};
