// Nado API Client for fetching trader and volume data
// Based on Nado API documentation: https://docs.nado.xyz/developer-resources/api

import type {
  AggregatedTraderData,
  VolumeDataPoint,
  ProductVolume,
  DashboardData,
  Epoch,
  UserGrowthPoint,
  OpenInterestData,
  EpochLeaderboard,
  EpochTraderData,
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

// ============================================================
// NADO SEASON 1 EPOCH SCHEDULE
// All times are UTC midnight boundaries
// ============================================================
const EPOCHS: Epoch[] = [
  { name: 'Private Alpha',   start: '2025-11-21T00:00:00Z', end: '2026-01-16T00:00:00Z' },
  { name: 'Off Season Wk 1', start: '2026-01-16T00:00:00Z', end: '2026-01-23T00:00:00Z' },
  { name: 'Off Season Wk 2', start: '2026-01-23T00:00:00Z', end: '2026-01-31T00:00:00Z' },
  { name: 'Season 1 Wk 1',   start: '2026-01-31T00:00:00Z', end: '2026-02-06T00:00:00Z' },
  { name: 'Season 1 Wk 2',   start: '2026-02-06T00:00:00Z', end: '2026-02-13T00:00:00Z' },
  { name: 'Season 1 Wk 3',   start: '2026-02-13T00:00:00Z', end: '2026-02-20T00:00:00Z' },
  { name: 'Season 1 Wk 4',   start: '2026-02-20T00:00:00Z', end: '2026-02-27T00:00:00Z' },
  { name: 'Season 1 Wk 5',   start: '2026-02-27T00:00:00Z', end: '2026-03-06T00:00:00Z' },
  { name: 'Season 1 Wk 6',   start: '2026-03-06T00:00:00Z', end: '2026-03-13T00:00:00Z' },
  { name: 'Season 1 Wk 7',   start: '2026-03-13T00:00:00Z', end: '2026-03-20T00:00:00Z' },
  { name: 'Season 1 Wk 8',   start: '2026-03-20T00:00:00Z', end: '2026-03-27T00:00:00Z' },
];

// Find the current epoch based on the current time
function getCurrentEpoch(): Epoch | null {
  const now = new Date();
  for (const epoch of EPOCHS) {
    if (now >= new Date(epoch.start) && now < new Date(epoch.end)) {
      return epoch;
    }
  }
  // If past all defined epochs, return the last one
  const last = EPOCHS[EPOCHS.length - 1];
  if (now >= new Date(last.end)) return last;
  return null;
}

export { EPOCHS, getCurrentEpoch };

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

// Fetch snapshots for multiple timestamps in a single pass
// batch size = floor(40 / timestamps.length) to stay within API limit
async function fetchAccountSnapshotsMultiTimestamp(
  subaccounts: string[],
  timestamps: number[],
): Promise<Map<number, Map<string, AccountSnapshotProduct[]>>> {
  const tsCount = timestamps.length;
  const batchSize = Math.floor(40 / tsCount); // 13 for 3 timestamps
  const concurrency = 5;
  const batches: string[][] = [];

  for (let i = 0; i < subaccounts.length; i += batchSize) {
    batches.push(subaccounts.slice(i, i + batchSize));
  }

  console.log(`Fetching multi-ts snapshots: ${batches.length} batches of ${batchSize} × ${tsCount} timestamps, ${concurrency} concurrent`);
  const startTime = Date.now();

  // Initialize result maps per timestamp
  const result = new Map<number, Map<string, AccountSnapshotProduct[]>>();
  for (const ts of timestamps) {
    result.set(ts, new Map());
  }

  for (let i = 0; i < batches.length; i += concurrency) {
    const concurrentBatches = batches.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      concurrentBatches.map(async (batch) => {
        for (let attempt = 0; attempt <= 2; attempt++) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(ARCHIVE_URL, {
              method: 'POST',
              headers: API_HEADERS,
              body: JSON.stringify({
                account_snapshots: { subaccounts: batch, timestamps },
              }),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);
            if (!response.ok) {
              if (attempt < 2) {
                await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
                continue;
              }
              return [];
            }

            const data = await response.json();
            if (data.error) {
              if (attempt < 2) {
                await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
                continue;
              }
              return [];
            }

            // Parse: snapshots[subaccount][timestamp] = products[]
            const entries: { subaccount: string; timestamp: number; products: AccountSnapshotProduct[] }[] = [];
            const snapshots = data.snapshots || {};
            for (const [subaccount, timestampData] of Object.entries(snapshots)) {
              const tsData = timestampData as Record<string, unknown>;
              for (const [tsStr, products] of Object.entries(tsData)) {
                const ts = parseInt(tsStr);
                if (Array.isArray(products)) {
                  entries.push({ subaccount, timestamp: ts, products: products as AccountSnapshotProduct[] });
                }
              }
            }
            return entries;
          } catch {
            if (attempt < 2) {
              await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
              continue;
            }
            return [];
          }
        }
        return [];
      })
    );

    for (const entries of batchResults) {
      for (const { subaccount, timestamp, products } of entries) {
        const tsMap = result.get(timestamp);
        if (tsMap) {
          tsMap.set(subaccount, products);
        }
      }
    }

    if (i + concurrency < batches.length) {
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    const processed = Math.min(i + concurrency, batches.length);
    if (processed % 150 === 0) {
      const firstTs = result.get(timestamps[0]);
      console.log(`  Multi-ts snapshots: ${processed}/${batches.length} batches (${firstTs?.size || 0} subaccounts so far)`);
    }
  }

  const elapsed = Date.now() - startTime;
  const firstTs = result.get(timestamps[0]);
  console.log(`Fetched multi-ts snapshots for ${firstTs?.size || 0} subaccounts in ${elapsed}ms`);
  return result;
}

// Helper: extract per-subaccount cumulative volume from a snapshot map
function extractCumulativeVolumes(
  snapshotsMap: Map<string, AccountSnapshotProduct[]>
): Map<string, Map<number, number>> {
  // Returns: subaccount → (product_id → cumulative_volume)
  const result = new Map<string, Map<number, number>>();
  for (const [subaccount, products] of snapshotsMap) {
    const productMap = new Map<number, number>();
    for (const product of products) {
      if (!isPerpProduct(product.product_id)) continue;
      const volume = Math.abs(fromX18(product.quote_volume_cumulative || '0'));
      productMap.set(product.product_id, volume);
    }
    result.set(subaccount, productMap);
  }
  return result;
}

// Compute period volume = cumulative_now - cumulative_past
// ONLY includes subaccounts present in BOTH snapshots to avoid
// treating missing past data as "all volume is in this period"
function computePeriodVolume(
  nowVolumes: Map<string, Map<number, number>>,
  pastVolumes: Map<string, Map<number, number>> | null
): Map<string, Map<number, number>> {
  const result = new Map<string, Map<number, number>>();
  if (!pastVolumes) return result;

  for (const [subaccount, nowProducts] of nowVolumes) {
    const pastProducts = pastVolumes.get(subaccount);
    // Skip subaccounts missing from past snapshot — we can't compute their period volume
    if (!pastProducts) continue;

    const periodProducts = new Map<number, number>();
    for (const [productId, nowVol] of nowProducts) {
      const pastVol = pastProducts.get(productId) || 0;
      const diff = nowVol - pastVol;
      if (diff > 0) {
        periodProducts.set(productId, diff);
      }
    }
    if (periodProducts.size > 0) {
      result.set(subaccount, periodProducts);
    }
  }
  return result;
}

// Aggregate trader data from multi-period snapshots
function aggregateTraderDataMultiPeriod(
  nowSnapshots: Map<string, AccountSnapshotProduct[]>,
  snapshots24hAgo: Map<string, AccountSnapshotProduct[]> | null,
  snapshotsEpochStart: Map<string, AccountSnapshotProduct[]> | null,
): {
  traders: AggregatedTraderData[];
  productVolumes: Map<number, number>;
  totalVolume: number;
} {
  const nowVolumes = extractCumulativeVolumes(nowSnapshots);
  const past24hVolumes = snapshots24hAgo ? extractCumulativeVolumes(snapshots24hAgo) : null;
  const epochStartVolumes = snapshotsEpochStart ? extractCumulativeVolumes(snapshotsEpochStart) : null;

  // All-time = cumulative now
  // 24h volume = now - 24h ago
  // Epoch volume = now - epoch start
  const volumes24h = computePeriodVolume(nowVolumes, past24hVolumes);
  const volumesEpoch = computePeriodVolume(nowVolumes, epochStartVolumes);

  // Aggregate per wallet
  const traderMap = new Map<string, {
    address: string;
    totalVolume: number;
    volume24h: number;
    volumeEpoch: number;
    products: Set<number>;
  }>();

  const productVolumes = new Map<number, number>();
  let totalVolume = 0;
  let totalVolume24h = 0;
  let totalVolumeEpoch = 0;

  // Process all-time volumes from nowVolumes
  for (const [subaccount, productMap] of nowVolumes) {
    const address = extractWalletAddress(subaccount);

    if (!traderMap.has(address)) {
      traderMap.set(address, { address, totalVolume: 0, volume24h: 0, volumeEpoch: 0, products: new Set() });
    }
    const trader = traderMap.get(address)!;

    for (const [productId, vol] of productMap) {
      if (vol === 0) continue;
      trader.totalVolume += vol;
      trader.products.add(productId);
      totalVolume += vol;

      const currentProductVol = productVolumes.get(productId) || 0;
      productVolumes.set(productId, currentProductVol + vol);
    }
  }

  // Add 24h volumes
  for (const [subaccount, productMap] of volumes24h) {
    const address = extractWalletAddress(subaccount);
    const trader = traderMap.get(address);
    if (!trader) continue;
    for (const [, vol] of productMap) {
      trader.volume24h += vol;
      totalVolume24h += vol;
    }
  }

  // Add epoch volumes
  for (const [subaccount, productMap] of volumesEpoch) {
    const address = extractWalletAddress(subaccount);
    const trader = traderMap.get(address);
    if (!trader) continue;
    for (const [, vol] of productMap) {
      trader.volumeEpoch += vol;
      totalVolumeEpoch += vol;
    }
  }

  // Build trader list with all fields
  const traders: AggregatedTraderData[] = Array.from(traderMap.values())
    .filter(t => t.totalVolume > 0)
    .map((t) => ({
      address: t.address,
      totalVolumeUsd: t.totalVolume,
      volumeEpoch: t.volumeEpoch,
      volume24h: t.volume24h,
      volumeShare: totalVolume > 0 ? (t.totalVolume / totalVolume) * 100 : 0,
      volumeShareEpoch: totalVolumeEpoch > 0 ? (t.volumeEpoch / totalVolumeEpoch) * 100 : 0,
      volumeShare24h: totalVolume24h > 0 ? (t.volume24h / totalVolume24h) * 100 : 0,
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

  // Compute epoch and 24h ranks
  const sortedEpoch = [...traders].sort((a, b) => b.volumeEpoch - a.volumeEpoch);
  sortedEpoch.forEach((t, i) => {
    const orig = traders.find(tr => tr.address === t.address);
    if (orig) orig.rankEpoch = t.volumeEpoch > 0 ? i + 1 : undefined;
  });

  const sorted24h = [...traders].sort((a, b) => b.volume24h - a.volume24h);
  sorted24h.forEach((t, i) => {
    const orig = traders.find(tr => tr.address === t.address);
    if (orig) orig.rank24h = t.volume24h > 0 ? i + 1 : undefined;
  });

  console.log(`Aggregated ${traders.length} traders: all-time=$${formatVolume(totalVolume)}, epoch=$${formatVolume(totalVolumeEpoch)}, 24h=$${formatVolume(totalVolume24h)}`);

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
// USER GROWTH — derive from subaccount created_at timestamps
// ============================================================

function computeUserGrowth(subaccounts: SubaccountInfo[]): UserGrowthPoint[] {
  // Track unique wallets by first-seen date
  // created_at is a Unix timestamp (seconds), convert to ISO date
  const walletFirstSeen = new Map<string, string>(); // wallet → earliest date "YYYY-MM-DD"
  for (const sub of subaccounts) {
    if (!sub.created_at || !sub.address) continue;
    const addr = sub.address.toLowerCase();
    const ts = parseInt(sub.created_at, 10);
    if (isNaN(ts)) continue;
    const day = new Date(ts * 1000).toISOString().slice(0, 10); // "2026-01-15"
    const existing = walletFirstSeen.get(addr);
    if (!existing || day < existing) {
      walletFirstSeen.set(addr, day);
    }
  }

  // Count new unique wallets per day
  const dailyCounts = new Map<string, number>();
  for (const [, day] of walletFirstSeen) {
    dailyCounts.set(day, (dailyCounts.get(day) || 0) + 1);
  }

  // Sort by date, compute cumulative
  const sorted = Array.from(dailyCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  let cumulative = 0;
  return sorted.map(([date, newUsers]) => {
    cumulative += newUsers;
    return { date, newUsers, cumulativeUsers: cumulative };
  });
}

// Count new unique wallets in the last 24h
function countNewUsers24h(subaccounts: SubaccountInfo[]): number {
  const oneDayAgoMs = Date.now() - 24 * 60 * 60 * 1000;
  const recentWallets = new Set<string>();
  for (const sub of subaccounts) {
    if (!sub.created_at || !sub.address) continue;
    const ts = parseInt(sub.created_at, 10);
    if (isNaN(ts)) continue;
    const createdAtMs = ts * 1000;
    if (createdAtMs >= oneDayAgoMs) {
      recentWallets.add(sub.address.toLowerCase());
    }
  }
  return recentWallets.size;
}

// ============================================================
// OPEN INTEREST — fetch from Nado Gateway API
// ============================================================

async function fetchOpenInterest(): Promise<{ items: OpenInterestData[]; total: number }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${GATEWAY_URL}/query`, {
      method: 'POST',
      headers: API_HEADERS,
      body: JSON.stringify({ type: 'all_products' }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (!response.ok) return { items: [], total: 0 };

    const data = await response.json();
    if (data.status !== 'success') return { items: [], total: 0 };

    const perpProducts = data.data?.perp_products || [];
    let totalOi = 0;
    const items: OpenInterestData[] = [];

    for (const p of perpProducts) {
      const productId = p.product_id;
      const oiRaw = BigInt(p.state?.open_interest || '0');
      const oracleRaw = BigInt(p.oracle_price_x18 || '0');
      const oiContracts = Number(oiRaw) / 1e18;
      const oraclePrice = Number(oracleRaw) / 1e18;
      const oiUsd = oiContracts * oraclePrice;

      if (oiUsd > 0) {
        items.push({
          productId,
          name: getProductName(productId),
          openInterestUsd: oiUsd,
          openInterestContracts: oiContracts,
          oraclePrice,
        });
        totalOi += oiUsd;
      }
    }

    items.sort((a, b) => b.openInterestUsd - a.openInterestUsd);
    console.log(`Open interest: ${items.length} products, total $${formatVolume(totalOi)}`);
    return { items, total: totalOi };
  } catch (error) {
    console.error('Error fetching open interest:', error);
    return { items: [], total: 0 };
  }
}

// ============================================================
// EPOCH LEADERBOARDS — compute leaderboard for a single epoch
// ============================================================

export async function fetchEpochLeaderboard(
  epoch: Epoch,
  subaccountIds: string[],
): Promise<EpochLeaderboard> {
  console.log(`\nComputing leaderboard for epoch: ${epoch.name} (${epoch.start} → ${epoch.end})`);
  const startTs = Math.floor(new Date(epoch.start).getTime() / 1000);
  const endTs = Math.floor(new Date(epoch.end).getTime() / 1000);

  // 2 timestamps → batch size = 20
  const multiSnapshots = await fetchAccountSnapshotsMultiTimestamp(subaccountIds, [startTs, endTs]);
  const snapshotsStart = multiSnapshots.get(startTs) || new Map();
  const snapshotsEnd = multiSnapshots.get(endTs) || new Map();

  console.log(`  Epoch ${epoch.name}: start=${snapshotsStart.size}, end=${snapshotsEnd.size} subaccounts`);

  const startVolumes = extractCumulativeVolumes(snapshotsStart);
  const endVolumes = extractCumulativeVolumes(snapshotsEnd);
  const periodVolumes = computePeriodVolume(endVolumes, startVolumes);

  // Aggregate per wallet
  const walletVolumes = new Map<string, { volume: number; products: Set<number> }>();
  let totalVolume = 0;

  for (const [subaccount, productMap] of periodVolumes) {
    const address = extractWalletAddress(subaccount);
    if (!walletVolumes.has(address)) {
      walletVolumes.set(address, { volume: 0, products: new Set() });
    }
    const wallet = walletVolumes.get(address)!;
    for (const [productId, vol] of productMap) {
      wallet.volume += vol;
      wallet.products.add(productId);
      totalVolume += vol;
    }
  }

  const traders: EpochTraderData[] = Array.from(walletVolumes.entries())
    .filter(([, w]) => w.volume > 0)
    .map(([address, w]) => ({
      address,
      volume: w.volume,
      volumeShare: totalVolume > 0 ? (w.volume / totalVolume) * 100 : 0,
      rank: 0,
      productCount: w.products.size,
    }))
    .sort((a, b) => b.volume - a.volume)
    .map((t, i) => ({ ...t, rank: i + 1 }));

  console.log(`  Epoch ${epoch.name}: ${traders.length} traders, $${formatVolume(totalVolume)}`);

  return {
    epochName: epoch.name,
    epochStart: epoch.start,
    epochEnd: epoch.end,
    totalVolume,
    traders,
  };
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
  period: 'all' | 'epoch' | '24h' = '24h'
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
    // Fetch derivatives stats, subaccounts, and open interest concurrently
    const [volumeStats, subaccounts, oiData] = await Promise.all([
      fetchDerivativesStats(),
      fetchAllSubaccounts(40000),
      fetchOpenInterest(),
    ]);

    console.log('DefiLlama derivatives stats:', {
      total24h: volumeStats?.total24h,
      total7d: volumeStats?.total7d,
      total30d: volumeStats?.total30d,
      totalAllTime: volumeStats?.totalAllTime,
    });
    console.log(`Processing ${subaccounts.length} subaccounts`);

    // Compute user growth from subaccount creation timestamps
    const userGrowth = computeUserGrowth(subaccounts);
    const totalUsers = userGrowth.length > 0 ? userGrowth[userGrowth.length - 1].cumulativeUsers : 0;
    const newUsers24h = countNewUsers24h(subaccounts);
    console.log(`User growth: ${totalUsers} total users, ${newUsers24h} new in 24h, ${userGrowth.length} data points`);

    // Build subaccount index for fast wallet lookups
    buildSubaccountIndex(subaccounts);

    const now = Math.floor(Date.now() / 1000);
    const ts24hAgo = now - 24 * 60 * 60;

    // Use current epoch start instead of rolling 7d
    const currentEpoch = getCurrentEpoch();
    const tsEpochStart = currentEpoch
      ? Math.floor(new Date(currentEpoch.start).getTime() / 1000)
      : now - 7 * 24 * 60 * 60; // fallback to 7d if no epoch found

    console.log(`Current epoch: ${currentEpoch?.name || 'none'} (start: ${currentEpoch?.start || 'N/A'})`);

    const subaccountIds = subaccounts.map(s => s.subaccount);
    const timestamps = [now, ts24hAgo, tsEpochStart];

    // Fetch all 3 timestamps together so each batch has consistent data
    // With 3 timestamps: batch size = floor(40/3) = 13 subaccounts per request
    console.log('Fetching multi-timestamp snapshots (now, 24h ago, epoch start)...');
    const multiSnapshots = await fetchAccountSnapshotsMultiTimestamp(subaccountIds, timestamps);

    const snapshotsNow = multiSnapshots.get(now) || new Map();
    const snapshots24hAgo = multiSnapshots.get(ts24hAgo) || new Map();
    const snapshotsEpochStart = multiSnapshots.get(tsEpochStart) || new Map();

    console.log(`Got snapshots: now=${snapshotsNow.size}, 24h-ago=${snapshots24hAgo.size}, epoch-start=${snapshotsEpochStart.size}`);

    const { traders, productVolumes, totalVolume } = aggregateTraderDataMultiPeriod(
      snapshotsNow, snapshots24hAgo, snapshotsEpochStart
    );

    // Compute calculated period totals
    const calculatedVolume24h = traders.reduce((sum, t) => sum + t.volume24h, 0);
    const calculatedVolumeEpoch = traders.reduce((sum, t) => sum + t.volumeEpoch, 0);

    const formattedProductVolumes = formatProductVolumes(productVolumes);

    // Always include full volume history (for overview tab charts)
    const volumeHistory: VolumeDataPoint[] = [];
    if (volumeStats?.totalDataChart) {
      for (const [timestamp, volume] of volumeStats.totalDataChart) {
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
      totalVolume30d: volumeStats?.total30d || 0,
      totalVolumeAllTime: volumeStats?.totalAllTime || 0,
      calculatedVolume24h,
      calculatedVolumeEpoch,
      totalTrades24h: 0,
      uniqueTraders24h: traders.length,
      volumeHistory,
      productVolumes: formattedProductVolumes,
      lastUpdated: new Date().toISOString(),
      change1d: volumeStats?.change_1d || 0,
      calculatedVolume: totalVolume,
      currentEpoch: currentEpoch || undefined,
      epochs: EPOCHS,
      // Overview data
      userGrowth,
      totalUsers,
      newUsers24h,
      openInterest: oiData.items,
      totalOpenInterest: oiData.total,
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
  fetchAccountSnapshotsMultiTimestamp,
  fetchOpenInterest,
  computeUserGrowth,
  countNewUsers24h,
  extractCumulativeVolumes,
  computePeriodVolume,
  extractWalletAddress,
  fromX18,
  getProductName,
  isPerpProduct,
};
