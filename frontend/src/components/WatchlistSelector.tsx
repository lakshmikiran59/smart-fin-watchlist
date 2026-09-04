import { useState } from 'react';
import { Plus, ListChecks } from 'lucide-react';
import { Watchlist } from '../types';

export function WatchlistSelector({
  watchlists,
  activeId,
  onSelect,
  onCreate,
}: {
  watchlists: Watchlist[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
}) {
  const [newName, setNewName] = useState('');

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
      <ListChecks size={16} className="text-indigo-400" />
      {watchlists.map((wl) => (
        <button
          key={wl.id}
          onClick={() => onSelect(wl.id)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            wl.id === activeId
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          {wl.name}
        </button>
      ))}
      <div className="ml-2 flex items-center gap-1">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New watchlist name"
          className="w-40 rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-100 placeholder-slate-500"
        />
        <button
          onClick={() => {
            if (newName.trim()) {
              onCreate(newName.trim());
              setNewName('');
            }
          }}
          className="flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500"
        >
          <Plus size={12} /> Create
        </button>
      </div>
    </div>
  );
}
