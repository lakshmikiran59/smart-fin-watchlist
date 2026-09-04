export interface AlertTrigger {
  id: string;
  assetId: string;
  symbol: string;
  targetPrice: number;
  direction: 'above' | 'below';
  createdAt: number;
  active: boolean;
}

export interface MeaningfulEvent {
  id: string;
  symbol: string;
  type: 'VOLATILITY_SPIKE' | 'HIGH_CROSS' | 'LOW_CROSS' | 'TRIGGER_BREACH';
  message: string;
  price: number;
  timestamp: number;
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
  stale?: boolean;
}

export interface Watchlist {
  id: string;
  userId: string;
  name: string;
  assets: DenormalizedAsset[];
}

export interface WhileAwayDelta {
  symbol: string;
  currentPrice: number;
  basisPrice: number;
  basisLabel: 'last_session' | 'market_open';
  deltaAbs: number;
  deltaPct: number;
  sinceMs: number;
}

export interface WsTickMessage {
  type: 'TICK';
  symbol: string;
  price: number;
  timestamp: number;
}

export interface WsMeaningfulEventMessage {
  type: 'MEANINGFUL_EVENT';
  event: MeaningfulEvent;
}

export type WsMessage =
  | WsTickMessage
  | WsMeaningfulEventMessage
  | { type: 'CONNECTED'; timestamp: number }
  | { type: 'PONG'; timestamp: number; clientTs: number };
