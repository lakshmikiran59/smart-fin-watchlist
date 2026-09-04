import { eventBus, DomainEvents } from '../events/eventBus';
import { MarketTick } from '../types';

/**
 * Simulates a real-time market data feed. Ticks per symbol are generated on
 * an interval and pushed onto the event bus as MarketTickReceived events,
 * carrying a timestamp so the Query side can detect stale/out-of-order data.
 */

// NSE-listed large-cap symbols with representative INR price levels
export const TRACKED_SYMBOLS = [
  'RELIANCE',
  'TCS',
  'HDFCBANK',
  'INFY',
  'ICICIBANK',
  'SBIN',
  'BHARTIARTL',
  'ITC',
  'TATAMOTORS',
  'WIPRO',
];

const basePrices: Record<string, number> = {
  RELIANCE: 2945.5,
  TCS: 4125.75,
  HDFCBANK: 1685.2,
  INFY: 1810.4,
  ICICIBANK: 1215.9,
  SBIN: 825.35,
  BHARTIARTL: 1595.1,
  ITC: 462.8,
  TATAMOTORS: 985.6,
  WIPRO: 512.25,
};

export const CURRENCY = 'INR';

const lastPrice = new Map<string, number>(Object.entries(basePrices));

export function getLastPrice(symbol: string): number {
  return lastPrice.get(symbol.toUpperCase()) ?? 100;
}

function randomWalk(price: number): number {
  // Occasionally inject a larger jump to trigger volatility-spike detection
  const isSpike = Math.random() < 0.04;
  const pct = isSpike ? (Math.random() > 0.5 ? 1 : -1) * (0.02 + Math.random() * 0.02) : (Math.random() - 0.5) * 0.006;
  const next = price * (1 + pct);
  return Math.max(1, Number(next.toFixed(2)));
}

let intervalHandle: NodeJS.Timeout | null = null;

export function startMarketSimulator() {
  if (intervalHandle) return;
  intervalHandle = setInterval(() => {
    for (const symbol of TRACKED_SYMBOLS) {
      const prev = lastPrice.get(symbol)!;
      const next = randomWalk(prev);
      lastPrice.set(symbol, next);
      const tick: MarketTick = { symbol, price: next, timestamp: Date.now() };
      eventBus.publish(DomainEvents.MarketTickReceived, tick);
    }
  }, 1500);
}

export function stopMarketSimulator() {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
}
