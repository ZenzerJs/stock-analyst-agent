import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { Message } from './Message';
import { ThinkingIndicator } from './ThinkingIndicator';
import { sendChatMessage } from '../api';
import { SUGGESTED_PROMPTS, detectTickerInText } from '../constants';
import { toApiHistory } from '../utils/chatStorage';
import { nowTimestamp } from '../utils/time';

export const ChatBox = ({
  messages,
  setMessages,
  onAnalyzeTicker,
  onClearHistory,
  agentReady,
  onOpenSettings,
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingStartedAt, setThinkingStartedAt] = useState(null);
  const messagesAreaRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    const area = messagesAreaRef.current;
    if (area) {
      area.scrollTop = area.scrollHeight;
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const detectTicker = (text) => detectTickerInText(text);

  const submitMessage = async (text) => {
    const userMsg = text.trim();
    if (!userMsg || isLoading) return;

    setInput('');
    const userMessage = { role: 'user', content: userMsg, timestamp: nowTimestamp() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);
    setThinkingStartedAt(nowTimestamp());

    const ticker = detectTicker(userMsg);
    if (ticker) onAnalyzeTicker?.(ticker);

    try {
      const response = await sendChatMessage(userMsg, toApiHistory(messages));
      const resolvedTicker = response.ticker || ticker;
      if (resolvedTicker) onAnalyzeTicker?.(resolvedTicker);

      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: response.response,
          steps: response.steps,
          sources: response.sources,
          ticker: resolvedTicker,
          provider: response.provider,
          model: response.model,
          routing: response.routing,
          timestamp: nowTimestamp(),
        },
      ]);
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      let content;
      if (status === 401) {
        content = 'Add your Groq key in **Settings** to enable chat.';
        onOpenSettings?.();
      } else if (status === 429) {
        content = '**Rate limited.** Wait a moment or add your Groq key in **Settings**.';
        onOpenSettings?.();
      } else if (status === 503) {
        content = "**Couldn't finish.** Try again in a moment.";
      } else if (!agentReady) {
        content = 'Backend offline — check connection or add your Groq key in Settings.';
      } else {
        content = detail
          ? `**Something went wrong.** ${detail}`
          : '**Something went wrong.** Try again.';
      }
      setMessages([
        ...newMessages,
        { role: 'assistant', content, timestamp: nowTimestamp() },
      ]);
    } finally {
      setIsLoading(false);
      setThinkingStartedAt(null);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submitMessage(input);
  };

  const showPrompts = messages.length <= 1 && !isLoading;

  return (
    <div className="glass-panel chat-panel">
      <div className="chat-header">
        <div>
          <h2 className="chat-title">Analyst chat</h2>
          <p className="chat-subtitle">
            Research desk — chat persists across refreshes
          </p>
        </div>
        {messages.length > 1 && (
          <button
            type="button"
            className="clear-history-btn"
            onClick={onClearHistory}
            aria-label="Clear chat history"
          >
            <Trash2 size={15} aria-hidden="true" />
            Clear
          </button>
        )}
      </div>

      {showPrompts && (
        <div className="prompt-chips" role="group" aria-label="Suggested questions">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="prompt-chip"
              onClick={() => submitMessage(prompt)}
              disabled={isLoading || !agentReady}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      <div
        className="messages-area"
        ref={messagesAreaRef}
        aria-live="polite"
        aria-label="Chat messages"
      >
        {messages.map((msg, index) => (
          <Message key={`${index}-${msg.timestamp ?? msg.content?.slice(0, 24)}`} message={msg} />
        ))}
        {isLoading && <ThinkingIndicator startedAt={thinkingStartedAt} />}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="glass-input"
          style={{ flex: 1 }}
          placeholder="Ask about NVDA price, AAPL earnings, MSFT fundamentals…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          aria-label="Your question"
        />
        <button
          type="submit"
          className="glass-button"
          disabled={isLoading || !input.trim() || !agentReady}
          aria-label="Send message"
        >
          <Send size={18} aria-hidden="true" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
};
