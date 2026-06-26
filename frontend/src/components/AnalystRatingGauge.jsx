import React, { useId } from 'react';
import { ExternalLink, Target } from 'lucide-react';
import { ANALYST_TIERS, gaugeNeedleAngle, gaugeNeedleColor, ratingColor } from '../utils/analystGauge';

const formatPrice = (value) =>
  value != null ? `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null;

const formatFirmDate = (value) => {
  if (!value) return '';
  const d = new Date(`${value}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export const AnalystRatingGauge = ({ sentiment, loading, compact = false, ticker }) => {
  const gradientId = useId().replace(/:/g, '');

  if (loading) {
    return (
      <div className={`analyst-gauge glass-panel ${compact ? 'analyst-gauge--compact' : ''}`}>
        <p className="dashboard-label">Analyst ratings</p>
        <p className="volume-flow-empty">Loading analyst consensus…</p>
      </div>
    );
  }

  const total = sentiment?.total_analysts ?? 0;
  const hasData = total > 0 && sentiment?.score_pct != null;
  const recentRatings = sentiment?.recent_ratings ?? [];
  const analysisUrl = sentiment?.analysis_url
    || (ticker ? `https://finance.yahoo.com/quote/${ticker.trim().toUpperCase()}/analysis` : null);

  if (!hasData) {
    return (
      <div className={`analyst-gauge glass-panel ${compact ? 'analyst-gauge--compact' : ''}`}>
        <div className="analyst-gauge-header">
          <Target size={18} aria-hidden="true" />
          <div>
            <h3 className="analyst-gauge-title">Analyst ratings</h3>
            <p className="analyst-gauge-sub">No analyst breakdown available for this symbol</p>
          </div>
        </div>
      </div>
    );
  }

  const angle = gaugeNeedleAngle(sentiment.score_pct);
  const needleColor = gaugeNeedleColor(sentiment.score_pct);
  const sufficient = sentiment.sufficient_sample !== false && total >= 10;
  const target = formatPrice(sentiment.target_mean);

  return (
    <div className={`analyst-gauge glass-panel panel-accent-cyan ${compact ? 'analyst-gauge--compact analyst-gauge--desk' : ''}`}>
      <div className="analyst-gauge-fixed">
        <div className="analyst-gauge-header">
          <Target size={18} aria-hidden="true" />
          <div>
            <h3 className="analyst-gauge-title">Analyst ratings</h3>
            <p className="analyst-gauge-sub">
              {total} analyst{total === 1 ? '' : 's'}
              {sentiment.period ? ` · ${sentiment.period}` : ''}
              {target ? ` · target ${target}` : ''}
            </p>
          </div>
          <div className="analyst-gauge-verdict" style={{ color: needleColor }}>
            {sentiment.rating}
          </div>
        </div>

        {!sufficient && (
          <p className="analyst-gauge-warning">Fewer than 10 ratings — treat as directional only.</p>
        )}

        <div
          className="analyst-gauge-dial-wrap"
          role="img"
          aria-label={`Analyst consensus ${sentiment.rating}, ${total} ratings`}
        >
          <svg viewBox="0 0 220 130" className="analyst-gauge-svg" aria-hidden="true">
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#991b1b" />
                <stop offset="25%" stopColor="#ef4444" />
                <stop offset="50%" stopColor="#ca8a04" />
                <stop offset="75%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
            </defs>

            <path
              d="M 24 108 A 86 86 0 0 1 196 108"
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth="14"
              strokeLinecap="round"
            />

            {ANALYST_TIERS.map((tier, index) => {
              const pct = index / (ANALYST_TIERS.length - 1);
              const tickAngle = (-180 + pct * 180) * (Math.PI / 180);
              const cx = 110;
              const cy = 108;
              const x1 = cx + Math.cos(tickAngle) * 72;
              const y1 = cy + Math.sin(tickAngle) * 72;
              const x2 = cx + Math.cos(tickAngle) * 84;
              const y2 = cy + Math.sin(tickAngle) * 84;
              return (
                <line
                  key={tier.key}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth="1.5"
                />
              );
            })}

            <g transform={`translate(110 108) rotate(${angle})`}>
              <polygon points="0,-78 5,0 -5,0" fill={needleColor} />
              <circle r="6" fill={needleColor} />
              <circle r="3" fill="#0a0f14" />
            </g>
          </svg>

          <div className="analyst-gauge-tier-labels">
            {ANALYST_TIERS.map((tier) => (
              <span key={tier.key} className="analyst-gauge-tier-label" style={{ color: tier.color }}>
                {compact ? tier.short : tier.label}
              </span>
            ))}
          </div>
        </div>

        <div className="analyst-gauge-breakdown" role="list" aria-label="Analyst rating breakdown">
          {ANALYST_TIERS.map((tier) => {
            const count = sentiment[tier.key] ?? 0;
            const pct = total ? Math.round((count / total) * 100) : 0;
            return (
              <div key={tier.key} className="analyst-gauge-row" role="listitem">
                <span className="analyst-gauge-row-label" style={{ color: tier.color }}>
                  {tier.label}
                </span>
                <div className="analyst-gauge-row-bar" aria-hidden="true">
                  <div
                    className="analyst-gauge-row-fill"
                    style={{ width: `${pct}%`, backgroundColor: tier.color }}
                  />
                </div>
                <span className="analyst-gauge-row-count">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {recentRatings.length > 0 && (
        <div className="analyst-gauge-firms">
          <div className="analyst-gauge-firms-head">
            <h4 className="analyst-gauge-firms-title">Leading firm ratings</h4>
            {analysisUrl && (
              <a
                href={analysisUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="analyst-gauge-firms-all"
              >
                All ratings
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            )}
          </div>
          <div className="analyst-gauge-firms-scroll" tabIndex={0}>
            {recentRatings.map((item) => (
              <a
                key={`${item.firm}-${item.date}`}
                href={item.url || analysisUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="analyst-gauge-firm-row"
              >
                <div className="analyst-gauge-firm-main">
                  <span className="analyst-gauge-firm-name">{item.firm}</span>
                  <span className="analyst-gauge-firm-rating" style={{ color: ratingColor(item.rating) }}>
                    {item.rating}
                  </span>
                </div>
                <p className="analyst-gauge-firm-summary">{item.summary}</p>
                <span className="analyst-gauge-firm-date">{formatFirmDate(item.date)}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
