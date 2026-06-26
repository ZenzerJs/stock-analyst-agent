import React from 'react';
import { ExternalLink, ShieldCheck } from 'lucide-react';

export const TrustedSources = ({ sources, compact = false }) => {
  if (!sources?.length) return null;

  return (
    <div className={`trusted-sources ${compact ? 'trusted-sources--compact' : ''}`}>
      <div className="trusted-sources-header">
        <ShieldCheck size={15} aria-hidden="true" />
        <span>{compact ? 'Verify on trusted sources' : 'Trusted sources'}</span>
      </div>
      <ul className="trusted-sources-list">
        {sources.map((source) => (
          <li key={source.id}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="trusted-source-link"
            >
              <span className="trusted-source-text">
                <strong>{source.label}</strong>
                {!compact && <span className="trusted-source-desc">{source.description}</span>}
              </span>
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};
