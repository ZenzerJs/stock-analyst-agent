import React, { useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Calendar, Target, Activity } from 'lucide-react';
import { useMarketData } from '../hooks/useMarketData';
import { PriceChart } from './PriceChart';
import { TrustedSources } from './TrustedSources';
import { VolumeFlow } from './VolumeFlow';
import { EpsMetrics } from './EpsMetrics';

const formatPrice = (value) =>
  value != null ? `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatHour = (hour) => {
  if (hour === 'bmo') return 'Before open';
  if (hour === 'amc') return 'After close';
  return hour || '';
};

export const Dashboard = ({ ticker, backendOnline, hasFinnhubKey, compact = false }) => {
  const [period, setPeriod] = useState('6mo');
  const { data, loading, error } = useMarketData(ticker, period);

  const quote = data?.quote;
  const sentiment = data?.sentiment;
  const earnings = data?.earnings;
  const history = data?.history;
  const sources = data?.sources;
  const volumeFlow = data?.volume_flow;
  const eps = data?.eps;
  const isPositive = quote?.change_pct != null ? quote.change_pct >= 0 : true;
  const changePct = quote?.change_pct;

  return (
    <div className="glass-panel dashboard">
      <div>
        <p className="dashboard-label">Active asset</p>
        <div className="dashboard-ticker-row">
          <div className="dashboard-ticker-block">
            <h2 className="dashboard-ticker">{ticker}</h2>
            {data?.company_name && (
              <p className="dashboard-company">{data.company_name}</p>
            )}
          </div>
          {quote?.change_pct != null && (
            <span className={`change-badge ${isPositive ? 'change-badge--up' : 'change-badge--down'}`}>
              {isPositive ? <TrendingUp size={14} aria-hidden="true" /> : <TrendingDown size={14} aria-hidden="true" />}
              {isPositive ? '+' : ''}{changePct.toFixed(2)}%
            </span>
          )}
        </div>
      </div>

      <PriceChart
        history={history}
        loading={loading}
        period={period}
        onPeriodChange={setPeriod}
        variant="compact"
      />

      {!hasFinnhubKey && (
        <p className="finnhub-hint">
          Add a Finnhub key in Settings for live quotes and ratings. Charts still load via yfinance.
        </p>
      )}

      <div className="stat-grid stat-grid--compact">
        <div className={`stat-card ${loading ? 'stat-card--loading' : ''}`}>
          <div className="stat-card-header">
            <DollarSign size={16} aria-hidden="true" />
            <span>Latest price</span>
          </div>
          <div className="stat-card-value stat-card-value--sm">
            {loading ? '…' : formatPrice(quote?.price)}
          </div>
        </div>

        <div className={`stat-card ${loading ? 'stat-card--loading' : ''}`}>
          <div className="stat-card-header">
            <Target size={16} aria-hidden="true" />
            <span>Consensus</span>
          </div>
          <div className="stat-card-value stat-card-value--sm stat-card-value--rating" style={{ color: 'var(--success)' }}>
            {loading ? '…' : (sentiment?.rating || '—')}
          </div>
          {!loading && sentiment?.target_mean != null && (
            <p className="stat-card-sub">Target {formatPrice(sentiment.target_mean)}</p>
          )}
        </div>

        <div className={`stat-card ${loading ? 'stat-card--loading' : ''}`}>
          <div className="stat-card-header">
            <Calendar size={16} aria-hidden="true" />
            <span>Next earnings</span>
          </div>
          <div className="stat-card-value stat-card-value--sm">
            {loading ? '…' : formatDate(earnings?.date)}
          </div>
          {!loading && earnings?.eps_estimate != null && (
            <p className="stat-card-sub">
              EPS ${Number(earnings.eps_estimate).toFixed(2)}
              {earnings.hour ? ` · ${formatHour(earnings.hour)}` : ''}
            </p>
          )}
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <Activity size={16} aria-hidden="true" />
            <span>Agent</span>
          </div>
          <div className="app-status">
            <span
              className={`status-dot ${backendOnline ? 'status-dot--online' : 'status-dot--offline'}`}
              aria-hidden="true"
            />
            <span>{backendOnline ? 'Online' : backendOnline === false ? 'Offline' : '…'}</span>
          </div>
          {error && <p className="stat-card-sub stat-card-sub--error">{error}</p>}
        </div>
      </div>

      {!compact && (
        <div className="desk-analytics-row">
          <VolumeFlow volumeFlow={volumeFlow} period={period} loading={loading} compact />
          <EpsMetrics eps={eps} loading={loading} compact />
        </div>
      )}

      {!compact && <TrustedSources sources={sources} />}
    </div>
  );
};
