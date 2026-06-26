import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Search, Database, Globe, CornerDownLeft } from 'lucide-react';
import { searchTickers } from '../api';

const isSymbolLike = (value) => /^[A-Za-z0-9.\-]{1,8}$/.test(value.trim());

export const TickerSearch = ({
  value,
  onSelect,
  placeholder = 'Search by name or ticker — Apple, Tesla, NVDA…',
}) => {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  const runSearch = useCallback(async (q) => {
    setLoading(true);
    try {
      const data = await searchTickers(q);
      setResults(data.results || []);
      setHighlight(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => runSearch(query), 200);
    return () => clearTimeout(timer);
  }, [query, open, runSearch]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = (ticker) => {
    setQuery(ticker);
    setOpen(false);
    onSelect?.(ticker);
  };

  const onKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[highlight]) {
        pick(results[highlight].ticker);
      } else if (query.trim() && isSymbolLike(query)) {
        pick(query.trim().toUpperCase());
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const trimmed = query.trim();
  const canTrySymbol = trimmed && isSymbolLike(trimmed);
  const symbolInResults = results.some(
    (r) => r.ticker === trimmed.toUpperCase(),
  );

  return (
    <div className="ticker-search" ref={wrapRef}>
      <div className={`ticker-search-input-wrap ${open ? 'ticker-search-input-wrap--open' : ''}`}>
        <Search size={17} className="ticker-search-icon" aria-hidden="true" />
        <input
          type="search"
          className="ticker-search-input"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Search stocks by company name or ticker symbol"
          aria-expanded={open}
          aria-autocomplete="list"
          role="combobox"
        />
        <kbd className="ticker-search-kbd" aria-hidden="true">↵</kbd>
      </div>

      {open && (
        <div className="ticker-search-dropdown" role="listbox">
          {loading && <p className="ticker-search-empty">Searching…</p>}
          {!loading && results.length === 0 && (
            <p className="ticker-search-empty">
              {trimmed
                ? (canTrySymbol
                  ? `No matches — press Enter to try ${trimmed.toUpperCase()}`
                  : 'No matches — try a different spelling or ticker symbol')
                : 'Type a company name (e.g. Apple) or ticker (e.g. AAPL)'}
            </p>
          )}
          {!loading && results.map((item, index) => (
            <button
              key={`${item.ticker}-${item.source}-${index}`}
              type="button"
              role="option"
              aria-selected={index === highlight}
              className={`ticker-search-option ${index === highlight ? 'ticker-search-option--active' : ''}`}
              onMouseEnter={() => setHighlight(index)}
              onClick={() => pick(item.ticker)}
            >
              <div className="ticker-search-option-left">
                <span className="ticker-search-option-symbol">{item.ticker}</span>
                {item.name && (
                  <span className="ticker-search-option-name">{item.name}</span>
                )}
              </div>
              <span className="ticker-search-option-meta">
                {item.has_fundamentals ? (
                  <span className="ticker-search-badge ticker-search-badge--cache">
                    <Database size={11} />
                    {item.quarters ? `${item.quarters}Q cached` : 'Fundamentals'}
                  </span>
                ) : (
                  <span className="ticker-search-badge ticker-search-badge--market">
                    <Globe size={11} /> Live data only
                  </span>
                )}
              </span>
            </button>
          ))}
          {!loading && canTrySymbol && !symbolInResults && (
            <button
              type="button"
              className="ticker-search-option ticker-search-option--custom"
              onClick={() => pick(trimmed.toUpperCase())}
            >
              <CornerDownLeft size={14} />
              Look up ticker <strong>{trimmed.toUpperCase()}</strong>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
