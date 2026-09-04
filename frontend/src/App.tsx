import { useCallback, useEffect, useRef, useState } from 'react';
import { api, login, getToken } from './api/client';
import { useMarketSocket } from './hooks/useMarketSocket';
import { Watchlist, WhileAwayDelta } from './types';
import { WatchlistSelector } from './components/WatchlistSelector';
import { AddAssetForm } from './components/AddAssetForm';
import { AssetCard } from './components/AssetCard';
import { EmptyState } from './components/EmptyState';
import { HealthIndicator } from './components/HealthIndicator';
import { LineChart } from 'lucide-react';

const MAX_ASSETS = 50;

export default function App() {
  const [ready, setReady] = useState(false);
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [deltas, setDeltas] = useState<WhileAwayDelta[]>([]);
  const { status, latencyMs, subscribe, onTick } = useMarketSocket();
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;

  const active = watchlists.find((w) => w.id === activeId) || null;

  const refreshActive = useCallback(async (id: string) => {
    const [wl, away] = await Promise.all([api.getWatchlist(id), api.getWhileAway(id)]);
    setWatchlists((prev) => prev.map((w) => (w.id === id ? wl : w)));
    setDeltas(away);
  }, []);

  // Bootstrap: session simulation + save snapshot on unload (cross-device persistence)
  useEffect(() => {
    (async () => {
      if (!getToken()) {
        await login(`user-${Math.random().toString(36).slice(2, 8)}`);
      }
      let lists = await api.listWatchlists();
      if (lists.length === 0) {
        await api.createWatchlist('My Watchlist');
        lists = await api.listWatchlists();
      }
      const { symbols: syms } = await api.getSymbols();
      setSymbols(syms);
      setWatchlists(lists);
      setActiveId(lists[0]?.id ?? null);
      if (lists[0]) setDeltas(await api.getWhileAway(lists[0].id));
      setReady(true);
    })();
  }, []);

  // Save a "last seen" snapshot when the user leaves the tab/app
  useEffect(() => {
    const handler = () => {
      if (activeIdRef.current) {
        navigator.sendBeacon?.(
          `http://localhost:4000/api/watchlists/${activeIdRef.current}/snapshot?token=${getToken()}`
        );
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Subscribe to symbols on the active watchlist & apply live ticks locally
  useEffect(() => {
    if (!active) return;
    const syms = active.assets.map((a) => a.symbol);
    if (syms.length > 0) subscribe(syms);
  }, [active?.id, active?.assets.length, subscribe]);

  useEffect(() => {
    const unsub = onTick((symbol, price, timestamp) => {
      setWatchlists((prev) =>
        prev.map((wl) => ({
          ...wl,
          assets: wl.assets.map((a) =>
            a.symbol === symbol
              ? { ...a, prevPrice: a.price, price, lastTickAt: timestamp, cachedAt: Date.now() }
              : a
          ),
        }))
      );
    });
    return unsub;
  }, [onTick]);

  // Periodic light refresh to pick up triggers/events from server denormalization
  useEffect(() => {
    if (!activeId) return;
    const t = setInterval(() => refreshActive(activeId), 6000);
    return () => clearInterval(t);
  }, [activeId, refreshActive]);

  const handleAddAsset = async (symbol: string) => {
    if (!activeId) return;
    try {
      await api.addAsset(activeId, symbol);
      await refreshActive(activeId);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveAsset = async (assetId: string) => {
    if (!activeId) return;
    await api.removeAsset(activeId, assetId);
    await refreshActive(activeId);
  };

  const handleCreateWatchlist = async (name: string) => {
    await api.createWatchlist(name);
    const lists = await api.listWatchlists();
    setWatchlists(lists);
    setActiveId(lists[lists.length - 1].id);
  };

  if (!ready) {
    return <div className="flex h-screen items-center justify-center text-slate-400">Loading Smart Watchlist…</div>;
  }

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-6 py-6">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LineChart className="text-indigo-400" size={22} />
          <h1 className="text-lg font-bold text-slate-50">Smart Financial Watchlist</h1>
        </div>
        <HealthIndicator status={status} latencyMs={latencyMs} />
      </header>

      <WatchlistSelector
        watchlists={watchlists}
        activeId={activeId}
        onSelect={setActiveId}
        onCreate={handleCreateWatchlist}
      />

      <div className="my-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-300">{active?.name}</h2>
        <AddAssetForm
          availableSymbols={symbols}
          existingSymbols={active?.assets.map((a) => a.symbol) ?? []}
          onAdd={handleAddAsset}
          maxReached={(active?.assets.length ?? 0) >= MAX_ASSETS}
        />
      </div>

      {active && active.assets.length === 0 && <EmptyState onAddTrending={handleAddAsset} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {active?.assets.map((asset) => (
          <AssetCard
            key={asset.assetId}
            asset={asset}
            delta={deltas.find((d) => d.symbol === asset.symbol)}
            onRemove={() => handleRemoveAsset(asset.assetId)}
            onTriggerSet={() => activeId && refreshActive(activeId)}
          />
        ))}
      </div>
    </div>
  );
}
