import React, { useId, useMemo } from 'react';
import { formatLargeNumber, formatQuarter } from '../utils/formatters';

export const MetricBarChart = ({
  title,
  quarters = [],
  values = [],
  isEps = false,
  height = 140,
}) => {
  const gradientId = useId();
  const width = 320;
  const pad = { top: 12, right: 8, bottom: 28, left: 8 };
  const innerH = height - pad.top - pad.bottom;
  const innerW = width - pad.left - pad.right;

  const layout = useMemo(() => {
    const pairs = quarters
      .map((q, i) => ({ q, v: values[i] }))
      .filter((p) => p.v != null);
    if (!pairs.length) return null;

    const nums = pairs.map((p) => p.v);
    const maxVal = Math.max(...nums.map(Math.abs), isEps ? 1 : 1);
    const barW = Math.max(innerW / pairs.length - 6, 8);
    const zeroY = pad.top + innerH / 2;
    const hasNegative = nums.some((n) => n < 0);

    const bars = pairs.map((p, i) => {
      const x = pad.left + i * (innerW / pairs.length) + (innerW / pairs.length - barW) / 2;
      const ratio = Math.abs(p.v) / maxVal;
      const barH = ratio * (hasNegative ? innerH / 2 - 4 : innerH - 4);
      const y = p.v >= 0
        ? (hasNegative ? zeroY - barH : pad.top + innerH - barH)
        : zeroY;
      return { ...p, x, y, barW, barH, positive: p.v >= 0 };
    });

    const labelIndices = [0, Math.floor((pairs.length - 1) / 2), pairs.length - 1]
      .filter((v, i, arr) => arr.indexOf(v) === i);

    return { bars, labelIndices, hasNegative, zeroY, maxVal };
  }, [quarters, values, isEps, innerH, innerW, pad.left, pad.top]);

  if (!layout) {
    return (
      <div className="metric-bar-chart metric-bar-chart--empty">
        <p className="metric-bar-chart-title">{title}</p>
        <p className="volume-flow-empty">No data</p>
      </div>
    );
  }

  const latest = layout.bars[layout.bars.length - 1];

  return (
    <div className="metric-bar-chart">
      <div className="metric-bar-chart-header">
        <p className="metric-bar-chart-title">{title}</p>
        {latest && (
          <span className="metric-bar-chart-latest">
            {formatLargeNumber(latest.v, isEps)}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="metric-bar-chart-svg" role="img" aria-label={`${title} bar chart`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0.25" />
          </linearGradient>
        </defs>
        {layout.hasNegative && (
          <line
            x1={pad.left}
            y1={layout.zeroY}
            x2={width - pad.right}
            y2={layout.zeroY}
            className="chart-grid-line"
          />
        )}
        {layout.bars.map((bar) => (
          <rect
            key={bar.q}
            x={bar.x}
            y={bar.y}
            width={bar.barW}
            height={Math.max(bar.barH, 2)}
            rx={3}
            className={bar.positive ? 'metric-bar-chart-bar--up' : 'metric-bar-chart-bar--down'}
            fill={bar.positive ? `url(#${gradientId})` : undefined}
          />
        ))}
        {layout.labelIndices.map((i) => {
          const bar = layout.bars[i];
          if (!bar) return null;
          return (
            <text
              key={bar.q}
              x={bar.x + bar.barW / 2}
              y={height - 6}
              className="chart-axis-label chart-axis-label--x"
              textAnchor="middle"
            >
              {formatQuarter(bar.q)}
            </text>
          );
        })}
      </svg>
    </div>
  );
};
