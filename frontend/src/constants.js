/** Cached tickers with fundamentals in SQLite (see ingest_financials.py to add more). */
export const FEATURED_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'GOOGL'];

export const SUGGESTED_PROMPTS = [
  "What's NVDA's current price and analyst consensus?",
  'Summarize AAPL fundamentals over 8 quarters',
  'When does MSFT report earnings next?',
];

const TICKER_STOP = new Set([
  'I', 'A', 'AI', 'EPS', 'SEC', 'API', 'USD', 'ETF', 'CEO', 'CFO',
  'AND', 'OR', 'THE', 'FOR', 'NOT', 'YOU', 'ARE', 'WAS', 'HAS', 'HAD',
  'CAN', 'MAY', 'ITS', 'OUR', 'YOUR', 'WHAT', 'WHEN', 'NEXT', 'OVER',
  'PRICE', 'CURRENT', 'ANALYST', 'CONSENSUS', 'SUMMARIZE', 'REPORT',
  'EARNINGS', 'DOES', 'HOW', 'ABOUT', 'WITH', 'FROM', 'THAT', 'THIS',
]);

/** Detect likely ticker symbols in chat text. */
export function detectTickerInText(text) {
  if (!text?.trim()) return null;
  const upper = text.toUpperCase();

  for (const ticker of FEATURED_TICKERS) {
    const re = new RegExp(`\\b${ticker.replace('.', '\\.')}\\b`);
    if (re.test(upper)) return ticker;
  }

  const possessive = upper.match(/\b([A-Z][A-Z0-9.-]{0,5})'S\b/);
  if (possessive?.[1] && !TICKER_STOP.has(possessive[1])) {
    return possessive[1];
  }

  const matches = upper.match(/\b[A-Z][A-Z0-9.-]{0,5}\b/g);
  if (!matches) return null;
  const candidate = [...matches].reverse().find(
    (m) => !TICKER_STOP.has(m) && m.length >= 2 && m.length <= 5,
  );
  return candidate || null;
}
