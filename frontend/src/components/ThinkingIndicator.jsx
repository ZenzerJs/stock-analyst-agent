import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { formatElapsed } from '../utils/time';

export const ThinkingIndicator = ({ startedAt }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return undefined;
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <div className="thinking-row thinking-row--compact">
      <div className="message-avatar message-avatar--assistant message-avatar--thinking" aria-hidden="true">
        <Loader2 size={16} className="spin" />
      </div>
      <div className="message-meta message-meta--thinking">
        Thinking
        {elapsed > 0 && <span className="thinking-elapsed">· {formatElapsed(elapsed)}</span>}
      </div>
    </div>
  );
};
