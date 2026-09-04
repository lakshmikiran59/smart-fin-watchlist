import { writeDb } from '../db/writeDb';
import { eventBus, DomainEvents } from '../events/eventBus';
import { getLastPrice } from '../marketData/simulator';

/**
 * COMMAND SIDE (Writes)
 * Validate -> apply transactionally to Write DB -> emit domain events.
 */

const SYMBOL_REGEX = /^[A-Z]{1,20}$/;

export function validateSymbol(symbol: string) {
  if (!symbol || typeof symbol !== 'string' || !SYMBOL_REGEX.test(symbol.toUpperCase())) {
    throw new Error('Invalid asset symbol');
  }
}

export function validatePriceTarget(value: unknown): number {
  const num = Number(value);
  if (Number.isNaN(num) || !Number.isFinite(num) || num <= 0) {
    throw new Error('Trigger target price must be a positive number');
  }
  return num;
}

/**
 * Ownership guard: every mutation must be scoped to the requesting user's
 * own watchlist. Without this, a valid JWT for user A could read/mutate
 * user B's watchlist simply by guessing/enumerating IDs (IDOR).
 */
function assertWatchlistOwnership(watchlistId: string, userId: string) {
  const watchlist = writeDb.getWatchlist(watchlistId);
  if (!watchlist) throw new Error('Watchlist not found');
  if (watchlist.userId !== userId) throw new Error('Watchlist not found');
  return watchlist;
}

export function createWatchlist(userId: string, name: string) {
  if (!name || !name.trim()) throw new Error('Watchlist name is required');
  const wl = writeDb.createWatchlist(userId, name.trim());
  eventBus.publish(DomainEvents.WatchlistCreated, wl);
  return wl;
}

export function addAssetToWatchlist(watchlistId: string, symbolRaw: string, userId: string) {
  const symbol = symbolRaw.toUpperCase();
  validateSymbol(symbol);
  assertWatchlistOwnership(watchlistId, userId);
  const openPrice = getLastPrice(symbol);
  const asset = writeDb.addAsset(watchlistId, symbol, openPrice);
  eventBus.publish(DomainEvents.AssetAddedToWatchlist, { watchlistId, asset });
  return asset;
}

export function removeAssetFromWatchlist(watchlistId: string, assetId: string, userId: string) {
  assertWatchlistOwnership(watchlistId, userId);
  const asset = writeDb.getAsset(assetId);
  if (!asset || asset.watchlistId !== watchlistId) throw new Error('Asset not found in watchlist');
  writeDb.removeAsset(assetId);
  eventBus.publish(DomainEvents.AssetRemovedFromWatchlist, { watchlistId, assetId });
  return { assetId };
}

export function setAssetAlertTrigger(
  assetId: string,
  targetPriceRaw: unknown,
  direction: 'above' | 'below',
  userId: string
) {
  const asset = writeDb.getAsset(assetId);
  if (!asset) throw new Error('Asset not found');
  assertWatchlistOwnership(asset.watchlistId, userId);
  if (direction !== 'above' && direction !== 'below') throw new Error('Invalid trigger direction');
  const targetPrice = validatePriceTarget(targetPriceRaw);
  const trigger = writeDb.setTrigger(assetId, asset.symbol, targetPrice, direction);
  eventBus.publish(DomainEvents.TriggerConfigured, { assetId, trigger });
  return trigger;
}
