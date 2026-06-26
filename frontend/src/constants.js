/** Cached tickers with fundamentals in SQLite (see ingest_financials.py to add more). */
export const FEATURED_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'GOOGL'];

export const SUGGESTED_PROMPTS = [
  "What's NVDA's current price and analyst consensus?",
  'Summarize AAPL fundamentals over 8 quarters',
  'When does MSFT report earnings next?',
];

/** Detect likely ticker symbols in chat text (1–6 alphanumeric). */
export function detectTickerInText(text) {
  const matches = text.toUpperCase().match(/\b[A-Z][A-Z0-9.-]{0,5}\b/g);
  if (!matches) return null;
  const stop = new Set(['I', 'A', 'AI', 'EPS', 'SEC', 'API', 'USD', 'ETF', 'CEO', 'CFO']);
  const candidate = [...matches].reverse().find((m) => !stop.has(m) && m.length >= 1);
  return candidate || null;
}
