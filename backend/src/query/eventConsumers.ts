import { v4 as uuid } from 'uuid';
import { eventBus, DomainEvents } from '../events/eventBus';
import { readCache } from '../cache/readCache';
import { writeDb } from '../db/writeDb';
import { MarketTick, MeaningfulEvent, WatchedAsset } from '../types';
import { broadcastSymbolUpdate, broadcastMeaningfulEvent } from '../ws/wsServer';

/**
 * QUERY SIDE consumers: listen for domain events emitted by the Command side
 * and denormalize them into the Read Cache. The REST/WS API only ever reads
 * from readCache - it never touches writeDb directly for hot-path reads.
 */

const VOLATILITY_THRESHOLD = 0.02; // 2%

function seedAssetIntoCache(asset: WatchedAsset) {
  readCache.upsertAssetShell(asset.id, asset.symbol, asset.dailyOpen, asset.dailyHigh, asset.dailyLow);
  readCache.setTriggers(asset.id, writeDb.listTriggersForAsset(asset.id));
}

eventBus.on(DomainEvents.AssetAddedToWatchlist, ({ asset }: { watchlistId: string; asset: WatchedAsset }) => {
  seedAssetIntoCache(asset);
});

eventBus.on(DomainEvents.AssetRemovedFromWatchlist, ({ assetId }: { watchlistId: string; assetId: string }) => {
  readCache.removeAsset(assetId);
});

eventBus.on(DomainEvents.TriggerConfigured, ({ assetId }: { assetId: string }) => {
  readCache.setTriggers(assetId, writeDb.listTriggersForAsset(assetId));
});

function raiseMeaningfulEvent(assetId: string, event: MeaningfulEvent) {
  readCache.pushMeaningfulEvent(assetId, event);
  eventBus.publish(DomainEvents.MeaningfulEventRaised, event);
  broadcastMeaningfulEvent(event);
}

eventBus.on(DomainEvents.MarketTickReceived, (tick: MarketTick) => {
  const applied = readCache.applyTick(tick.symbol, tick.price, tick.timestamp);
  if (!applied) return; // stale/out-of-order tick ignored (Last-Write-Wins)

  // Server processes the tick ONCE per symbol, then broadcasts to every
  // subscriber of that symbol (efficient fan-out for 1000s of watchers).
  broadcastSymbolUpdate(tick.symbol, tick.price, tick.timestamp);

  const matchingAssets = writeDb.listAssetsBySymbol(tick.symbol);
  for (const asset of matchingAssets) {
    writeDb.updateAssetHighLow(asset.id, tick.price);
    const cached = readCache.getAsset(asset.id);
    if (!cached) continue;

    // 1) Volatility spike detection (+/-2% vs previous cached price)
    if (cached.prevPrice > 0) {
      const pctChange = (tick.price - cached.prevPrice) / cached.prevPrice;
      if (Math.abs(pctChange) >= VOLATILITY_THRESHOLD) {
        raiseMeaningfulEvent(asset.id, {
          id: uuid(),
          symbol: tick.symbol,
          type: 'VOLATILITY_SPIKE',
          message: `${tick.symbol} moved ${(pctChange * 100).toFixed(2)}% in one tick`,
          price: tick.price,
          timestamp: tick.timestamp,
        });
      }
    }

    // 2) Intraday high/low cross detection
    if (tick.price >= asset.dailyHigh && tick.price > cached.dailyHigh - 0.001) {
      raiseMeaningfulEvent(asset.id, {
        id: uuid(),
        symbol: tick.symbol,
        type: 'HIGH_CROSS',
        message: `${tick.symbol} hit a new intraday high of $${tick.price.toFixed(2)}`,
        price: tick.price,
        timestamp: tick.timestamp,
      });
    }
    if (tick.price <= asset.dailyLow && tick.price < cached.dailyLow + 0.001) {
      raiseMeaningfulEvent(asset.id, {
        id: uuid(),
        symbol: tick.symbol,
        type: 'LOW_CROSS',
        message: `${tick.symbol} hit a new intraday low of $${tick.price.toFixed(2)}`,
        price: tick.price,
        timestamp: tick.timestamp,
      });
    }

    // 3) Custom trigger breach evaluation (async, on the incoming stream)
    for (const trigger of cached.triggers) {
      if (!trigger.active) continue;
      const breached =
        (trigger.direction === 'above' && tick.price >= trigger.targetPrice) ||
        (trigger.direction === 'below' && tick.price <= trigger.targetPrice);
      if (breached) {
        writeDb.deactivateTrigger(trigger.id);
        readCache.setTriggers(asset.id, writeDb.listTriggersForAsset(asset.id));
        raiseMeaningfulEvent(asset.id, {
          id: uuid(),
          symbol: tick.symbol,
          type: 'TRIGGER_BREACH',
          message: `${tick.symbol} crossed your target of $${trigger.targetPrice.toFixed(2)} (${trigger.direction})`,
          price: tick.price,
          timestamp: tick.timestamp,
        });
      }
    }
  }
});

export function registerEventConsumers() {
  // Importing this module wires up the listeners above (side-effect init).
}
