import { useEffect, useRef, useState, useCallback } from 'react';
import { MeaningfulEvent, WsMessage } from '../types';

export type SocketStatus = 'connecting' | 'open' | 'closed' | 'error';

interface UseMarketSocketResult {
  status: SocketStatus;
  latencyMs: number | null;
  lastEvent: MeaningfulEvent | null;
  subscribe: (symbols: string[]) => void;
  onTick: (cb: (symbol: string, price: number, timestamp: number) => void) => void;
}

/**
 * Owns a single WebSocket connection, cleans up listeners/intervals on
 * unmount to avoid leaks/duplicate connections during rapid remounts.
 */
export function useMarketSocket(): UseMarketSocketResult {
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastEvent, setLastEvent] = useState<MeaningfulEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const tickHandlers = useRef<Set<(symbol: string, price: number, timestamp: number) => void>>(new Set());
  const pendingSubs = useRef<Set<string>>(new Set());

  useEffect(() => {
    let pingInterval: ReturnType<typeof setInterval>;
    let cancelled = false;
    const ws = new WebSocket('ws://localhost:4000/ws');
    wsRef.current = ws;

    ws.onopen = () => {
      if (cancelled) return;
      setStatus('open');
      if (pendingSubs.current.size > 0) {
        ws.send(JSON.stringify({ type: 'SUBSCRIBE', symbols: [...pendingSubs.current] }));
      }
      pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
        }
      }, 5000);
    };

    ws.onmessage = (raw) => {
      try {
        const msg: WsMessage = JSON.parse(raw.data);
        if (msg.type === 'TICK') {
          tickHandlers.current.forEach((cb) => cb(msg.symbol, msg.price, msg.timestamp));
        } else if (msg.type === 'MEANINGFUL_EVENT') {
          setLastEvent(msg.event);
        } else if (msg.type === 'PONG') {
          setLatencyMs(Date.now() - msg.clientTs);
        }
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => !cancelled && setStatus('closed');
    ws.onerror = () => !cancelled && setStatus('error');

    return () => {
      cancelled = true;
      clearInterval(pingInterval);
      ws.close();
      wsRef.current = null;
    };
  }, []);

  const subscribe = useCallback((symbols: string[]) => {
    symbols.forEach((s) => pendingSubs.current.add(s.toUpperCase()));
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'SUBSCRIBE', symbols }));
    }
  }, []);

  const onTick = useCallback((cb: (symbol: string, price: number, timestamp: number) => void) => {
    tickHandlers.current.add(cb);
    return () => tickHandlers.current.delete(cb);
  }, []);

  return { status, latencyMs, lastEvent, subscribe, onTick };
}
