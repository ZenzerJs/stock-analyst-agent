const STORAGE_KEY = 'stock-analyst-fundamentals-session';

function readMap() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeMap(map) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* session storage full or unavailable */
  }
}

export function getSessionFundamentals(ticker) {
  if (!ticker) return null;
  const map = readMap();
  return map[ticker.trim().toUpperCase()] ?? null;
}

export function setSessionFundamentals(ticker, payload) {
  if (!ticker || !payload?.has_data) return;
  const sym = ticker.trim().toUpperCase();
  const map = readMap();
  map[sym] = payload;
  writeMap(map);
}

export function clearSessionFundamentals(ticker) {
  if (!ticker) return;
  const sym = ticker.trim().toUpperCase();
  const map = readMap();
  delete map[sym];
  writeMap(map);
}
