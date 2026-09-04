# Backend — Smart Financial Watchlist

Node.js/TypeScript backend implementing a CQRS pipeline for tracking NSE
equities: a market tick simulator, command (write) handlers, an event-driven
highlight engine, a denormalized read cache, and a per-symbol WebSocket
fan-out layer.

## Tech stack

- Node.js, TypeScript, Express
- `ws` for WebSockets
- In-memory simulations of Redis (Read Cache) and Kafka (Event Bus)
- Jest + ts-jest for tests

## Architecture

```
Market Simulator → Event Bus (MarketTickReceived)
                          │
        ┌─────────────────┴──────────────────┐
        ▼                                     ▼
  COMMAND SIDE                          QUERY SIDE
  routes → commandHandlers →      eventConsumers.ts (Highlight Engine)
  writeDb (source of truth)         - LWW conflict resolution
                                     - volatility spike / high-low cross /
                                       trigger breach detection
                                          │
                                          ▼
                                    Read Cache (denormalized)
                                          │
                                          ▼
                          queryHandlers.ts ──► HTTP GET responses
                          wsServer.ts     ──► per-symbol WS fan-out
```

Commands and queries never share code paths; they're linked only via domain
events on the event bus, so write latency never blocks on cache/broadcast
work (events are published via `setImmediate`).

## What counts as a "meaningful change"

Every tick updates the live price silently in the Read Cache. Only these are
raised as highlighted events (`src/query/eventConsumers.ts`):

| Type | Rule |
|---|---|
| `VOLATILITY_SPIKE` | Price moves ≥ ±2% vs. the previously cached price in a single tick |
| `HIGH_CROSS` / `LOW_CROSS` | Tick breaks the asset's intraday high/low |
| `TRIGGER_BREACH` | Tick crosses a user-defined target price |

## Key mechanisms

- **Last-Write-Wins (LWW)** — `readCache.applyTick()` rejects any tick whose
  timestamp is older than the cached one, so out-of-order/delayed ticks can't
  overwrite a newer price.
- **Staleness** — `readCache.isStale()` flags an asset if no tick arrived in
  the last **10 seconds** (`STALE_THRESHOLD_MS`).
- **Per-symbol WebSocket fan-out** — `src/ws/wsServer.ts` keeps a
  `Map<symbol, Set<WebSocket>>`. A tick is processed once and broadcast only
  to sockets subscribed to that symbol, so 1,000 users watching the same
  stock cost one computation, not 1,000.
- **Session snapshots** — on disconnect, `saveUserSnapshot()` stores the
  prices a user last saw; on reconnect, `queryHandlers.ts` diffs against
  current cache state to compute "While You Were Away" deltas.
- **50-asset limit** per watchlist, enforced in `writeDb.ts`.
- **Localization** — NSE tickers (RELIANCE, TCS, HDFCBANK, INFY, …) with INR
  price levels, exposed via `CURRENCY = 'INR'` in `marketData/simulator.ts`.

## Project layout

```
src/
  auth/            simple token-based auth
  command/         command handlers (write path validation + mutation)
  db/              write DB (source of truth): watchlists, assets, triggers
  cache/           read cache (denormalized, LWW, staleness, snapshots)
  events/          in-memory event bus (simulated Kafka)
  query/           eventConsumers.ts (highlight engine) + queryHandlers.ts
  marketData/      NSE tick simulator
  ws/              WebSocket server, per-symbol fan-out
  routes/          Express HTTP routes
  types.ts         shared domain types
  index.ts         app entrypoint (HTTP + WS server bootstrap)
tests/             Jest suites: auth, readCache, writeDb, commandHandlers,
                   eventConsumers, queryHandlers, wsServer
```

## Running

```bash
npm install
npm run dev     # starts Express + WS server on :4000 (ts-node-dev, hot reload)
```

## Testing

```bash
npm test        # Jest: 7 suites / 55 tests
```

Notes on the test approach:
- `wsServer.test.ts` simulates WebSocket clients in-process (an `EventEmitter`-based
  fake socket fed directly into `wss.emit('connection', ...)`) rather than opening
  real network sockets, to keep tests fast and avoid environment-specific socket
  flakiness while still exercising the real subscribe/unsubscribe/broadcast logic.
- `readCache`/`writeDb`/`commandHandlers` tests instantiate isolated class instances
  rather than sharing the production singleton, so tests don't leak state.

## API surface (high level)

- `POST /api/auth/login` — issue a token for a `userId`
- `POST /api/watchlists` — create a watchlist
- `GET /api/watchlists/:id` — denormalized watchlist view (read path)
- `POST /api/watchlists/:id/assets` — add an asset (command path)
- `DELETE /api/watchlists/:id/assets/:assetId` — remove an asset
- `POST /api/assets/:assetId/triggers` — configure a price trigger
- `GET /api/meta/symbols` — list available NSE symbols + currency
- `GET /api/meta/health` — health check, includes connected WS client count
- `GET /ws` — WebSocket upgrade endpoint (SUBSCRIBE/UNSUBSCRIBE/PING, TICK/MEANINGFUL_EVENT/PONG)

## Scaling notes

`writeDb`/`readCache` are currently single-process in-memory stores, and the
event bus/WS layer run in one Node process. For real scale:
- Back the Read Cache with actual Redis (pub/sub across instances).
- Replace the in-memory event bus with real Kafka so multiple backend
  instances consume the same tick stream.
- Put the WS layer behind a shared broker so ticks fan out correctly across
  processes, not just within one.
