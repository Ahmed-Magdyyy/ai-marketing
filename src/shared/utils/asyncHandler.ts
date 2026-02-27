// ─────────────────────────────────────────────────────────────────
// Async Handler — wraps async route handlers to catch errors
// automatically and forward them to Express error middleware.
// Usage: router.get('/path', asyncHandler(myController))
// ─────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from "express";

type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>;

function asyncHandler(fn: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export { asyncHandler };
