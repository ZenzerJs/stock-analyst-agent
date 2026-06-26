import { useCallback, useEffect, useState } from 'react';
import { fetchFundamentals, fetchAndCacheFundamentals } from '../api';
import {
  getSessionFundamentals,
  setSessionFundamentals,
} from '../utils/fundamentalsSession';

export function useFundamentals(ticker) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  const [fetchMessage, setFetchMessage] = useState(null);

  const applyPayload = useCallback((payload) => {
    setData(payload);
    if (payload?.has_data) {
      setSessionFundamentals(ticker, payload);
    }
  }, [ticker]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setFetchMessage(null);

      const cached = getSessionFundamentals(ticker);
      if (cached?.has_data) {
        if (!cancelled) {
          setData(cached);
          setLoading(false);
        }
        return;
      }

      try {
        const payload = await fetchFundamentals(ticker);
        if (!cancelled) {
          applyPayload(payload);
        }
      } catch {
        if (!cancelled) {
          setData(null);
          setError('Could not load fundamentals');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [ticker, applyPayload]);

  const fetchAndCache = useCallback(async () => {
    setFetching(true);
    setError(null);
    setFetchMessage(null);
    try {
      const result = await fetchAndCacheFundamentals(ticker);
      const payload = result.fundamentals;
      if (!payload?.has_data) {
        setError(result.detail || result.message || 'No quarterly data for this symbol');
        return false;
      }
      applyPayload(payload);
      setFetchMessage(
        result.status === 'already_cached'
          ? `Loaded ${payload.quarter_count} quarters from cache`
          : `Fetched and cached ${payload.quarter_count} quarters (saved in browser for 7 days)`,
      );
      return true;
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 429) {
        setError('Too many fetch requests — wait a minute and try again.');
      } else if (status === 404) {
        setError(typeof detail === 'string' ? detail : 'No quarterly data for this symbol');
      } else if (err?.code === 'ECONNABORTED') {
        setError('Fetch timed out — try again (first load can take up to a minute).');
      } else {
        setError(typeof detail === 'string' ? detail : 'Could not fetch fundamentals');
      }
      return false;
    } finally {
      setFetching(false);
    }
  }, [ticker, applyPayload]);

  return {
    data,
    loading,
    fetching,
    error,
    fetchMessage,
    fetchAndCache,
    hasSessionCache: Boolean(getSessionFundamentals(ticker)?.has_data),
  };
};
