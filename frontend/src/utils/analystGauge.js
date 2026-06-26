export const ANALYST_TIERS = [
  { key: 'strong_sell', label: 'Strong Sell', short: 'SS', color: '#991b1b' },
  { key: 'sell', label: 'Sell', short: 'S', color: '#ef4444' },
  { key: 'hold', label: 'Hold', short: 'H', color: '#ca8a04' },
  { key: 'buy', label: 'Buy', short: 'B', color: '#22c55e' },
  { key: 'strong_buy', label: 'Strong Buy', short: 'SB', color: '#047857' },
];

/** Interpolate deep red → deep green for gauge needle (0–100). */
export function gaugeNeedleColor(scorePct) {
  const t = Math.max(0, Math.min(100, scorePct)) / 100;
  const r = Math.round(185 - t * 168);
  const g = Math.round(28 + t * 192);
  const b = Math.round(28 + t * 72);
  return `rgb(${r}, ${g}, ${b})`;
}

export function gaugeNeedleAngle(scorePct) {
  return -90 + (Math.max(0, Math.min(100, scorePct)) / 100) * 180;
}

export function ratingColor(rating) {
  const label = (rating || '').toLowerCase();
  if (label.includes('strong buy')) return '#047857';
  if (label === 'buy' || label.includes('outperform')) return '#22c55e';
  if (label === 'hold' || label.includes('neutral')) return '#ca8a04';
  if (label.includes('strong sell')) return '#991b1b';
  if (label === 'sell' || label.includes('underperform')) return '#ef4444';
  return 'var(--text-secondary)';
}
