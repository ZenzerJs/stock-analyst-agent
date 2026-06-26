import React from 'react';
import { ArrowDownCircle, ArrowUpCircle, BarChart2 } from 'lucide-react';
import { formatVolume } from '../utils/formatters';

export const VolumeFlow = ({ volumeFlow, period, loading, compact = false }) => {
  if (loading) {
    return (
      <div className={`volume-flow glass-panel ${compact ? 'volume-flow--compact' : ''}`}>
        <p className="dashboard-label">Order flow volume</p>
        <p className="volume-flow-empty">Loading volume data…</p>
      </div>
    );
  }

  if (!volumeFlow?.period_buy_volume && !volumeFlow?.latest_volume) {
    return (
      <div className={`volume-flow glass-panel ${compact ? 'volume-flow--compact' : ''}`}>
        <p className="dashboard-label">Order flow volume</p>
        <p className="volume-flow-empty">No volume data for this range</p>
      </div>
    );
  }

  const buyPct = volumeFlow.buy_pct ?? 50;
  const sellPct = volumeFlow.sell_pct ?? 50;
  const latestBuy = volumeFlow.latest_buy_volume;
  const latestSell = volumeFlow.latest_sell_volume;

  return (
    <div className={`volume-flow glass-panel panel-accent-cyan ${compact ? 'volume-flow--compact' : ''}`}>
      <div className="volume-flow-header">
        <BarChart2 size={18} aria-hidden="true" />
        <div>
          <h3 className="volume-flow-title">Buy &amp; sell volume</h3>
          <p className="volume-flow-sub">
            Estimated from daily OHLC over {period}
            {volumeFlow.latest_date ? ` · latest ${volumeFlow.latest_date}` : ''}
          </p>
        </div>
      </div>

      <div className="volume-flow-bar-wrap">
        <div className="volume-flow-bar" role="img" aria-label={`Buy ${buyPct}% sell ${sellPct}%`}>
          <div className="volume-flow-bar-buy" style={{ width: `${buyPct}%` }} />
          <div className="volume-flow-bar-sell" style={{ width: `${sellPct}%` }} />
        </div>
        <div className="volume-flow-bar-labels">
          <span className="volume-flow-bar-label volume-flow-bar-label--buy">
            <ArrowUpCircle size={14} /> Buy {buyPct}%
          </span>
          <span className="volume-flow-bar-label volume-flow-bar-label--sell">
            Sell {sellPct}% <ArrowDownCircle size={14} />
          </span>
        </div>
      </div>

      <div className="volume-flow-grid">
        <div className="volume-flow-stat volume-flow-stat--buy">
          <span className="volume-flow-stat-label">Period buy vol</span>
          <span className="volume-flow-stat-value">{formatVolume(volumeFlow.period_buy_volume)}</span>
        </div>
        <div className="volume-flow-stat volume-flow-stat--sell">
          <span className="volume-flow-stat-label">Period sell vol</span>
          <span className="volume-flow-stat-value">{formatVolume(volumeFlow.period_sell_volume)}</span>
        </div>
        {!compact && latestBuy != null && (
          <>
            <div className="volume-flow-stat volume-flow-stat--buy">
              <span className="volume-flow-stat-label">Latest session buy</span>
              <span className="volume-flow-stat-value">{formatVolume(latestBuy)}</span>
            </div>
            <div className="volume-flow-stat volume-flow-stat--sell">
              <span className="volume-flow-stat-label">Latest session sell</span>
              <span className="volume-flow-stat-value">{formatVolume(latestSell)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
