const CACHE_TTL_MS = 60_000;
const cache = new Map();

export function getCachedDashboard(ticker, period) {
  const key = `${ticker}:${period}`;
  const entry = cache.get(key);
  if (!entry || Date.now() - entry.at > CACHE_TTL_MS) return null;
  return entry.data;
}

export function setCachedDashboard(ticker, period, data) {
  cache.set(`${ticker}:${period}`, { data, at: Date.now() });
}

export function invalidateDashboardCache(ticker) {
  for (const key of cache.keys()) {
    if (key.startsWith(`${ticker}:`)) cache.delete(key);
  }
}
