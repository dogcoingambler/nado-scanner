// Nado API Types

export interface NadoMatch {
  digest: string;
  submission_idx: string;
  timestamp: string;
  product_id: number;
  is_taker_bid: boolean;
  taker_subaccount: string;
  maker_subaccount: string;
  amount: string; // x18 format
  price: string; // x18 format
  taker_fee: string;
  maker_fee: string;
  sequencer_fee: string;
}

export interface NadoOrder {
  digest: string;
  subaccount: string;
  product_id: number;
  is_bid: boolean;
  price_x18: string;
  amount: string;
  expiration: string;
  nonce: string;
  unfilled_amount: string;
  order_type: string;
  time_in_force: string;
  created_at: string;
}

export interface NadoProduct {
  product_id: number;
  name: string;
  symbol: string;
  product_type: string;
}

export interface NadoTicker {
  product_id: number;
  price_x18: string;
  price_change_24h: string;
  volume_24h: string;
  high_24h: string;
  low_24h: string;
}

export interface TraderStats {
  address: string;
  totalVolume: number;
  tradeCount: number;
  buyVolume: number;
  sellVolume: number;
  avgTradeSize: number;
  lastActive: Date;
  products: Set<number>;
  fees: number;
}

// Nado Season 1 epoch definition
export interface Epoch {
  name: string;
  start: string; // ISO date string (UTC)
  end: string;   // ISO date string (UTC)
}

export interface AggregatedTraderData {
  address: string;
  totalVolumeUsd: number;
  volumeEpoch: number;     // volume for current epoch
  volume24h: number;
  volumeShare: number;     // % of total all-time volume
  volumeShareEpoch: number; // % of current epoch volume
  volumeShare24h: number;  // % of total 24h volume
  tradeCount: number;
  buyVolumeUsd: number;
  sellVolumeUsd: number;
  avgTradeSizeUsd: number;
  lastActive: string;
  productCount: number;
  totalFees: number;
  rank?: number;
  rankEpoch?: number;
  rank24h?: number;
}

export interface VolumeDataPoint {
  timestamp: string;
  date: string;
  volume: number;
  tradeCount: number;
}

export interface ProductVolume {
  productId: number;
  name: string;
  volume24h: number;
  tradeCount: number;
}

// User growth data point (daily granularity)
export interface UserGrowthPoint {
  date: string;           // ISO date "2026-01-15"
  newUsers: number;       // new wallets created that day
  cumulativeUsers: number; // running total of unique wallets
}

// Open interest per product
export interface OpenInterestData {
  productId: number;
  name: string;
  openInterestUsd: number;
  openInterestContracts: number;
  oraclePrice: number;
}

// Pre-computed leaderboard for a past epoch
export interface EpochLeaderboard {
  epochName: string;
  epochStart: string;
  epochEnd: string;
  totalVolume: number;       // from Nado API snapshots (used for ranking)
  chartVolume?: number;      // from DefiLlama daily chart (accurate total)
  traders: EpochTraderData[];
}

export interface EpochTraderData {
  address: string;
  volume: number;
  volumeShare: number;
  rank: number;
  productCount: number;
}

export interface DashboardData {
  traders: AggregatedTraderData[];
  totalVolume24h: number;
  totalVolume7d?: number;
  totalVolume30d?: number;
  totalVolumeAllTime?: number;
  calculatedVolume24h?: number;
  calculatedVolumeEpoch?: number;
  calculatedVolumeEpochChart?: number;  // from DefiLlama (accurate)
  totalTrades24h: number;
  uniqueTraders24h: number;
  volumeHistory: VolumeDataPoint[];
  productVolumes: ProductVolume[];
  lastUpdated: string;
  change1d?: number;
  calculatedVolume?: number;
  // Epoch info
  currentEpoch?: Epoch;
  epochs?: Epoch[];
  // Overview data
  userGrowth?: UserGrowthPoint[];
  totalUsers?: number;
  newUsers24h?: number;
  openInterest?: OpenInterestData[];
  totalOpenInterest?: number;
  // Fee data from DefiLlama
  totalFees24h?: number;
  totalFeesAllTime?: number;
  feeHistory?: { timestamp: string; fees: number }[];
  // Pre-computed epoch leaderboards
  epochLeaderboards?: EpochLeaderboard[];
}

export type TimePeriod = 'all' | 'epoch' | '24h';

export interface WalletLookupResult {
  address: string;
  totalVolume: number;
  productCount: number;
  products: { name: string; volume: number }[];
  rank: number | null;
  found: boolean;
}

export interface NadoApiResponse<T> {
  status: 'success' | 'failure';
  data: T;
  error?: string;
  error_code?: number;
  request_type?: string;
}
