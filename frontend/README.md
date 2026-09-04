# Frontend — Smart Financial Watchlist

React/TypeScript UI for the Smart Financial Watchlist. Renders live NSE
prices in INR, highlights meaningful moves, and shows what changed while a
user was away.

## Tech stack

- React + TypeScript
- Vite (dev server / build)
- Tailwind CSS (styling + flash-highlight keyframe animations)
- Native `WebSocket` client (via a custom hook) for live ticks

## How it works

1. On load, the app authenticates, fetches the user's watchlists via REST
   (`src/api/client.ts`), and renders the active one.
2. `useMarketSocket` (`src/hooks/useMarketSocket.ts`) opens a WebSocket to the
   backend, subscribes to the symbols in the active watchlist, and exposes an
   `onTick` callback.
3. `App.tsx` wires `onTick` into state: each incoming `TICK` message updates
   the matching asset's `price`/`lastTickAt` in place, so components re-render
   with the new value without a full refetch.
4. A periodic light refresh (every 6s) re-pulls the denormalized watchlist
   from the backend to pick up triggers/meaningful events computed
   server-side.
5. `MEANINGFUL_EVENT` messages surface as an indigo badge on the relevant
   `AssetCard`.

## Key UI behaviors

- **Price flash animation** — `AssetCard.tsx` diffs the incoming price
  against the previous one and applies `animate-flashGreen` /
  `animate-flashRed` (defined in `tailwind.config.js`) for 800ms.
- **Stale badge** — if `Date.now() - asset.lastTickAt > 10_000` (`STALE_MS`,
  mirrors the backend's `STALE_THRESHOLD_MS`), the card dims and shows an
  amber "Stale" badge with a warning icon.
- **INR formatting** — `src/utils/currency.ts` exposes `formatINR()`, using
  the `en-IN` locale for correct lakh/crore-style digit grouping.
- **"While You Were Away"** — `WhileAwayPanel.tsx` renders a delta badge per
  asset showing what changed since the user's last session, computed
  server-side and returned alongside the watchlist view.
- **Triggers** — `TriggerForm.tsx` lets a user set a target price per asset;
  active triggers are listed on the card and breaches surface as
  `MEANINGFUL_EVENT`s.

## Project layout

```
src/
  api/
    client.ts             REST client (auth, watchlists, assets, triggers)
  hooks/
    useMarketSocket.ts     WebSocket connection, subscribe/unsubscribe, onTick
  components/
    AssetCard.tsx          price, change %, high/low, stale badge, flash anim
    AddAssetForm.tsx        add NSE symbol to active watchlist
    TriggerForm.tsx         set/view price triggers
    WhileAwayPanel.tsx      "while you were away" delta badge
    WatchlistSelector.tsx   switch between watchlists
    EmptyState.tsx          empty watchlist placeholder
    HealthIndicator.tsx     backend/WS connection status
  utils/
    currency.ts             formatINR()
  types.ts                  shared frontend types (mirrors backend types)
  App.tsx                    top-level state, wiring REST + WS
  main.tsx                   React entrypoint
```

## Running

```bash
npm install
npm run dev      # Vite dev server on :5173, proxies/talks to backend on :4000
```

Make sure the backend (`../backend`) is running first — see
`../backend/README.md`.

## Build

```bash
npm run build     # production build via Vite
```
