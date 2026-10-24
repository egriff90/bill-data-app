import type { Request, RequestHandler } from 'express';
import { queryInt } from '../routes/query';

/**
 * Fixed-window, per-IP request limiter held in memory. That's enough for a single instance; if the
 * app is ever scaled out, each instance keeps its own counts.
 */
export function rateLimit(windowMs: number, max: number): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  // Drop expired windows so the map doesn't grow without bound.
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, windowMs).unref();

  return (req, res, next) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
      return;
    }
    next();
  };
}

// Pages larger than this are CSV exports or the timeline, which pull whole result sets.
const LARGE_PAGE = 500;

/**
 * Requests that load a whole table (the stats and stages endpoints always do; the list endpoints do
 * when asked for a very large page). These get a much tighter limit than ordinary page loads.
 */
export function isExpensive(req: Request): boolean {
  if (req.path === '/amendments/stats' || req.path === '/stages/with-amendments') return true;
  return (queryInt(req.query.take) ?? 0) > LARGE_PAGE;
}

export const securityHeaders: RequestHandler = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
};
