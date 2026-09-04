import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { MeaningfulEvent } from '../types';

/**
 * WebSocket layer. Clients subscribe to specific symbols; the server
 * processes each incoming market tick exactly once (see eventConsumers.ts)
 * and fans it out to every socket subscribed to that symbol - so 1,000
 * clients watching AAPL do not cause 1,000 redundant computations.
 */

interface ClientMeta {
  subscriptions: Set<string>;
  connectedAt: number;
}

const clients = new Map<WebSocket, ClientMeta>();
const symbolIndex = new Map<string, Set<WebSocket>>();

export function initWebSocketServer(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    clients.set(ws, { subscriptions: new Set(), connectedAt: Date.now() });
    ws.send(JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'SUBSCRIBE' && Array.isArray(msg.symbols)) {
          subscribe(ws, msg.symbols);
        } else if (msg.type === 'UNSUBSCRIBE' && Array.isArray(msg.symbols)) {
          unsubscribe(ws, msg.symbols);
        } else if (msg.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now(), clientTs: msg.timestamp }));
        }
      } catch {
        // Malformed message - ignore rather than crash the connection
      }
    });

    ws.on('close', () => cleanup(ws));
    ws.on('error', () => cleanup(ws));
  });

  return wss;
}

function subscribe(ws: WebSocket, symbols: string[]) {
  const meta = clients.get(ws);
  if (!meta) return;
  for (const raw of symbols) {
    const symbol = String(raw).toUpperCase();
    meta.subscriptions.add(symbol);
    if (!symbolIndex.has(symbol)) symbolIndex.set(symbol, new Set());
    symbolIndex.get(symbol)!.add(ws);
  }
}

function unsubscribe(ws: WebSocket, symbols: string[]) {
  const meta = clients.get(ws);
  if (!meta) return;
  for (const raw of symbols) {
    const symbol = String(raw).toUpperCase();
    meta.subscriptions.delete(symbol);
    symbolIndex.get(symbol)?.delete(ws);
  }
}

function cleanup(ws: WebSocket) {
  const meta = clients.get(ws);
  if (meta) {
    for (const symbol of meta.subscriptions) {
      symbolIndex.get(symbol)?.delete(ws);
    }
  }
  clients.delete(ws);
}

function safeSend(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

export function broadcastSymbolUpdate(symbol: string, price: number, timestamp: number) {
  const subscribers = symbolIndex.get(symbol.toUpperCase());
  if (!subscribers || subscribers.size === 0) return;
  const payload = { type: 'TICK', symbol: symbol.toUpperCase(), price, timestamp };
  for (const ws of subscribers) safeSend(ws, payload);
}

export function broadcastMeaningfulEvent(event: MeaningfulEvent) {
  const subscribers = symbolIndex.get(event.symbol.toUpperCase());
  if (!subscribers || subscribers.size === 0) return;
  const payload = { type: 'MEANINGFUL_EVENT', event };
  for (const ws of subscribers) safeSend(ws, payload);
}

export function getConnectedClientCount() {
  return clients.size;
}
