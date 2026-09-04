import { Router } from 'express';
import { AuthedRequest, authMiddleware, issueToken } from '../auth/auth';
import {
  createWatchlist,
  addAssetToWatchlist,
  removeAssetFromWatchlist,
  setAssetAlertTrigger,
} from '../command/commandHandlers';
import {
  getWatchlistView,
  listUserWatchlists,
  computeWhileYouWereAway,
  saveSessionSnapshot,
} from '../query/queryHandlers';
import { TRACKED_SYMBOLS, CURRENCY } from '../marketData/simulator';
import { getConnectedClientCount } from '../ws/wsServer';

export const router = Router();

function handle(fn: (req: AuthedRequest) => unknown) {
  return (req: AuthedRequest, res: any) => {
    try {
      const result = fn(req);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Unexpected error' });
    }
  };
}

// ---- Auth / session ----
router.post('/auth/login', (req, res) => {
  const userId = (req.body?.userId as string) || `guest-${Date.now()}`;
  const token = issueToken(userId);
  res.json({ token, userId });
});

router.get('/meta/symbols', (_req, res) => {
  res.json({ symbols: TRACKED_SYMBOLS, currency: CURRENCY });
});

router.get('/meta/health', (_req, res) => {
  res.json({ status: 'ok', connectedClients: getConnectedClientCount(), timestamp: Date.now() });
});

// ---- Command routes (Writes) ----
router.post('/watchlists', authMiddleware, handle((req) => createWatchlist(req.userId!, req.body?.name)));

router.post(
  '/watchlists/:id/assets',
  authMiddleware,
  handle((req) => addAssetToWatchlist(req.params.id, req.body?.symbol, req.userId!))
);

router.delete(
  '/watchlists/:id/assets/:assetId',
  authMiddleware,
  handle((req) => removeAssetFromWatchlist(req.params.id, req.params.assetId, req.userId!))
);

router.post(
  '/assets/:assetId/trigger',
  authMiddleware,
  handle((req) =>
    setAssetAlertTrigger(req.params.assetId, req.body?.targetPrice, req.body?.direction, req.userId!)
  )
);

// ---- Query routes (Reads) ----
router.get('/watchlists', authMiddleware, handle((req) => listUserWatchlists(req.userId!)));

router.get('/watchlists/:id', authMiddleware, handle((req) => getWatchlistView(req.params.id, req.userId!)));

router.get(
  '/watchlists/:id/while-away',
  authMiddleware,
  handle((req) => computeWhileYouWereAway(req.userId!, req.params.id))
);

router.post(
  '/watchlists/:id/snapshot',
  authMiddleware,
  handle((req) => saveSessionSnapshot(req.userId!, req.params.id))
);
