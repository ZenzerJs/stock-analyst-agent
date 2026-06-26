import React, { useEffect, useState } from 'react';
import { fetchTickerTape } from '../api';

const formatChange = (pct) => {
  if (pct == null) return null;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
};

const directionClass = (pct) => {
  if (pct == null) return 'ticker-tape-item--flat';
  if (pct > 0) return 'ticker-tape-item--up';
  if (pct < 0) return 'ticker-tape-item--down';
  return 'ticker-tape-item--flat';
};

export const TickerTape = ({ activeTicker }) => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      if (document.visibilityState === 'hidden') return;
      fetchTickerTape()
        .then((data) => {
          if (!cancelled) setItems(data.items || []);
        })
        .catch(() => {
          if (!cancelled) setItems([]);
        });
    };

    load();
    const timer = setInterval(load, 120000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  if (!items.length) return null;

  const tapeItems = [...items, ...items];

  return (
    <div className="ticker-tape" aria-hidden="true">
      <div className="ticker-tape-track">
        {tapeItems.map((item, i) => {
          const dir = directionClass(item.change_pct);
          const active = item.ticker === activeTicker;
          return (
            <span
              key={`${item.ticker}-${i}`}
              className={`ticker-tape-item ${dir} ${active ? 'ticker-tape-item--active' : ''}`}
            >
              <span className="ticker-tape-symbol">{item.ticker}</span>
              {item.name && (
                <span className="ticker-tape-name">{item.name}</span>
              )}
              {item.change_pct != null && (
                <span className="ticker-tape-change">{formatChange(item.change_pct)}</span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
};
