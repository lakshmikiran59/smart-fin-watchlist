import { eventBus, DomainEvents } from '../src/events/eventBus';
import { readCache } from '../src/cache/readCache';
import { createWatchlist, addAssetToWatchlist } from '../src/command/commandHandlers';
import { registerEventConsumers } from '../src/query/eventConsumers';
import {
  getWatchlistView,
  listUserWatchlists,
  computeWhileYouWereAway,
  saveSessionSnapshot,
} from '../src/query/queryHandlers';

registerEventConsumers();
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('Query handlers (Read side)', () => {
  test('getWatchlistView returns a denormalized, batched view with a stale flag', async () => {
    const wl = createWatchlist('user-q-1', 'Q List');
    addAssetToWatchlist(wl.id, 'RELIANCE', 'user-q-1');
    await flush();

    const view = getWatchlistView(wl.id, 'user-q-1');
    expect(view.assets).toHaveLength(1);
    expect((view.assets[0] as any).stale).toBe(false);
  });

  test('getWatchlistView throws for an unknown watchlist id', () => {
    expect(() => getWatchlistView('does-not-exist', 'user-q-1')).toThrow(/not found/i);
  });

  test('getWatchlistView throws when the watchlist belongs to another user', async () => {
    const wl = createWatchlist('user-q-owner', 'Owned List');
    addAssetToWatchlist(wl.id, 'RELIANCE', 'user-q-owner');
    await flush();

    expect(() => getWatchlistView(wl.id, 'user-q-intruder')).toThrow(/not found/i);
  });

  test('listUserWatchlists returns only watchlists belonging to that user', async () => {
    const wlA = createWatchlist('user-q-2', 'A');
    createWatchlist('user-q-other', 'B'); // different user, must not leak
    addAssetToWatchlist(wlA.id, 'TCS', 'user-q-2');
    await flush();

    const lists = listUserWatchlists('user-q-2');
    expect(lists).toHaveLength(1);
    expect(lists[0].id).toBe(wlA.id);
  });

  test('computeWhileYouWereAway falls back to market-open price when no snapshot exists', async () => {
    const wl = createWatchlist('user-q-3', 'Fallback List');
    addAssetToWatchlist(wl.id, 'INFY', 'user-q-3');
    await flush();

    const deltas = computeWhileYouWereAway('user-q-3', wl.id);
    expect(deltas[0].basisLabel).toBe('market_open');
    expect(deltas[0].sinceMs).toBe(0);
  });

  test('computeWhileYouWereAway falls back to market-open price for a corrupted snapshot', async () => {
    const wl = createWatchlist('user-q-4', 'Corrupt List');
    addAssetToWatchlist(wl.id, 'SBIN', 'user-q-4');
    await flush();

    // Inject a corrupted snapshot directly (missing/invalid `assets` array)
    (readCache as any)['userSnapshots'].set('user-q-4', { userId: 'user-q-4', savedAt: Date.now(), assets: undefined });

    const deltas = computeWhileYouWereAway('user-q-4', wl.id);
    expect(deltas[0].basisLabel).toBe('market_open');
  });

  test('computeWhileYouWereAway computes a real delta against a valid saved snapshot', async () => {
    const wl = createWatchlist('user-q-5', 'Diff List');
    const asset = addAssetToWatchlist(wl.id, 'ITC', 'user-q-5');
    await flush();

    eventBus.publish(DomainEvents.MarketTickReceived, { symbol: 'ITC', price: 500, timestamp: Date.now() });
    await flush();

    const snap = saveSessionSnapshot('user-q-5', wl.id);
    expect(snap.assets[0].price).toBe(500);

    eventBus.publish(DomainEvents.MarketTickReceived, { symbol: 'ITC', price: 520, timestamp: Date.now() + 1 });
    await flush();

    const deltas = computeWhileYouWereAway('user-q-5', wl.id);
    expect(deltas[0].basisLabel).toBe('last_session');
    expect(deltas[0].deltaAbs).toBeCloseTo(20);
    void asset;
  });
});
