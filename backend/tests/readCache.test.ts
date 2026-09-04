import { ReadCache } from '../src/cache/readCache';

describe('ReadCache (Query side denormalized store)', () => {
  let cache: ReadCache;

  beforeEach(() => {
    cache = new ReadCache();
    cache.upsertAssetShell('asset-1', 'RELIANCE', 2900, 2900, 2900);
  });

  test('applies a fresh tick and updates price/high/low', () => {
    const applied = cache.applyTick('RELIANCE', 2950, Date.now());
    expect(applied).toBe(true);
    const asset = cache.getAsset('asset-1')!;
    expect(asset.price).toBe(2950);
    expect(asset.dailyHigh).toBe(2950);
  });

  test('Last-Write-Wins: ignores an out-of-order (older) tick', () => {
    const t1 = Date.now();
    cache.applyTick('RELIANCE', 2950, t1);
    const applied = cache.applyTick('RELIANCE', 2800, t1 - 5000); // older timestamp
    expect(applied).toBe(false);
    expect(cache.getAsset('asset-1')!.price).toBe(2950); // unchanged
  });

  test('ignores a tick with an equal timestamp to the cached one', () => {
    const ts = Date.now();
    cache.applyTick('RELIANCE', 2950, ts);
    const applied = cache.applyTick('RELIANCE', 3000, ts);
    expect(applied).toBe(false);
    expect(cache.getAsset('asset-1')!.price).toBe(2950);
  });

  test('marks an asset stale after no ticks for over the threshold', () => {
    cache.applyTick('RELIANCE', 2950, Date.now() - 15_000);
    // manually rewind lastTickAt by re-applying with an old timestamp via constructor state
    const asset = cache.getAsset('asset-1')!;
    asset.lastTickAt = Date.now() - 15_000;
    expect(cache.isStale('asset-1')).toBe(true);
  });

  test('is not stale immediately after a tick', () => {
    cache.applyTick('RELIANCE', 2950, Date.now());
    expect(cache.isStale('asset-1')).toBe(false);
  });

  test('batches asset fetches for multiple ids in one call', () => {
    cache.upsertAssetShell('asset-2', 'TCS', 4100, 4100, 4100);
    const results = cache.getAssetsForIds(['asset-1', 'asset-2', 'missing-id']);
    expect(results).toHaveLength(2);
    expect(results.map((a) => a.symbol).sort()).toEqual(['RELIANCE', 'TCS']);
  });

  test('returns undefined for a corrupted/missing user snapshot', () => {
    expect(cache.getUserSnapshot('unknown-user')).toBeUndefined();
  });

  test('returns undefined when snapshot.assets is not an array (corrupted)', () => {
    // @ts-expect-error intentionally injecting corrupted shape
    cache['userSnapshots'].set('bad-user', { userId: 'bad-user', savedAt: Date.now(), assets: null });
    expect(cache.getUserSnapshot('bad-user')).toBeUndefined();
  });

  test('saves and retrieves a valid user snapshot', () => {
    const snap = { userId: 'u1', savedAt: Date.now(), assets: [{ symbol: 'RELIANCE', price: 2900, timestamp: Date.now() }] };
    cache.saveUserSnapshot(snap);
    expect(cache.getUserSnapshot('u1')).toEqual(snap);
  });

  test('pushMeaningfulEvent caps the event list per asset', () => {
    for (let i = 0; i < 25; i++) {
      cache.pushMeaningfulEvent('asset-1', {
        id: `evt-${i}`,
        symbol: 'RELIANCE',
        type: 'VOLATILITY_SPIKE',
        message: 'test',
        price: 2900,
        timestamp: Date.now(),
      });
    }
    expect(cache.getAsset('asset-1')!.meaningfulEvents.length).toBeLessThanOrEqual(20);
  });
});
