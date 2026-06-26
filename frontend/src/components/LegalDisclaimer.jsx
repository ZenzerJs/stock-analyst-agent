import React from 'react';
import { AlertTriangle, ExternalLink, FileText } from 'lucide-react';
import { formatQuarter } from '../utils/formatters';

const formatFilingDate = (value) => {
  if (!value) return null;
  const d = new Date(`${value}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export const FundamentalsAttribution = ({ filing, ticker }) => {
  if (!filing) return null;

  const periodLabel = filing.period_ending
    ? formatQuarter(filing.period_ending)
    : 'latest quarter';

  return (
    <aside className="fundamentals-attribution" aria-label="Latest quarterly filing source">
      <div className="fundamentals-attribution-header">
        <FileText size={16} aria-hidden="true" />
        <span>Most recent quarter source</span>
      </div>
      <p className="fundamentals-attribution-body">
        <strong>{filing.filed_by || ticker}</strong>
        {filing.exchange ? <> · listed on {filing.exchange}</> : null}
        {' '}filed Form <strong>{filing.filing_type || '10-Q'}</strong> with the{' '}
        <strong>SEC</strong>
        {filing.filing_date ? <> on {formatFilingDate(filing.filing_date)}</> : null}
        {filing.period_ending ? <> for period ending {periodLabel}</> : null}.
        {' '}Figures shown are aggregated via{' '}
        <a href={filing.financials_url} target="_blank" rel="noopener noreferrer">
          Yahoo Finance
        </a>
        {' '}(from EDGAR filings — not a broker trade confirmation).
      </p>
      <div className="fundamentals-attribution-links">
        {filing.filing_url && (
          <a href={filing.filing_url} target="_blank" rel="noopener noreferrer">
            View filing <ExternalLink size={12} aria-hidden="true" />
          </a>
        )}
        <a href={filing.sec_edgar_url} target="_blank" rel="noopener noreferrer">
          SEC EDGAR search <ExternalLink size={12} aria-hidden="true" />
        </a>
      </div>
      <p className="fundamentals-attribution-note">{filing.data_provider_detail}</p>
    </aside>
  );
};

export const LegalDisclaimer = ({ compact = false }) => (
  <footer
    className={`legal-disclaimer ${compact ? 'legal-disclaimer--compact' : ''}`}
    role="contentinfo"
  >
    <div className="legal-disclaimer-inner">
      <AlertTriangle size={16} className="legal-disclaimer-icon" aria-hidden="true" />
      <p>
        <strong>Research simulator — not financial advice.</strong>{' '}
        Stock Analyst Terminal is an educational research tool only. Nothing on this site
        constitutes investment, tax, or legal advice, nor a recommendation to buy or sell
        any security. Market data and AI responses may be delayed, incomplete, simulated,
        or inaccurate and must not be relied upon for trading decisions. Past performance
        does not guarantee future results. You are solely responsible for your own
        investment choices. By using this app you agree that its operators and contributors
        are not liable for any losses or damages arising from your use of the information
        presented here.
      </p>
    </div>
  </footer>
);
