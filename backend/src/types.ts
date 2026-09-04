export interface Watchlist {
  id: string;
  userId: string;
  name: string;
  createdAt: number;
}

export interface WatchedAsset {
  id: string;
  watchlistId: string;
  symbol: string;
  addedAt: number;
  dailyOpen: number;
  dailyHigh: number;
  dailyLow: number;
}

export interface AlertTrigger {
  id: string;
  assetId: string;
  symbol: string;
  targetPrice: number;
  direction: 'above' | 'below';
  createdAt: number;
  active: boolean;
}

export interface MarketTick {
  symbol: string;
  price: number;
  timestamp: number;
}

export interface MeaningfulEvent {
  id: string;
  symbol: string;
  type: 'VOLATILITY_SPIKE' | 'HIGH_CROSS' | 'LOW_CROSS' | 'TRIGGER_BREACH';
  message: string;
  price: number;
  timestamp: number;
}

export interface AssetSnapshot {
  symbol: string;
  price: number;
  timestamp: number;
}

export interface UserSnapshot {
  userId: string;
  savedAt: number;
  assets: AssetSnapshot[];
}

export interface DenormalizedAsset {
  assetId: string;
  symbol: string;
  price: number;
  prevPrice: number;
  dailyOpen: number;
  dailyHigh: number;
  dailyLow: number;
  lastTickAt: number;
  cachedAt: number;
  triggers: AlertTrigger[];
  meaningfulEvents: MeaningfulEvent[];
}

export interface DenormalizedWatchlist {
  id: string;
  userId: string;
  name: string;
  assets: DenormalizedAsset[];
}
