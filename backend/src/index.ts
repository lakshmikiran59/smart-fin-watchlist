import express from 'express';
import cors from 'cors';
import http from 'http';
import { router } from './routes/routes';
import { registerEventConsumers } from './query/eventConsumers';
import { initWebSocketServer } from './ws/wsServer';
import { startMarketSimulator } from './marketData/simulator';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', router);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Global safety net - never crash the process on a bad request
  res.status(500).json({ error: err?.message || 'Internal server error' });
});

const server = http.createServer(app);

// Wire the CQRS query-side consumers BEFORE the market simulator starts
// emitting ticks, so no events are dropped.
registerEventConsumers();
initWebSocketServer(server);
startMarketSimulator();

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
server.listen(PORT, () => {
  console.log(`Smart Watchlist backend running on http://localhost:${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection (ignored, process kept alive):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (ignored, process kept alive):', err);
});
