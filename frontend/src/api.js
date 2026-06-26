import axios from 'axios';

function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL?.trim();
  const isBrowser = typeof window !== 'undefined';

  if (isBrowser) {
    const { hostname } = window.location;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';

    // Vercel serves the API via same-origin /api rewrite — avoids CORS to Render.
    if (!isLocal && (hostname.endsWith('.vercel.app') || configured?.includes('onrender.com'))) {
      return '/api';
    }
  }

  return configured || '/api';
}

const API_URL = resolveApiBaseUrl();
const REQUEST_TIMEOUT_MS = 90000;

let keyProvider = () => ({ groq: '', finnhub: '' });

export function setApiKeyProvider(fn) {
  keyProvider = fn;
}

export const api = axios.create({
  baseURL: API_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

async function withRetry(request, { attempts = 4, delayMs = 8000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await request();
    } catch (err) {
      lastError = err;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => { setTimeout(resolve, delayMs); });
      }
    }
  }
  throw lastError;
}

api.interceptors.request.use((config) => {
  const { groq, finnhub } = keyProvider();
  if (groq) config.headers['X-Groq-Api-Key'] = groq;
  if (finnhub) config.headers['X-Finnhub-Api-Key'] = finnhub;
  return config;
});

export const sendChatMessage = async (message, history = []) => {
  const response = await api.post('/chat', { message, history });
  return response.data;
};

export const checkHealth = async () => {
  const response = await withRetry(() => api.get('/health'));
  return response.data;
};

export const fetchDashboard = async (ticker, period = '6mo') => {
  const response = await withRetry(() => api.get(`/dashboard/${ticker}`, { params: { period } }));
  return response.data;
};

export const fetchPriceHistory = async (ticker, period = '6mo') => {
  const response = await api.get(`/history/${ticker}`, { params: { period } });
  return response.data;
};

export const fetchCachedTickers = async () => {
  const response = await api.get('/tickers');
  return response.data;
};

export const searchTickers = async (q = '') => {
  const response = await api.get('/tickers/search', { params: { q } });
  return response.data;
};

export const fetchTickerTape = async () => {
  const response = await api.get('/tickers/tape');
  return response.data;
};

export const fetchFundamentals = async (ticker) => {
  const response = await api.get(`/fundamentals/${ticker}`);
  return response.data;
};

export const fetchAndCacheFundamentals = async (ticker) => {
  const response = await api.post(`/fundamentals/${ticker}/fetch`);
  return response.data;
};
