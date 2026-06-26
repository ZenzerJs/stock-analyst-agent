const STORAGE_KEY = 'stock-analyst-fundamentals-v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TICKERS = 12;

function readMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeMap(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* storage full or unavailable */
  }
}

function trimMap(map) {
  const entries = Object.entries(map)
    .sort(([, a], [, b]) => (b.cachedAt || 0) - (a.cachedAt || 0))
    .slice(0, MAX_TICKERS);
  return Object.fromEntries(entries);
}

export function getSessionFundamentals(ticker) {
  if (!ticker) return null;
  const sym = ticker.trim().toUpperCase();
  const entry = readMap()[sym];
  if (!entry?.payload) return null;
  if (entry.cachedAt && Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    clearSessionFundamentals(sym);
    return null;
  }
  return entry.payload;
}

export function setSessionFundamentals(ticker, payload) {
  if (!ticker || !payload?.has_data) return;
  const sym = ticker.trim().toUpperCase();
  const map = readMap();
  map[sym] = { payload, cachedAt: Date.now() };
  writeMap(trimMap(map));
}

export function clearSessionFundamentals(ticker) {
  if (!ticker) return;
  const sym = ticker.trim().toUpperCase();
  const map = readMap();
  delete map[sym];
  writeMap(map);
}
