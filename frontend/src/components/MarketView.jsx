import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Calendar, Target,
  BarChart3, ArrowUpRight, ArrowDownRight, Database,
} from 'lucide-react';
import { useMarketData } from '../hooks/useMarketData';
import { PriceChart } from './PriceChart';
import { TrustedSources } from './TrustedSources';
import { TickerSearch } from './TickerSearch';
import { fetchCachedTickers } from '../api';
import { VolumeFlow } from './VolumeFlow';
import { EpsMetrics } from './EpsMetrics';
import { QuarterlyFundamentals } from './QuarterlyFundamentals';
import { FEATURED_TICKERS } from '../constants';

const formatPrice = (value) =>
  value != null ? `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export const MarketView = ({ ticker, onTickerChange, hasFinnhubKey }) => {
  const [period, setPeriod] = useState('6mo');
  const [cachedTickers, setCachedTickers] = useState([]);
  const { data, loading, error } = useMarketData(ticker, period);

  useEffect(() => {
    fetchCachedTickers()
      .then((res) => setCachedTickers(res.tickers || []))
      .catch(() => setCachedTickers([]));
  }, []);

  const refreshCachedTickers = () => {
    fetchCachedTickers()
      .then((res) => setCachedTickers(res.tickers || []))
      .catch(() => {});
  };

  const quote = data?.quote;
  const sentiment = data?.sentiment;
  const earnings = data?.earnings;
  const history = data?.history;
  const sources = data?.sources;
  const volumeFlow = data?.volume_flow;
  const eps = data?.eps;
  const isPositive = quote?.change_pct != null ? quote.change_pct >= 0 : true;
  const points = history?.points ?? [];
  const periodHigh = points.length ? Math.max(...points.map((p) => p.close)) : null;
  const periodLow = points.length ? Math.min(...points.map((p) => p.close)) : null;
  const hasFundamentals = cachedTickers.some((t) => t.ticker === ticker);
  const companyName = cachedTickers.find((t) => t.ticker === ticker)?.name
    || data?.company_name;

  return (
    <div className="market-view">
      <div className="market-hero glass-panel panel-glow">
        <div className="market-hero-top">
          <div className="market-hero-left">
            <p className="dashboard-label">Market terminal</p>
            <div className="market-search-row">
              <TickerSearch value={ticker} onSelect={onTickerChange} />
            </div>
            <div className="market-hero-ticker-row">
              <div className="market-hero-ticker-block">
                <h2 className="dashboard-ticker market-hero-ticker">{ticker}</h2>
                {companyName && (
                  <p className="market-hero-company">{companyName}</p>
                )}
              </div>
              {hasFundamentals && (
                <span className="fundamentals-pill">
                  <Database size={12} /> 8Q fundamentals
                </span>
              )}
              {!loading && quote?.price != null && (
                <div className="market-hero-price-block">
                  <span className="market-hero-price">{formatPrice(quote.price)}</span>
                  {quote.change_pct != null && (
                    <span className={`change-badge ${isPositive ? 'change-badge--up' : 'change-badge--down'}`}>
                      {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {isPositive ? '+' : ''}{quote.change_pct.toFixed(2)}% today
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {cachedTickers.length > 0 && (
          <div className="quick-ticker-section">
            <p className="quick-ticker-label">Cached in database</p>
            <div className="ticker-switcher">
              {cachedTickers.map((t) => (
                <button
                  key={t.ticker}
                  type="button"
                  className={`ticker-chip ${t.ticker === ticker ? 'ticker-chip--active' : ''}`}
                  onClick={() => onTickerChange(t.ticker)}
                  title={t.name || t.ticker}
                >
                  {t.ticker}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="quick-ticker-section">
          <p className="quick-ticker-label">Popular</p>
          <div className="ticker-switcher">
            {FEATURED_TICKERS.map((t) => (
              <button
                key={t}
                type="button"
                className={`ticker-chip ticker-chip--ghost ${t === ticker ? 'ticker-chip--active' : ''}`}
                onClick={() => onTickerChange(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <PriceChart
          history={history}
          loading={loading}
          period={period}
          onPeriodChange={setPeriod}
          variant="large"
        />
      </div>

      <div className="market-grid">
        <div className="glass-panel market-stat-panel panel-accent-cyan">
          <div className="market-stat-panel-header">
            <BarChart3 size={18} />
            <h3>Key metrics</h3>
          </div>
          <div className="market-metrics-grid">
            <div className="market-metric market-metric--cyan">
              <span className="market-metric-label"><DollarSign size={14} /> Latest</span>
              <span className="market-metric-value">{loading ? '…' : formatPrice(quote?.price)}</span>
            </div>
            <div className="market-metric market-metric--up">
              <span className="market-metric-label"><TrendingUp size={14} /> Period high</span>
              <span className="market-metric-value market-metric-value--up">{loading ? '…' : formatPrice(periodHigh)}</span>
            </div>
            <div className="market-metric market-metric--down">
              <span className="market-metric-label"><TrendingDown size={14} /> Period low</span>
              <span className="market-metric-value market-metric-value--down">{loading ? '…' : formatPrice(periodLow)}</span>
            </div>
            <div className="market-metric">
              <span className="market-metric-label"><Target size={14} /> Consensus</span>
              <span className="market-metric-value">{loading ? '…' : (sentiment?.rating || '—')}</span>
            </div>
            <div className="market-metric">
              <span className="market-metric-label"><Target size={14} /> Price target</span>
              <span className="market-metric-value">{loading ? '…' : formatPrice(sentiment?.target_mean)}</span>
            </div>
            <div className="market-metric market-metric--gold">
              <span className="market-metric-label"><Calendar size={14} /> Next earnings</span>
              <span className="market-metric-value market-metric-value--sm">{loading ? '…' : formatDate(earnings?.date)}</span>
            </div>
          </div>
          {!hasFinnhubKey && (
            <p className="finnhub-hint">Add Finnhub key for live quote cards. Charts still load via yfinance.</p>
          )}
          {error && <p className="stat-card-sub stat-card-sub--error">{error}</p>}
        </div>

        <div className="glass-panel market-sources-panel panel-accent-gold">
          <TrustedSources sources={sources} />
        </div>
      </div>

      <div className="market-analytics-row">
        <VolumeFlow volumeFlow={volumeFlow} period={period} loading={loading} />
        <EpsMetrics eps={eps} loading={loading} />
      </div>

      <QuarterlyFundamentals ticker={ticker} onCached={refreshCachedTickers} />
    </div>
  );
};
