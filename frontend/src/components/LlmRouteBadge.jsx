import React from 'react';
import { formatLlmRouteCompact } from '../utils/llmRouting';

export const LlmRouteBadge = ({ provider, model, routing, className = '' }) => {
  const { label, title } = formatLlmRouteCompact({ provider, model, routing });
  if (!label) return null;

  const isFallback = routing === 'fallback';

  return (
    <span
      className={`llm-route-badge ${isFallback ? 'llm-route-badge--fallback' : ''} ${className}`.trim()}
      title={title || undefined}
    >
      {label}
    </span>
  );
};
