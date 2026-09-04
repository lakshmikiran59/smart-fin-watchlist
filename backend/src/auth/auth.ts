import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

/**
 * Simple JWT-based session simulation mapping tokens to user_id, enabling
 * "session persistence across devices" (any device presenting the same
 * token resolves to the same user_id and thus the same watchlists/snapshots).
 */

const JWT_SECRET = process.env.JWT_SECRET || 'dev-local-secret-do-not-use-in-prod';

export function issueToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

export interface AuthedRequest extends Request {
  userId?: string;
}

export function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : (req.query.token as string | undefined);
  if (!token) {
    return res.status(401).json({ error: 'Missing auth token' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
