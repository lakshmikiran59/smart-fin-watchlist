import { AlertTrigger, DenormalizedAsset, MeaningfulEvent, UserSnapshot } from '../types';

/**
 * READ CACHE (Query side) - simulates a Redis low-latency key-value layer.
 * Holds fully denormalized, pre-computed data so the API never needs to hit
 * the relational Write DB to serve reads.
 */

const STALE_THRESHOLD_MS = 10_000;
const MAX_EVENTS_PER_ASSET = 20;

export class ReadCache {
  // key: assetId -> denormalized asset (per-watchlist-item, includes own triggers)
  private assetCache = new Map<string, DenormalizedAsset>();
  // key: symbol -> latest raw tick price (shared across all watchlists, processed once)
  private symbolPrice = new Map<string, { price: number; timestamp: number; cachedAt: number }>();
  // key: userId -> last_seen snapshot
  private userSnapshots = new Map<string, UserSnapshot>();

  upsertAssetShell(assetId: string, symbol: string, dailyOpen: number, dailyHigh: number, dailyLow: number) {
    const existing = this.assetCache.get(assetId);
    const nowPrice = this.symbolPrice.get(symbol)?.price ?? dailyOpen;
    this.assetCache.set(assetId, {
      assetId,
      symbol,
      price: existing?.price ?? nowPrice,
      prevPrice: existing?.prevPrice ?? nowPrice,
      dailyOpen,
      dailyHigh,
      dailyLow,
      lastTickAt: existing?.lastTickAt ?? Date.now(),
      cachedAt: Date.now(),
      triggers: existing?.triggers ?? [],
      meaningfulEvents: existing?.meaningfulEvents ?? [],
    });
  }

  removeAsset(assetId: string) {
    this.assetCache.delete(assetId);
  }

  getAsset(assetId: string): DenormalizedAsset | undefined {
    return this.assetCache.get(assetId);
  }

  getAssetsForIds(ids: string[]): DenormalizedAsset[] {
    // Batch fetch - single pass, no N individual DB calls
    return ids.map((id) => this.assetCache.get(id)).filter((a): a is DenormalizedAsset => !!a);
  }

  getAssetsBySymbol(symbol: string): DenormalizedAsset[] {
    return [...this.assetCache.values()].filter((a) => a.symbol === symbol);
  }

  /**
   * Last-Write-Wins conflict resolution: ignore ticks older than what's cached.
   * Returns true if the tick was applied.
   */
  applyTick(symbol: string, price: number, timestamp: number): boolean {
    const current = this.symbolPrice.get(symbol);
    if (current && timestamp <= current.timestamp) {
      return false; // stale/out-of-order packet - ignored
    }
    this.symbolPrice.set(symbol, { price, timestamp, cachedAt: Date.now() });

    for (const asset of this.assetCache.values()) {
      if (asset.symbol !== symbol) continue;
      asset.prevPrice = asset.price;
      asset.price = price;
      asset.lastTickAt = timestamp;
      asset.cachedAt = Date.now();
      if (price > asset.dailyHigh) asset.dailyHigh = price;
      if (price < asset.dailyLow) asset.dailyLow = price;
    }
    return true;
  }

  setTriggers(assetId: string, triggers: AlertTrigger[]) {
    const asset = this.assetCache.get(assetId);
    if (asset) asset.triggers = triggers;
  }

  pushMeaningfulEvent(assetId: string, event: MeaningfulEvent) {
    const asset = this.assetCache.get(assetId);
    if (!asset) return;
    asset.meaningfulEvents = [event, ...asset.meaningfulEvents].slice(0, MAX_EVENTS_PER_ASSET);
  }

  isStale(assetId: string): boolean {
    const asset = this.assetCache.get(assetId);
    if (!asset) return true;
    return Date.now() - asset.lastTickAt > STALE_THRESHOLD_MS;
  }

  // ---- Session snapshots ----
  saveUserSnapshot(snapshot: UserSnapshot) {
    this.userSnapshots.set(snapshot.userId, snapshot);
  }

  getUserSnapshot(userId: string): UserSnapshot | undefined {
    try {
      const snap = this.userSnapshots.get(userId);
      if (!snap || !Array.isArray(snap.assets)) return undefined; // corrupted guard
      return snap;
    } catch {
      return undefined; // corrupted snapshot - caller falls back to open price
    }
  }
}

export const readCache = new ReadCache();
export { STALE_THRESHOLD_MS };
