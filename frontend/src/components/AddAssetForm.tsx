import { useState } from 'react';
import { PlusCircle } from 'lucide-react';

export function AddAssetForm({
  availableSymbols,
  existingSymbols,
  onAdd,
  maxReached,
}: {
  availableSymbols: string[];
  existingSymbols: string[];
  onAdd: (symbol: string) => void;
  maxReached: boolean;
}) {
  const [symbol, setSymbol] = useState('');
  const suggestions = availableSymbols.filter(
    (s) => !existingSymbols.includes(s) && s.startsWith(symbol.toUpperCase())
  );

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="Add ticker (e.g. RELIANCE)"
          disabled={maxReached}
          className="w-48 rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 disabled:opacity-50"
        />
        {symbol && suggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-48 rounded-md border border-slate-800 bg-slate-900 shadow-lg">
            {suggestions.slice(0, 5).map((s) => (
              <button
                key={s}
                onClick={() => {
                  onAdd(s);
                  setSymbol('');
                }}
                className="block w-full px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={() => {
          if (symbol.trim()) onAdd(symbol.trim());
          setSymbol('');
        }}
        disabled={maxReached || !symbol.trim()}
        className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
      >
        <PlusCircle size={13} /> Add
      </button>
      {maxReached && <span className="text-[11px] text-amber-400">Limit of 50 assets reached</span>}
    </div>
  );
}
