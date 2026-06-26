export const STORAGE_KEY = 'stock-analyst-session-v1';
export const MAX_STORED_MESSAGES = 60;

export const WELCOME_MESSAGE = {
  role: 'assistant',
  content:
    'Ask about live quotes, analyst ratings, earnings, or 8-quarter fundamentals. ' +
    'Pick a prompt below or type your question — I can pull live market data and cached filings.',
  timestamp: Date.now(),
};

export const DEFAULT_TICKER = 'AAPL';

function trimForStorage(messages) {
  return messages.slice(-MAX_STORED_MESSAGES).map((message) => ({
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
    ticker: message.ticker,
    sources: message.sources,
    steps: message.steps?.map((step) => ({
      type: step.type,
      name: step.name,
      args: step.args,
      node: step.node,
      content: typeof step.content === 'string' ? step.content.slice(0, 400) : step.content,
    })),
  }));
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.messages?.length) return null;
    return {
      messages: parsed.messages,
      activeTicker: parsed.activeTicker || DEFAULT_TICKER,
    };
  } catch {
    return null;
  }
}

export function saveSession(messages, activeTicker) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        messages: trimForStorage(messages),
        activeTicker,
        updatedAt: Date.now(),
      }),
    );
  } catch {
    // Storage full or unavailable — fail silently
  }
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export const MAX_API_HISTORY = 20;
export const MAX_API_CONTENT = 4000;

export function toApiHistory(messages) {
  return messages
    .slice(-MAX_API_HISTORY)
    .map(({ role, content }) => ({
      role,
      content: typeof content === 'string' ? content.slice(0, MAX_API_CONTENT) : content,
    }));
}
