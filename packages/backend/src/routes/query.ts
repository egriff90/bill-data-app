/**
 * Query-string parsing for route handlers.
 *
 * Express parses `?a[b]=c` into an object and `?a=1&a=2` into an array, so `req.query.x as string`
 * is not safe: an object dropped into a Prisma `where` becomes a filter operator. These helpers only
 * accept plain strings.
 */

export function queryString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export function queryInt(value: unknown): number | undefined {
  const s = queryString(value);
  if (s === undefined) return undefined;
  const n = Number.parseInt(s, 10);
  return Number.isSafeInteger(n) ? n : undefined;
}

// The CSV exports ask for every matching row in one request, so the cap has to allow for that.
export const MAX_TAKE = 100_000;

export function pagination(query: Record<string, unknown>, defaultTake = 100, maxTake = MAX_TAKE) {
  const skip = Math.max(0, queryInt(query.skip) ?? 0);
  const take = Math.min(maxTake, Math.max(1, queryInt(query.take) || defaultTake));
  return { skip, take };
}
