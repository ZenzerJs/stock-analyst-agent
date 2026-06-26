import { useEffect, useState } from 'react';
import { fetchDashboard } from '../api';
import { getCachedDashboard, setCachedDashboard } from '../utils/marketDataCache';

export function useMarketData(ticker, period) {
  const [data, setData] = useState(() => getCachedDashboard(ticker, period));
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const cached = getCachedDashboard(ticker, period);
    if (cached) {
      setData(cached);
      setLoading(false);
      setError(null);
      return undefined;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const snapshot = await fetchDashboard(ticker, period);
        if (!cancelled) {
          setCachedDashboard(ticker, period, snapshot);
          setData(snapshot);
        }
      } catch {
        if (!cancelled) {
          setData(null);
          setError('Could not load market data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [ticker, period]);

  return { data, loading, error };
}
