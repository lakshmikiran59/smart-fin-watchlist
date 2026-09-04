import { v4 as uuid } from 'uuid';
import { AlertTrigger, Watchlist, WatchedAsset } from '../types';

/**
 * WRITE DATABASE (Command side)
 * In-memory relational-style store simulating PostgreSQL/SQLite with strict
 * transactional consistency. All mutations happen synchronously here before
 * any domain event is emitted, guaranteeing the write model is always the
 * source of truth.
 */

export const MAX_ASSETS_PER_WATCHLIST = 50;

export class WriteDatabase {
  private watchlists = new Map<string, Watchlist>();
  private assets = new Map<string, WatchedAsset>(); // id -> asset
  private triggers = new Map<string, AlertTrigger>(); // id -> trigger

  // ---- Watchlist ----
  createWatchlist(userId: string, name: string): Watchlist {
    const wl: Watchlist = { id: uuid(), userId, name, createdAt: Date.now() };
    this.watchlists.set(wl.id, wl);
    return wl;
  }

  getWatchlist(id: string): Watchlist | undefined {
    return this.watchlists.get(id);
  }

  listWatchlistsForUser(userId: string): Watchlist[] {
    return [...this.watchlists.values()].filter((w) => w.userId === userId);
  }

  // ---- Assets ----
  countAssets(watchlistId: string): number {
    return [...this.assets.values()].filter((a) => a.watchlistId === watchlistId).length;
  }

  addAsset(watchlistId: string, symbol: string, openPrice: number): WatchedAsset {
    if (this.countAssets(watchlistId) >= MAX_ASSETS_PER_WATCHLIST) {
      throw new Error(`Watchlist limit reached (max ${MAX_ASSETS_PER_WATCHLIST} assets)`);
    }
    const existing = [...this.assets.values()].find(
      (a) => a.watchlistId === watchlistId && a.symbol === symbol
    );
    if (existing) return existing;
    const asset: WatchedAsset = {
      id: uuid(),
      watchlistId,
      symbol: symbol.toUpperCase(),
      addedAt: Date.now(),
      dailyOpen: openPrice,
      dailyHigh: openPrice,
      dailyLow: openPrice,
    };
    this.assets.set(asset.id, asset);
    return asset;
  }

  removeAsset(assetId: string): WatchedAsset | undefined {
    const asset = this.assets.get(assetId);
    if (!asset) return undefined;
    this.assets.delete(assetId);
    [...this.triggers.values()]
      .filter((t) => t.assetId === assetId)
      .forEach((t) => this.triggers.delete(t.id));
    return asset;
  }

  getAsset(assetId: string): WatchedAsset | undefined {
    return this.assets.get(assetId);
  }

  listAssetsForWatchlist(watchlistId: string): WatchedAsset[] {
    return [...this.assets.values()].filter((a) => a.watchlistId === watchlistId);
  }

  listAssetsBySymbol(symbol: string): WatchedAsset[] {
    return [...this.assets.values()].filter((a) => a.symbol === symbol.toUpperCase());
  }

  updateAssetHighLow(assetId: string, price: number) {
    const asset = this.assets.get(assetId);
    if (!asset) return;
    if (price > asset.dailyHigh) asset.dailyHigh = price;
    if (price < asset.dailyLow) asset.dailyLow = price;
  }

  // ---- Triggers ----
  setTrigger(assetId: string, symbol: string, targetPrice: number, direction: 'above' | 'below'): AlertTrigger {
    const trigger: AlertTrigger = {
      id: uuid(),
      assetId,
      symbol: symbol.toUpperCase(),
      targetPrice,
      direction,
      createdAt: Date.now(),
      active: true,
    };
    this.triggers.set(trigger.id, trigger);
    return trigger;
  }

  listTriggersForAsset(assetId: string): AlertTrigger[] {
    return [...this.triggers.values()].filter((t) => t.assetId === assetId && t.active);
  }

  listTriggersBySymbol(symbol: string): AlertTrigger[] {
    return [...this.triggers.values()].filter((t) => t.symbol === symbol.toUpperCase() && t.active);
  }

  deactivateTrigger(triggerId: string) {
    const t = this.triggers.get(triggerId);
    if (t) t.active = false;
  }
}

export const writeDb = new WriteDatabase();
