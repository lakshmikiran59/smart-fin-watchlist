import { EventEmitter } from 'events';
import http from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import {
  initWebSocketServer,
  broadcastSymbolUpdate,
  broadcastMeaningfulEvent,
  getConnectedClientCount,
} from '../src/ws/wsServer';

/**
 * These tests simulate WS clients in-process (no real network sockets) to
 * avoid environment-specific socket flakiness, while still exercising the
 * real subscribe/unsubscribe/cleanup/broadcast logic in wsServer.ts.
 */
class FakeSocket extends EventEmitter {
  readyState = WebSocket.OPEN;
  sent: any[] = [];
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  lastOfType(type: string) {
    return [...this.sent].reverse().find((m) => m.type === type);
  }
}

function connectClient(wss: WebSocketServer): FakeSocket {
  const fake = new FakeSocket();
  wss.emit('connection', fake as any);
  return fake;
}

describe('WebSocket server (per-symbol fan-out)', () => {
  let server: http.Server;
  let wss: WebSocketServer;

  beforeEach(() => {
    server = http.createServer();
    wss = initWebSocketServer(server);
  });

  test('sends a CONNECTED message on connect and tracks the client count', () => {
    const before = getConnectedClientCount();
    const client = connectClient(wss);
    expect(client.lastOfType('CONNECTED')).toBeDefined();
    expect(getConnectedClientCount()).toBe(before + 1);
    client.emit('close');
    expect(getConnectedClientCount()).toBe(before);
  });

  test('only delivers a symbol tick to clients subscribed to that symbol', () => {
    const clientA = connectClient(wss);
    const clientB = connectClient(wss);

    clientA.emit('message', JSON.stringify({ type: 'SUBSCRIBE', symbols: ['RELIANCE'] }));
    clientB.emit('message', JSON.stringify({ type: 'SUBSCRIBE', symbols: ['TCS'] }));

    broadcastSymbolUpdate('RELIANCE', 2950, Date.now());

    const tick = clientA.lastOfType('TICK');
    expect(tick).toBeDefined();
    expect(tick.symbol).toBe('RELIANCE');
    expect(clientB.lastOfType('TICK')).toBeUndefined(); // B never subscribed to RELIANCE

    clientA.emit('close');
    clientB.emit('close');
  });

  test('unsubscribe stops further delivery for that symbol', () => {
    const client = connectClient(wss);
    client.emit('message', JSON.stringify({ type: 'SUBSCRIBE', symbols: ['INFY'] }));
    client.emit('message', JSON.stringify({ type: 'UNSUBSCRIBE', symbols: ['INFY'] }));

    broadcastSymbolUpdate('INFY', 1800, Date.now());
    expect(client.lastOfType('TICK')).toBeUndefined();
    client.emit('close');
  });

  test('cleanup on disconnect removes the client from the symbol index', () => {
    const client = connectClient(wss);
    client.emit('message', JSON.stringify({ type: 'SUBSCRIBE', symbols: ['HDFCBANK'] }));
    client.emit('close');

    // A tick after disconnect must not throw and must not reach the closed client
    expect(() => broadcastSymbolUpdate('HDFCBANK', 1650, Date.now())).not.toThrow();
    expect(client.lastOfType('TICK')).toBeUndefined();
  });

  test('broadcastMeaningfulEvent delivers only to subscribers of that symbol', () => {
    const client = connectClient(wss);
    client.emit('message', JSON.stringify({ type: 'SUBSCRIBE', symbols: ['SBIN'] }));

    broadcastMeaningfulEvent({
      id: 'evt-1',
      symbol: 'SBIN',
      type: 'VOLATILITY_SPIKE',
      message: 'test spike',
      price: 800,
      timestamp: Date.now(),
    });

    const msg = client.lastOfType('MEANINGFUL_EVENT');
    expect(msg).toBeDefined();
    expect(msg.event.symbol).toBe('SBIN');
    client.emit('close');
  });

  test('responds to PING with PONG', () => {
    const client = connectClient(wss);
    const clientTs = Date.now();
    client.emit('message', JSON.stringify({ type: 'PING', timestamp: clientTs }));
    const pong = client.lastOfType('PONG');
    expect(pong).toBeDefined();
    expect(pong.clientTs).toBe(clientTs);
    client.emit('close');
  });

  test('ignores malformed messages without crashing the connection', () => {
    const client = connectClient(wss);
    expect(() => client.emit('message', 'not-json{{{')).not.toThrow();
    // still responsive afterwards
    client.emit('message', JSON.stringify({ type: 'PING', timestamp: 1 }));
    expect(client.lastOfType('PONG')).toBeDefined();
    client.emit('close');
  });
});
