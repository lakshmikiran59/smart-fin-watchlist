import jwt from 'jsonwebtoken';
import { issueToken, authMiddleware, AuthedRequest } from '../src/auth/auth';

function mockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((body: any) => {
    res.body = body;
    return res;
  });
  return res;
}

describe('Auth (JWT session simulation)', () => {
  test('issueToken produces a token that decodes to the given userId', () => {
    const token = issueToken('user-42');
    const decoded = jwt.decode(token) as { userId: string };
    expect(decoded.userId).toBe('user-42');
  });

  test('authMiddleware accepts a valid Bearer token and sets req.userId', () => {
    const token = issueToken('user-99');
    const req = { headers: { authorization: `Bearer ${token}` }, query: {} } as AuthedRequest;
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(req.userId).toBe('user-99');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('authMiddleware accepts a token passed as a query param (used by sendBeacon)', () => {
    const token = issueToken('user-beacon');
    const req = { headers: {}, query: { token } } as unknown as AuthedRequest;
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(req.userId).toBe('user-beacon');
    expect(next).toHaveBeenCalled();
  });

  test('authMiddleware rejects a request with no token at all (401)', () => {
    const req = { headers: {}, query: {} } as AuthedRequest;
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('authMiddleware rejects a malformed/invalid token (401)', () => {
    const req = { headers: { authorization: 'Bearer not-a-real-token' }, query: {} } as AuthedRequest;
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('authMiddleware rejects an expired token (401)', () => {
    const expired = jwt.sign({ userId: 'user-old' }, 'dev-local-secret-do-not-use-in-prod', { expiresIn: -10 });
    const req = { headers: { authorization: `Bearer ${expired}` }, query: {} } as AuthedRequest;
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
