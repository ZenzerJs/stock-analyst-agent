import React, { useState } from 'react';
import { Database, Download, Layers, Loader2 } from 'lucide-react';
import { useFundamentals } from '../hooks/useFundamentals';
import { MetricBarChart } from './MetricBarChart';
import { FundamentalsAttribution, LegalDisclaimer } from './LegalDisclaimer';
import { formatLargeNumber, formatQuarter } from '../utils/formatters';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'income_statement', label: 'Income' },
  { id: 'balance_sheet', label: 'Balance' },
  { id: 'cash_flow', label: 'Cash flow' },
];

const OVERVIEW_KEYS = [
  { key: 'revenue', title: 'Revenue' },
  { key: 'net_income', title: 'Net income' },
  { key: 'eps', title: 'Diluted EPS', isEps: true },
  { key: 'operating_cash_flow', title: 'Operating cash flow' },
];

const FundamentalsHeader = ({
  ticker,
  quarterCount,
  hasData,
  hasSessionCache,
  fetching,
  onFetch,
}) => (
  <div className="quarterly-fundamentals-header">
    {hasData ? <Database size={20} aria-hidden="true" /> : <Layers size={20} aria-hidden="true" />}
    <div className="quarterly-fundamentals-header-text">
      <h3>Quarterly fundamentals</h3>
      <p className="quarterly-fundamentals-sub">
        {hasData
          ? `${quarterCount} quarters — visual view of SEC-filed statements (same data the chat agent uses)`
          : `No filings cached for ${ticker}. Fetch from Yahoo Finance to load charts and cache for this session.`}
      </p>
    </div>
    <div className="quarterly-fundamentals-actions">
      {hasData && (
        <span className="fundamentals-pill">
          <Database size={12} />
          {quarterCount}Q {hasSessionCache ? 'session' : 'cached'}
        </span>
      )}
      <button
        type="button"
        className="fundamentals-fetch-btn"
        onClick={onFetch}
        disabled={fetching}
        aria-busy={fetching}
      >
        {fetching ? (
          <>
            <Loader2 size={16} className="spin" aria-hidden="true" />
            Fetching…
          </>
        ) : (
          <>
            <Download size={16} aria-hidden="true" />
            {hasData ? 'Refresh data' : 'Fetch & cache'}
          </>
        )}
      </button>
    </div>
  </div>
);

export const QuarterlyFundamentals = ({ ticker, onCached }) => {
  const {
    data,
    loading,
    fetching,
    error,
    fetchMessage,
    fetchAndCache,
    hasSessionCache,
  } = useFundamentals(ticker);
  const [activeTab, setActiveTab] = useState('overview');

  const handleFetch = async () => {
    const ok = await fetchAndCache();
    if (ok) onCached?.();
  };

  const hasData = Boolean(data?.has_data);
  const section = data?.sections?.[activeTab];
  const highlights = data?.highlights || {};

  if (loading && !data) {
    return (
      <div className="quarterly-fundamentals glass-panel panel-glow">
        <FundamentalsHeader
          ticker={ticker}
          hasData={false}
          fetching={fetching}
          onFetch={handleFetch}
        />
        <p className="volume-flow-empty">Loading quarterly financials…</p>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="quarterly-fundamentals glass-panel">
        <FundamentalsHeader
          ticker={ticker}
          hasData={false}
          fetching={fetching}
          onFetch={handleFetch}
        />
        {error && <p className="stat-card-sub stat-card-sub--error">{error}</p>}
        {fetchMessage && !error && (
          <p className="fundamentals-fetch-message">{fetchMessage}</p>
        )}
        <LegalDisclaimer compact />
      </div>
    );
  }

  return (
    <div className="quarterly-fundamentals glass-panel panel-glow">
      <FundamentalsHeader
        ticker={ticker}
        quarterCount={data.quarter_count}
        hasData
        hasSessionCache={hasSessionCache}
        fetching={fetching}
        onFetch={handleFetch}
      />

      {(error || fetchMessage) && (
        <p className={error ? 'stat-card-sub stat-card-sub--error' : 'fundamentals-fetch-message'}>
          {error || fetchMessage}
        </p>
      )}

      <div className="fundamentals-tabs" role="tablist" aria-label="Financial statement views">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`fundamentals-tab ${activeTab === tab.id ? 'fundamentals-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="fundamentals-overview-grid">
          {OVERVIEW_KEYS.map(({ key, title, isEps }) => {
            const series = highlights[key];
            if (!series?.values?.length) return null;
            return (
              <MetricBarChart
                key={key}
                title={title}
                quarters={series.quarters}
                values={series.values}
                isEps={isEps}
              />
            );
          })}
        </div>
      )}

      {activeTab !== 'overview' && section && (
        <div className="fundamentals-table-wrap">
          <table className="fundamentals-table">
            <thead>
              <tr>
                <th>Metric</th>
                {section.quarters.map((q) => (
                  <th key={q}>{formatQuarter(q)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.metrics.slice(0, 12).map((metric) => (
                <tr key={metric.key}>
                  <td className="fundamentals-table-metric">{metric.label}</td>
                  {metric.values.map((val, i) => (
                    <td
                      key={`${metric.key}-${section.quarters[i]}`}
                      className={val != null && val < 0 ? 'fundamentals-table-val--neg' : ''}
                    >
                      {formatLargeNumber(val, metric.is_eps)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab !== 'overview' && !section && (
        <p className="volume-flow-empty">No {activeTab.replace('_', ' ')} data in cache.</p>
      )}

      <FundamentalsAttribution filing={data.latest_filing} ticker={ticker} />
      <LegalDisclaimer compact />
    </div>
  );
};
