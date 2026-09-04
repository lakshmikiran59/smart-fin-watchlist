import { EventEmitter } from 'events';

/**
 * Lightweight local Event Bus simulating an enterprise broker (Kafka/RabbitMQ).
 * Used to asynchronously sync the Command side (writes) with the Query side (reads).
 */
class DomainEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(200);
  }

  publish<T>(eventName: string, payload: T) {
    // Simulate async broker delivery (next tick) instead of purely sync EventEmitter dispatch
    setImmediate(() => this.emit(eventName, payload));
  }
}

export const eventBus = new DomainEventBus();

export const DomainEvents = {
  WatchlistCreated: 'WatchlistCreated',
  AssetAddedToWatchlist: 'AssetAddedToWatchlist',
  AssetRemovedFromWatchlist: 'AssetRemovedFromWatchlist',
  TriggerConfigured: 'TriggerConfigured',
  MarketTickReceived: 'MarketTickReceived',
  MeaningfulEventRaised: 'MeaningfulEventRaised',
} as const;
