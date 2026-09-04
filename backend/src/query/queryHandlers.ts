import { writeDb } from '../db/writeDb';
import { readCache, STALE_THRESHOLD_MS } from '../cache/readCache';
import { DenormalizedWatchlist, UserSnapshot } from '../types';

/**
 * QUERY SIDE (Reads) - always served from the denormalized Read Cache.
 * Batches asset lookups instead of issuing per-item DB calls.
 */

export function getWatchlistView(watchlistId: string): DenormalizedWatchlist {
  const watchlist = writeDb.getWatchlist(watchlistId);
  if (!watchlist) throw new Error('Watchlist not found');

  const assets = writeDb.listAssetsForWatchlist(watchlistId);
  const ids = assets.map((a) => a.id);
  const denormAssets = readCache.getAssetsForIds(ids); // single batched fetch

  return {
    id: watchlist.id,
    userId: watchlist.userId,
    name: watchlist.name,
    assets: denormAssets.map((a) => ({
      ...a,
      // expose staleness flag computed at read-time, not stored
      ...( { stale: Date.now() - a.lastTickAt > STALE_THRESHOLD_MS } as any),
    })),
  };
}

export function listUserWatchlists(userId: string) {
  return writeDb.listWatchlistsForUser(userId).map((wl) => getWatchlistView(wl.id));
}

/**
 * "While You Were Away" diff computation. Falls back gracefully to the
 * asset's opening price if the historical snapshot is missing/corrupt.
 */
export function computeWhileYouWereAway(userId: string, watchlistId: string) {
  const snapshot: UserSnapshot | undefined = readCache.getUserSnapshot(userId);
  const view = getWatchlistView(watchlistId);

  return view.assets.map((asset) => {
    let basisPrice: number;
    let basisLabel: string;
    let sinceMs = 0;

    const snapAsset = snapshot?.assets.find((a) => a.symbol === asset.symbol);
    if (snapshot && snapAsset) {
      basisPrice = snapAsset.price;
      basisLabel = 'last_session';
      sinceMs = Date.now() - snapshot.savedAt;
    } else {
      // Corrupted/missing snapshot -> fallback to market opening price
      basisPrice = asset.dailyOpen;
      basisLabel = 'market_open';
      sinceMs = 0;
    }

    const deltaAbs = asset.price - basisPrice;
    const deltaPct = basisPrice > 0 ? (deltaAbs / basisPrice) * 100 : 0;

    return {
      symbol: asset.symbol,
      currentPrice: asset.price,
      basisPrice,
      basisLabel,
      deltaAbs: Number(deltaAbs.toFixed(2)),
      deltaPct: Number(deltaPct.toFixed(2)),
      sinceMs,
    };
  });
}

export function saveSessionSnapshot(userId: string, watchlistId: string) {
  const view = getWatchlistView(watchlistId);
  const snapshot: UserSnapshot = {
    userId,
    savedAt: Date.now(),
    assets: view.assets.map((a) => ({ symbol: a.symbol, price: a.price, timestamp: a.lastTickAt })),
  };
  readCache.saveUserSnapshot(snapshot);
  return snapshot;
}
