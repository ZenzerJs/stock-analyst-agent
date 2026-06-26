import React from 'react';
import { TrendingUp, FileText, Calendar, Target } from 'lucide-react';
import { formatEps, formatQuarter } from '../utils/formatters';

const formatDate = (value) => {
  if (!value) return null;
  const d = new Date(`${value}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export const EpsMetrics = ({ eps, loading, compact = false }) => {
  if (loading) {
    return (
      <div className={`eps-metrics glass-panel ${compact ? 'eps-metrics--compact' : ''}`}>
        <p className="dashboard-label">Earnings per share</p>
        <p className="volume-flow-empty">Loading EPS…</p>
      </div>
    );
  }

  const items = [
    {
      key: 'trailing',
      icon: TrendingUp,
      label: 'Trailing EPS',
      value: eps?.trailing_eps,
      sub: 'Last 12 months',
      accent: 'cyan',
    },
    {
      key: 'forward',
      icon: Target,
      label: 'Forward EPS',
      value: eps?.forward_eps,
      sub: 'Analyst consensus',
      accent: 'gold',
    },
    {
      key: 'reported',
      icon: FileText,
      label: 'Last reported',
      value: eps?.reported_eps,
      sub: eps?.reported_eps_quarter
        ? `Q ended ${formatQuarter(eps.reported_eps_quarter)}`
        : 'From quarterly filings',
      accent: 'up',
    },
    {
      key: 'estimate',
      icon: Calendar,
      label: 'Next estimate',
      value: eps?.eps_estimate,
      sub: eps?.earnings_date ? `Earnings ${formatDate(eps.earnings_date)}` : 'Upcoming report',
      accent: 'down',
    },
  ];

  const hasAny = items.some((i) => i.value != null);
  if (!hasAny) {
    return (
      <div className={`eps-metrics glass-panel ${compact ? 'eps-metrics--compact' : ''}`}>
        <p className="dashboard-label">Earnings per share</p>
        <p className="volume-flow-empty">EPS data unavailable for this symbol</p>
      </div>
    );
  }

  return (
    <div className={`eps-metrics glass-panel panel-accent-gold ${compact ? 'eps-metrics--compact' : ''}`}>
      <div className="eps-metrics-header">
        <h3>Earnings per share (EPS)</h3>
        <p className="eps-metrics-sub">Trailing, reported quarterly, and forward estimates</p>
      </div>
      <div className={`eps-metrics-grid ${compact ? 'eps-metrics-grid--compact' : ''}`}>
        {items.map(({ key, icon: Icon, label, value, sub, accent }) => (
          <div key={key} className={`eps-metric eps-metric--${accent}`}>
            <div className="eps-metric-top">
              <Icon size={15} aria-hidden="true" />
              <span className="eps-metric-label">{label}</span>
            </div>
            <span className="eps-metric-value">{formatEps(value)}</span>
            <span className="eps-metric-sub">{sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
