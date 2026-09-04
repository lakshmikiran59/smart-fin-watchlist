# Smart Financial Watchlist (NSE / INR)

A high-performance watchlist app for Indian equities that surfaces only
**meaningful** price movements — volatility spikes, intraday high/low breaks,
and user-defined triggers — instead of drowning users in every tick. Built
with a **CQRS (Command Query Responsibility Segregation)** architecture to
keep writes and reads independently fast and scalable.

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Node.js, TypeScript, Express, `ws` (WebSockets) |
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| "Redis" (Read Cache) | In-memory simulation, `backend/src/cache/readCache.ts` |
| "Kafka" (Event Bus) | In-memory pub/sub simulation, `backend/src/events/eventBus.ts` |
| Market data | Simulated NSE ticker feed, `backend/src/marketData/simulator.ts` |
| Tests | Jest + ts-jest, `backend/tests/` |

This is a monorepo split into two packages, each with its own detailed docs:

- **[`backend/README.md`](./backend/README.md)** — CQRS pipeline, highlight
  engine rules, LWW/staleness/fan-out mechanics, API surface, testing notes.
- **[`frontend/README.md`](./frontend/README.md)** — UI behaviors (flash
  animations, stale badge, While-You-Were-Away panel), project layout,
  running/building.

The rest of this page is a high-level overview of the whole system.

## Why CQRS

Writes (add/remove asset, set a trigger) and reads (render a watchlist,
compute "while you were away" deltas) have very different performance needs.
Separating them means:
- The **Write DB** stays a simple, consistent source of truth for
  watchlists/assets/triggers — no need to optimize it for read fan-out.
- The **Read Cache** is fully denormalized and pre-computed, so the API never
  joins across tables to serve a request — it just returns what's already
  there.
- The two sides communicate only through **domain events** on the event bus,
  so write latency is never blocked by cache updates or WebSocket broadcast.

## Architecture

```
                    ┌─────────────────────┐
                    │   Market Simulator   │  (emits a tick per NSE symbol)
                    └──────────┬───────────┘
                               │ MarketTickReceived
                               ▼
                    ┌─────────────────────┐
  COMMAND SIDE      │      Event Bus       │      QUERY SIDE
  (writes)          │  (simulated Kafka)   │      (reads)
                     └──────────┬───────────┘
        ▲                       │
        │              ┌────────┴─────────┐
 HTTP routes           │  eventConsumers.ts │  ← Highlight Engine
 (Express)             │  - LWW conflict    │
        │              │    resolution      │
        ▼              │  - volatility spike│
┌───────────────┐      │  - high/low cross  │
│ commandHandlers│      │  - trigger breach  │
│  - validation  │      └────────┬───────────┘
│  - add/remove  │               │
│    asset       │               ▼
│  - set trigger │      ┌─────────────────┐
└───────┬────────┘      │   Read Cache     │  (simulated Redis)
        │               │  denormalized,   │
        ▼               │  pre-computed    │
┌───────────────┐       └────────┬─────────┘
│   Write DB     │                │
│ (source of     │       ┌────────┴─────────┐
│  truth)        │       │  queryHandlers.ts │ → HTTP GET responses
└────────────────┘       └────────┬─────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │   WS Server      │  fan-out by symbol
                          │  (per-symbol     │
                          │   subscriber     │
                          │   Map<Set<ws>>)  │
                          └────────┬─────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │   React Frontend │
                          └─────────────────┘
```

## What counts as a "meaningful change"

Every tick updates the live price silently. Only these are pushed as
highlighted events (`backend/src/query/eventConsumers.ts`):

| Type | Rule |
|---|---|
| `VOLATILITY_SPIKE` | Price moves ≥ ±2% vs. the previously cached price in a single tick |
| `HIGH_CROSS` / `LOW_CROSS` | Tick breaks the asset's intraday high/low |
| `TRIGGER_BREACH` | Tick crosses a user-defined target price |

## Key mechanisms

- **Last-Write-Wins (LWW)**: `readCache.applyTick()` rejects any tick whose
  timestamp is older than what's cached, so out-of-order/delayed ticks can't
  overwrite a newer price.
- **Staleness**: an asset is flagged `Stale` in the UI if no tick has arrived
  in the last **10 seconds** (`STALE_THRESHOLD_MS` in `readCache.ts`, mirrored
  by `STALE_MS` in `AssetCard.tsx`).
- **Per-symbol WebSocket fan-out**: `backend/src/ws/wsServer.ts` keeps a
  `Map<symbol, Set<WebSocket>>`. A tick for `RELIANCE` is processed once and
  broadcast only to sockets subscribed to `RELIANCE` — so 1,000 users watching
  the same stock cost one computation, not 1,000.
- **Session snapshots / "While You Were Away"**: on disconnect, the server
  saves a snapshot of prices the user last saw; on reconnect it diffs against
  current cache state to show what changed while away
  (`saveUserSnapshot`/`queryHandlers.ts`).
- **50-asset limit** per watchlist, enforced in `writeDb.ts`.
- **Localization**: NSE tickers (RELIANCE, TCS, HDFCBANK, INFY, …) and INR
  currency formatted with `en-IN` locale (`frontend/src/utils/currency.ts`).

## Running locally

```bash
# backend
cd backend && npm install && npm run dev   # Express + WS server on :4000

# frontend (separate terminal)
cd frontend && npm install && npm run dev  # Vite dev server on :5173
```

Backend tests: `cd backend && npm test` (Jest: 7 suites / 55 tests).

See [`backend/README.md`](./backend/README.md) and
[`frontend/README.md`](./frontend/README.md) for project layout, API
surface, and detailed UI/backend behaviors.

## Scaling notes

Right now `writeDb`/`readCache` are single-process in-memory stores, and the
event bus/WebSocket layer run in one Node process. For real production scale:
- Back the Read Cache with actual Redis (pub/sub across instances).
- Replace the in-memory event bus with real Kafka so multiple backend
  instances consume the same tick stream.
- Put the WS layer behind a shared broker so ticks fan out correctly across
  processes, not just within one.

The CQRS separation itself is what makes this scaling path additive rather
than a rewrite — reads never block on writes, and writes never block on
cache/broadcast fan-out (events are published via `setImmediate`).
