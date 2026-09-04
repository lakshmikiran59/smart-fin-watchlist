import { useState } from 'react';
import { Target, Loader2 } from 'lucide-react';
import { AlertTrigger } from '../types';
import { api } from '../api/client';
import { formatINR } from '../utils/currency';

export function TriggerForm({
  assetId,
  currentPrice,
  activeTriggers,
  onSet,
}: {
  assetId: string;
  currentPrice: number;
  activeTriggers: AlertTrigger[];
  onSet: () => void;
}) {
  const [value, setValue] = useState('');
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    const num = Number(value);
    // Sanitize: reject non-numeric / negative / zero values before hitting the API
    if (!value.trim() || Number.isNaN(num) || num <= 0) {
      setError('Enter a valid positive price');
      return;
    }
    setLoading(true);
    try {
      await api.setTrigger(assetId, num, direction);
      setValue('');
      onSet();
    } catch (e: any) {
      setError(e.message || 'Failed to set trigger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 rounded-md border border-slate-800 bg-slate-900/40 p-2">
      <div className="flex items-center gap-1 text-[11px] text-slate-400">
        <Target size={11} /> Set a price trigger
      </div>
      <div className="mt-1 flex items-center gap-1">
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value as 'above' | 'below')}
          className="rounded bg-slate-800 px-1 py-1 text-[11px] text-slate-200"
        >
          <option value="above">Above</option>
          <option value="below">Below</option>
        </select>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={currentPrice.toFixed(2)}
          className="w-20 rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-100 placeholder-slate-500"
        />
        <button
          onClick={submit}
          disabled={loading}
          className="flex items-center gap-1 rounded bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? <Loader2 size={11} className="animate-spin" /> : 'Set'}
        </button>
      </div>
      {error && <div className="mt-1 text-[10px] text-red-400">{error}</div>}
      {activeTriggers.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {activeTriggers.map((t) => (
            <span key={t.id} className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-300">
              {t.direction} {formatINR(t.targetPrice)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
