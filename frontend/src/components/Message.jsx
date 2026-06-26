import React, { useState, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, User, ChevronDown, ChevronRight } from 'lucide-react';
import { TrustedSources } from './TrustedSources';
import { LlmRouteBadge } from './LlmRouteBadge';
import { formatMessageTime } from '../utils/time';

const markdownComponents = {
  p: ({ children }) => <p style={{ margin: '0 0 10px 0' }}>{children}</p>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
  ),
  code: ({ inline, className, children, ...props }) =>
    !inline ? (
      <pre><code className={className} {...props}>{children}</code></pre>
    ) : (
      <code {...props}>{children}</code>
    ),
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', marginBottom: '10px' }}>
      <table>{children}</table>
    </div>
  ),
  th: ({ children }) => <th>{children}</th>,
  td: ({ children }) => <td>{children}</td>,
};

const formatStep = (step) => {
  if (step.type === 'tool_call') {
    const args = step.args ? JSON.stringify(step.args) : '';
    return `Called ${step.name}(${args})`;
  }
  if (step.type === 'tool_response') {
    const preview = (step.content || '').slice(0, 120);
    return `${step.name} → ${preview}${step.content?.length > 120 ? '…' : ''}`;
  }
  return step.content?.slice(0, 140) || 'Agent response';
};

export const Message = memo(function Message({ message }) {
  const isUser = message.role === 'user';
  const [showSteps, setShowSteps] = useState(false);
  const hasSteps = !isUser && message.steps?.length > 0;
  const hasSources = !isUser && message.sources?.length > 0;
  const timeLabel = formatMessageTime(message.timestamp);

  return (
    <div className={`message-row message-row--enter ${isUser ? 'message-row--user' : ''}`}>
      <div
        className={`message-avatar ${isUser ? 'message-avatar--user' : 'message-avatar--assistant'}`}
        aria-hidden="true"
      >
        {isUser ? <User size={18} /> : <Bot size={18} />}
      </div>

      <div className="message-content-wrap">
        {timeLabel && (
          <div className={`message-meta ${isUser ? 'message-meta--user' : 'message-meta--assistant'}`}>
            <span>{isUser ? 'You' : 'Agent'}</span>
            {!isUser && (message.provider || message.model) && (
              <LlmRouteBadge
                provider={message.provider}
                model={message.model}
                routing={message.routing}
              />
            )}
            <time dateTime={message.timestamp ? new Date(message.timestamp).toISOString() : undefined}>
              {timeLabel}
            </time>
          </div>
        )}

        <div className={`glass-panel message-bubble ${isUser ? 'message-bubble--user' : 'message-bubble--assistant'}`}>
          <ReactMarkdown components={markdownComponents}>
            {message.content}
          </ReactMarkdown>

          {hasSources && (
            <TrustedSources sources={message.sources} compact />
          )}

          {hasSteps && (
            <div className="reasoning-panel">
              <button
                type="button"
                className="reasoning-toggle"
                onClick={() => setShowSteps((v) => !v)}
                aria-expanded={showSteps}
              >
                {showSteps ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {showSteps ? 'Hide' : 'Show'} agent steps ({message.steps.length})
              </button>
              {showSteps && (
                <div className="reasoning-steps">
                  {message.steps.map((step, i) => (
                    <div key={i} className="reasoning-step">{formatStep(step)}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
