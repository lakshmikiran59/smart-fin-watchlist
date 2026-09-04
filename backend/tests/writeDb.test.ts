import { WriteDatabase, MAX_ASSETS_PER_WATCHLIST } from '../src/db/writeDb';

describe('WriteDatabase (Command side write store)', () => {
  let db: WriteDatabase;

  beforeEach(() => {
    db = new WriteDatabase();
  });

  test('creates a watchlist scoped to a user', () => {
    const wl = db.createWatchlist('user-1', 'My List');
    expect(wl.userId).toBe('user-1');
    expect(db.getWatchlist(wl.id)).toEqual(wl);
    expect(db.listWatchlistsForUser('user-1')).toHaveLength(1);
  });

  test('adds an asset with dailyOpen/High/Low seeded from open price', () => {
    const wl = db.createWatchlist('user-1', 'My List');
    const asset = db.addAsset(wl.id, 'reliance', 2900);
    expect(asset.symbol).toBe('RELIANCE');
    expect(asset.dailyOpen).toBe(2900);
    expect(asset.dailyHigh).toBe(2900);
    expect(asset.dailyLow).toBe(2900);
  });

  test('adding the same symbol twice to a watchlist is idempotent', () => {
    const wl = db.createWatchlist('user-1', 'My List');
    const a1 = db.addAsset(wl.id, 'TCS', 4100);
    const a2 = db.addAsset(wl.id, 'TCS', 4200);
    expect(a1.id).toBe(a2.id);
    expect(db.countAssets(wl.id)).toBe(1);
  });

  test('enforces the max-assets-per-watchlist limit', () => {
    const wl = db.createWatchlist('user-1', 'My List');
    for (let i = 0; i < MAX_ASSETS_PER_WATCHLIST; i++) {
      db.addAsset(wl.id, `SYM${i}`, 100);
    }
    expect(() => db.addAsset(wl.id, 'ONEMORE', 100)).toThrow(/limit reached/i);
  });

  test('removeAsset deletes the asset and its triggers', () => {
    const wl = db.createWatchlist('user-1', 'My List');
    const asset = db.addAsset(wl.id, 'INFY', 1800);
    db.setTrigger(asset.id, asset.symbol, 1900, 'above');
    db.removeAsset(asset.id);
    expect(db.getAsset(asset.id)).toBeUndefined();
    expect(db.listTriggersForAsset(asset.id)).toHaveLength(0);
  });

  test('updateAssetHighLow tracks new intraday high/low', () => {
    const wl = db.createWatchlist('user-1', 'My List');
    const asset = db.addAsset(wl.id, 'SBIN', 800);
    db.updateAssetHighLow(asset.id, 850);
    db.updateAssetHighLow(asset.id, 780);
    const updated = db.getAsset(asset.id)!;
    expect(updated.dailyHigh).toBe(850);
    expect(updated.dailyLow).toBe(780);
  });

  test('deactivateTrigger stops it from being listed as active', () => {
    const wl = db.createWatchlist('user-1', 'My List');
    const asset = db.addAsset(wl.id, 'ITC', 460);
    const trigger = db.setTrigger(asset.id, asset.symbol, 500, 'above');
    db.deactivateTrigger(trigger.id);
    expect(db.listTriggersForAsset(asset.id)).toHaveLength(0);
  });
});
