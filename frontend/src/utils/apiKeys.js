const STORAGE_KEY = 'stock-analyst-api-keys-v1';

export function loadApiKeys() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { groqApiKey: '', finnhubApiKey: '' };
    const parsed = JSON.parse(raw);
    return {
      groqApiKey: parsed.groqApiKey || '',
      finnhubApiKey: parsed.finnhubApiKey || '',
    };
  } catch {
    return { groqApiKey: '', finnhubApiKey: '' };
  }
}

export function saveApiKeys({ groqApiKey, finnhubApiKey }) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ groqApiKey: groqApiKey.trim(), finnhubApiKey: finnhubApiKey.trim() }),
  );
}

export function clearApiKeys() {
  localStorage.removeItem(STORAGE_KEY);
}

export function maskKey(key) {
  if (!key || key.length < 8) return key ? '••••••••' : '';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}
