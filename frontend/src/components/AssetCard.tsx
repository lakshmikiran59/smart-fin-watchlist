import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Trash2, Zap, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { DenormalizedAsset, WhileAwayDelta } from '../types';
import { WhileAwayBadge } from './WhileAwayPanel';
import { TriggerForm } from './TriggerForm';
import { formatINR } from '../utils/currency';

const STALE_MS = 10_000;

export function AssetCard({
  asset,
  delta,
  onRemove,
  onTriggerSet,
}: {
  asset: DenormalizedAsset;
  delta: WhileAwayDelta | undefined;
  onRemove: () => void;
  onTriggerSet: () => void;
}) {
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const [now, setNow] = useState(Date.now());
  const prevPrice = useRef(asset.price);

  useEffect(() => {
    if (asset.price !== prevPrice.current) {
      setFlash(asset.price > prevPrice.current ? 'up' : 'down');
      prevPrice.current = asset.price;
      const t = setTimeout(() => setFlash(null), 800);
      return () => clearTimeout(t);
    }
  }, [asset.price]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(t);
  }, []);

  const stale = now - asset.lastTickAt > STALE_MS;
  const changeAbs = asset.price - asset.dailyOpen;
  const changePct = asset.dailyOpen > 0 ? (changeAbs / asset.dailyOpen) * 100 : 0;
  const isUp = changeAbs >= 0;

  return (
    <div
      className={`relative rounded-xl border p-4 transition-colors ${
        stale ? 'border-amber-700/50 bg-slate-900/40 opacity-70' : 'border-slate-800 bg-slate-900/70'
      } ${flash === 'up' ? 'animate-flashGreen' : flash === 'down' ? 'animate-flashRed' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-slate-100">{asset.symbol}</span>
            {stale && (
              <span className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                <AlertTriangle size={10} /> Stale
              </span>
            )}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-50">{formatINR(asset.price)}</span>
            <span className={`flex items-center text-xs font-medium ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
              {isUp ? <ArrowUpCircle size={12} /> : <ArrowDownCircle size={12} />}
              {isUp ? '+' : ''}
              {changeAbs.toFixed(2)} ({isUp ? '+' : ''}
              {changePct.toFixed(2)}%)
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            H {formatINR(asset.dailyHigh)} · L {formatINR(asset.dailyLow)}
          </div>
        </div>
        <button onClick={onRemove} className="text-slate-500 hover:text-red-400">
          <Trash2 size={15} />
        </button>
      </div>

      <WhileAwayBadge delta={delta} />

      {asset.meaningfulEvents.length > 0 && (
        <div className="mt-2 flex items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-1 text-[11px] text-indigo-300">
          <Zap size={11} /> {asset.meaningfulEvents[0].message}
        </div>
      )}

      <TriggerForm
        assetId={asset.assetId}
        currentPrice={asset.price}
        activeTriggers={asset.triggers.filter((t) => t.active)}
        onSet={onTriggerSet}
      />
    </div>
  );
}
