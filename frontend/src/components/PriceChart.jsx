import React, { useId, useMemo, useState } from 'react';

const PERIODS = [
  { key: '1mo', label: '1M' },
  { key: '3mo', label: '3M' },
  { key: '6mo', label: '6M' },
  { key: '1y', label: '1Y' },
];

const SIZES = {
  compact: { width: 360, height: 168, pad: { top: 16, right: 12, bottom: 22, left: 44 }, showVolume: false },
  large: { width: 720, height: 320, pad: { top: 24, right: 16, bottom: 32, left: 56 }, showVolume: true },
};

function nicePriceStep(range) {
  const rough = range / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  if (normalized < 1.5) return magnitude;
  if (normalized < 3) return 2 * magnitude;
  if (normalized < 7) return 5 * magnitude;
  return 10 * magnitude;
}

function formatAxisPrice(value) {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  if (value >= 100) return `$${value.toFixed(0)}`;
  return `$${value.toFixed(2)}`;
}

function formatAxisDate(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatVol(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function computeLayout(points, size) {
  const { width, height, pad, showVolume } = size;
  const volumeHeight = showVolume ? Math.round(height * 0.22) : 0;
  const priceHeight = height - volumeHeight - pad.top - pad.bottom;
  const innerW = width - pad.left - pad.right;

  const closes = points.map((p) => p.close);
  const minClose = Math.min(...closes);
  const maxClose = Math.max(...closes);
  const step = nicePriceStep(maxClose - minClose || maxClose * 0.02);
  const yMin = Math.floor(minClose / step) * step;
  const yMax = Math.ceil(maxClose / step) * step;
  const yRange = yMax - yMin || step;

  const yTicks = [];
  for (let v = yMin; v <= yMax + step * 0.01; v += step) {
    yTicks.push(v);
  }

  const coords = points.map((point, index) => {
    const x = pad.left + (index / Math.max(points.length - 1, 1)) * innerW;
    const y = pad.top + priceHeight - ((point.close - yMin) / yRange) * priceHeight;
    return { ...point, x, y };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const baseY = pad.top + priceHeight;
  const areaPath = coords.length
    ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${baseY} L ${coords[0].x.toFixed(1)} ${baseY} Z`
    : '';

  const volumes = points.map((p) => p.volume || 0);
  const maxVolume = Math.max(...volumes, 1);
  const volumeBars = showVolume
    ? coords.map((c, index) => {
        const totalVol = volumes[index] || 0;
        const buyVol = points[index].buy_volume ?? Math.round(totalVol / 2);
        const sellVol = points[index].sell_volume ?? totalVol - buyVol;
        const barH = (totalVol / maxVolume) * (volumeHeight - 8);
        const buyH = totalVol ? (buyVol / totalVol) * barH : barH / 2;
        const sellH = barH - buyH;
        const barW = Math.max(innerW / points.length - 1, 1.5);
        const x = c.x - barW / 2;
        const sellY = pad.top + priceHeight + 8 + (volumeHeight - 8 - barH);
        const buyY = sellY + sellH;
        return {
          x,
          sellY,
          buyY,
          barW,
          buyH,
          sellH,
          volume: totalVol,
          buyVol,
          sellVol,
          date: c.date,
        };
      })
    : [];

  const xLabelIndices = [
    0,
    Math.floor((points.length - 1) / 2),
    points.length - 1,
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  return {
    width,
    height,
    pad,
    priceHeight,
    volumeHeight,
    innerW,
    yTicks,
    yMin,
    yMax,
    yRange,
    coords,
    linePath,
    areaPath,
    volumeBars,
    xLabelIndices,
    baseY,
  };
}

export const PriceChart = ({ history, loading, period, onPeriodChange, variant = 'compact' }) => {
  const gradientId = useId();
  const glowId = useId();
  const [hoverIndex, setHoverIndex] = useState(null);
  const size = SIZES[variant] || SIZES.compact;
  const points = history?.points ?? [];

  const layout = useMemo(() => {
    if (!points.length) return null;
    return computeLayout(points, size);
  }, [points, size]);

  const changePct = history?.change_pct;
  const isUp = changePct == null || changePct >= 0;
  const stroke = isUp ? 'var(--success)' : 'var(--danger)';
  const hoverPoint = hoverIndex != null ? layout?.coords[hoverIndex] : null;

  const handleMove = (event) => {
    if (!layout?.coords.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    const index = Math.round(ratio * (layout.coords.length - 1));
    setHoverIndex(index);
  };

  const canvasClass = variant === 'large' ? 'price-chart-canvas price-chart-canvas--large' : 'price-chart-canvas';

  return (
    <div className={`price-chart price-chart--${variant}`}>
      <div className="price-chart-header">
        <div>
          <p className="dashboard-label">Price trend</p>
          {!loading && changePct != null && (
            <p className={`price-chart-change ${isUp ? 'change-badge--up' : 'change-badge--down'}`}>
              {isUp ? '+' : ''}{changePct.toFixed(2)}% over {period}
            </p>
          )}
        </div>
        <div className="period-toggle" role="group" aria-label="Chart time range">
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`period-btn ${period === key ? 'period-btn--active' : ''}`}
              onClick={() => onPeriodChange(key)}
              disabled={loading}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={canvasClass}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {loading ? (
          <p className="price-chart-empty">Loading chart…</p>
        ) : !layout ? (
          <p className="price-chart-empty">No price history available</p>
        ) : (
          <svg
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`Price chart, ${changePct ?? 0}% change over ${period}`}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isUp ? 'rgba(61,153,112,0.4)' : 'rgba(199,75,80,0.4)'} />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </linearGradient>
              <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {layout.yTicks.map((tick) => {
              const y = layout.pad.top + layout.priceHeight - ((tick - layout.yMin) / layout.yRange) * layout.priceHeight;
              return (
                <g key={tick}>
                  <line
                    x1={layout.pad.left}
                    y1={y}
                    x2={layout.width - layout.pad.right}
                    y2={y}
                    className="chart-grid-line"
                  />
                  <text x={layout.pad.left - 6} y={y + 3} className="chart-axis-label chart-axis-label--y" textAnchor="end">
                    {formatAxisPrice(tick)}
                  </text>
                </g>
              );
            })}

            {layout.volumeBars.map((bar, i) => (
              <g key={`vol-${i}`}>
                <rect
                  x={bar.x}
                  y={bar.sellY}
                  width={bar.barW}
                  height={Math.max(bar.sellH, 0)}
                  className="chart-volume-bar chart-volume-bar--sell"
                  opacity={hoverIndex === i ? 0.95 : 0.55}
                />
                <rect
                  x={bar.x}
                  y={bar.buyY}
                  width={bar.barW}
                  height={Math.max(bar.buyH, 0)}
                  className="chart-volume-bar chart-volume-bar--buy"
                  opacity={hoverIndex === i ? 0.95 : 0.55}
                />
              </g>
            ))}

            <path d={layout.areaPath} fill={`url(#${gradientId})`} />
            <path
              d={layout.linePath}
              fill="none"
              stroke={stroke}
              strokeWidth={variant === 'large' ? 2.5 : 2}
              filter={`url(#${glowId})`}
            />

            {hoverPoint && (
              <>
                <line
                  x1={hoverPoint.x}
                  y1={layout.pad.top}
                  x2={hoverPoint.x}
                  y2={layout.baseY}
                  className="chart-crosshair"
                />
                <circle cx={hoverPoint.x} cy={hoverPoint.y} r={5} fill={stroke} stroke="#0c1118" strokeWidth="2" />
              </>
            )}

            {layout.xLabelIndices.map((index) => {
              const point = layout.coords[index];
              if (!point) return null;
              return (
                <text
                  key={index}
                  x={point.x}
                  y={layout.height - 8}
                  className="chart-axis-label chart-axis-label--x"
                  textAnchor="middle"
                >
                  {formatAxisDate(point.date)}
                </text>
              );
            })}
          </svg>
        )}
      </div>

      {variant === 'large' && layout && (
        <div className="price-chart-volume-legend" aria-hidden="true">
          <span className="price-chart-legend-item price-chart-legend-item--buy">Buy volume</span>
          <span className="price-chart-legend-item price-chart-legend-item--sell">Sell volume</span>
        </div>
      )}

      {hoverPoint && (
        <div className="price-chart-tooltip" aria-live="polite">
          <span className="price-chart-tooltip-date">{formatAxisDate(hoverPoint.date)}</span>
          <strong>${hoverPoint.close.toFixed(2)}</strong>
          {hoverPoint.volume != null && (
            <span className="price-chart-tooltip-vol">
              Vol {formatVol(hoverPoint.volume)}
              {hoverPoint.buy_volume != null && (
                <> · <span className="vol-buy">Buy {formatVol(hoverPoint.buy_volume)}</span></>
              )}
              {hoverPoint.sell_volume != null && (
                <> · <span className="vol-sell">Sell {formatVol(hoverPoint.sell_volume)}</span></>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
