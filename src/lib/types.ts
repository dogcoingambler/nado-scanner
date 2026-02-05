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

export interface AggregatedTraderData {
  address: string;
  totalVolumeUsd: number;
  tradeCount: number;
  buyVolumeUsd: number;
  sellVolumeUsd: number;
  avgTradeSizeUsd: number;
  lastActive: string;
  productCount: number;
  totalFees: number;
  rank?: number;
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

export interface DashboardData {
  traders: AggregatedTraderData[];
  totalVolume24h: number;
  totalVolume7d?: number;
  totalVolumeAllTime?: number;
  totalTrades24h: number;
  uniqueTraders24h: number;
  volumeHistory: VolumeDataPoint[];
  productVolumes: ProductVolume[];
  lastUpdated: string;
  change1d?: number;
  calculatedVolume?: number; // Volume calculated from fetched matches
}

export type TimePeriod = 'all' | '7d' | '24h';

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
