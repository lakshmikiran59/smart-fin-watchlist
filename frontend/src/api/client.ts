import { Watchlist, WhileAwayDelta } from '../types';

const BASE_URL = 'http://localhost:4000/api';

function getToken(): string | null {
  return localStorage.getItem('watchlist_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function login(userId: string) {
  const data = await request<{ token: string; userId: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
  localStorage.setItem('watchlist_token', data.token);
  localStorage.setItem('watchlist_user_id', data.userId);
  return data;
}

export const api = {
  getSymbols: () => request<{ symbols: string[] }>('/meta/symbols'),
  getHealth: () => request<{ status: string; connectedClients: number; timestamp: number }>('/meta/health'),
  listWatchlists: () => request<Watchlist[]>('/watchlists'),
  createWatchlist: (name: string) =>
    request<{ id: string }>('/watchlists', { method: 'POST', body: JSON.stringify({ name }) }),
  getWatchlist: (id: string) => request<Watchlist>(`/watchlists/${id}`),
  addAsset: (watchlistId: string, symbol: string) =>
    request(`/watchlists/${watchlistId}/assets`, { method: 'POST', body: JSON.stringify({ symbol }) }),
  removeAsset: (watchlistId: string, assetId: string) =>
    request(`/watchlists/${watchlistId}/assets/${assetId}`, { method: 'DELETE' }),
  setTrigger: (assetId: string, targetPrice: number, direction: 'above' | 'below') =>
    request(`/assets/${assetId}/trigger`, {
      method: 'POST',
      body: JSON.stringify({ targetPrice, direction }),
    }),
  getWhileAway: (watchlistId: string) => request<WhileAwayDelta[]>(`/watchlists/${watchlistId}/while-away`),
  saveSnapshot: (watchlistId: string) => request(`/watchlists/${watchlistId}/snapshot`, { method: 'POST' }),
};

export { getToken };
