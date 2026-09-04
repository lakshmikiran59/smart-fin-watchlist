import { eventBus, DomainEvents } from '../src/events/eventBus';
import { readCache } from '../src/cache/readCache';
import {
  createWatchlist,
  addAssetToWatchlist,
  setAssetAlertTrigger,
  removeAssetFromWatchlist,
} from '../src/command/commandHandlers';
import { registerEventConsumers } from '../src/query/eventConsumers';

// Wiring the consumers is a module-level side effect (mirrors production index.ts)
registerEventConsumers();

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('CQRS Query-side event consumers (Highlight Engine)', () => {
  test('AssetAddedToWatchlist seeds the read cache (Command -> Query sync)', async () => {
    const wl = createWatchlist('user-evt-1', 'Highlight List');
    const asset = addAssetToWatchlist(wl.id, 'RELIANCE');
    await flush();
    const cached = readCache.getAsset(asset.id);
    expect(cached).toBeDefined();
    expect(cached!.symbol).toBe('RELIANCE');
  });

  test('detects a volatility spike (+/-2%) from a single tick', async () => {
    const wl = createWatchlist('user-evt-2', 'Vol List');
    const asset = addAssetToWatchlist(wl.id, 'TCS');
    await flush();

    // Establish a baseline price first
    eventBus.publish(DomainEvents.MarketTickReceived, { symbol: 'TCS', price: 4100, timestamp: Date.now() });
    await flush();

    // Jump +3% to trigger the volatility spike detector
    eventBus.publish(DomainEvents.MarketTickReceived, {
      symbol: 'TCS',
      price: 4100 * 1.03,
      timestamp: Date.now() + 1,
    });
    await flush();

    const cached = readCache.getAsset(asset.id)!;
    expect(cached.meaningfulEvents.some((e) => e.type === 'VOLATILITY_SPIKE')).toBe(true);
  });

  test('does not flag a volatility spike for a sub-2% move', async () => {
    const wl = createWatchlist('user-evt-3', 'Small Move List');
    const asset = addAssetToWatchlist(wl.id, 'HDFCBANK');
    await flush();

    eventBus.publish(DomainEvents.MarketTickReceived, { symbol: 'HDFCBANK', price: 1680, timestamp: Date.now() });
    await flush();
    eventBus.publish(DomainEvents.MarketTickReceived, {
      symbol: 'HDFCBANK',
      price: 1680 * 1.005,
      timestamp: Date.now() + 1,
    });
    await flush();

    const cached = readCache.getAsset(asset.id)!;
    expect(cached.meaningfulEvents.some((e) => e.type === 'VOLATILITY_SPIKE')).toBe(false);
  });

  test('evaluates and breaches a custom trigger asynchronously on the tick stream', async () => {
    const wl = createWatchlist('user-evt-4', 'Trigger List');
    const asset = addAssetToWatchlist(wl.id, 'ICICIBANK');
    await flush();

    setAssetAlertTrigger(asset.id, 1300, 'above');
    await flush();

    eventBus.publish(DomainEvents.MarketTickReceived, {
      symbol: 'ICICIBANK',
      price: 1305,
      timestamp: Date.now(),
    });
    await flush();

    const cached = readCache.getAsset(asset.id)!;
    expect(cached.meaningfulEvents.some((e) => e.type === 'TRIGGER_BREACH')).toBe(true);
    expect(cached.triggers.every((t) => !t.active)).toBe(true); // deactivated after breach
  });

  test('ignores a stale/out-of-order tick and raises no new events', async () => {
    const wl = createWatchlist('user-evt-5', 'Stale List');
    const asset = addAssetToWatchlist(wl.id, 'ITC');
    await flush();

    const now = Date.now();
    eventBus.publish(DomainEvents.MarketTickReceived, { symbol: 'ITC', price: 470, timestamp: now });
    await flush();
    const beforeCount = readCache.getAsset(asset.id)!.meaningfulEvents.length;

    // Older timestamp should be ignored entirely (Last-Write-Wins)
    eventBus.publish(DomainEvents.MarketTickReceived, { symbol: 'ITC', price: 550, timestamp: now - 10_000 });
    await flush();

    const cached = readCache.getAsset(asset.id)!;
    expect(cached.price).toBe(470); // unaffected by the stale spike attempt
    expect(cached.meaningfulEvents.length).toBe(beforeCount);
  });

  test('detects a new intraday HIGH_CROSS when the tick exceeds the prior high', async () => {
    const wl = createWatchlist('user-evt-6', 'High List');
    const asset = addAssetToWatchlist(wl.id, 'BHARTIARTL'); // dailyOpen=dailyHigh=dailyLow seed
    await flush();

    const seeded = readCache.getAsset(asset.id)!;
    const openPrice = seeded.price;

    eventBus.publish(DomainEvents.MarketTickReceived, {
      symbol: 'BHARTIARTL',
      price: openPrice * 1.05,
      timestamp: Date.now(),
    });
    await flush();

    const cached = readCache.getAsset(asset.id)!;
    expect(cached.meaningfulEvents.some((e) => e.type === 'HIGH_CROSS')).toBe(true);
  });

  test('detects a new intraday LOW_CROSS when the tick drops below the prior low', async () => {
    const wl = createWatchlist('user-evt-7', 'Low List');
    const asset = addAssetToWatchlist(wl.id, 'TATAMOTORS');
    await flush();

    const seeded = readCache.getAsset(asset.id)!;
    const openPrice = seeded.price;

    eventBus.publish(DomainEvents.MarketTickReceived, {
      symbol: 'TATAMOTORS',
      price: openPrice * 0.95,
      timestamp: Date.now(),
    });
    await flush();

    const cached = readCache.getAsset(asset.id)!;
    expect(cached.meaningfulEvents.some((e) => e.type === 'LOW_CROSS')).toBe(true);
  });

  test('AssetRemovedFromWatchlist purges the asset from the read cache', async () => {
    const wl = createWatchlist('user-evt-8', 'Remove List');
    const asset = addAssetToWatchlist(wl.id, 'WIPRO');
    await flush();
    expect(readCache.getAsset(asset.id)).toBeDefined();

    removeAssetFromWatchlist(wl.id, asset.id);
    await flush();

    expect(readCache.getAsset(asset.id)).toBeUndefined();
  });
});
