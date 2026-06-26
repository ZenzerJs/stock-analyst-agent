import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

let keyProvider = () => ({ groq: '', finnhub: '' });

export function setApiKeyProvider(fn) {
  keyProvider = fn;
}

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
  const response = await api.get('/health');
  return response.data;
};

export const fetchDashboard = async (ticker, period = '6mo') => {
  const response = await api.get(`/dashboard/${ticker}`, { params: { period } });
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
