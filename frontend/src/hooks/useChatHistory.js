import { useEffect, useState, useCallback } from 'react';
import {
  loadSession,
  saveSession,
  clearSession,
  WELCOME_MESSAGE,
  DEFAULT_TICKER,
} from '../utils/chatStorage';

export function useChatHistory() {
  const [messages, setMessages] = useState(() => {
    const saved = loadSession();
    return saved?.messages ?? [WELCOME_MESSAGE];
  });

  const [activeTicker, setActiveTicker] = useState(() => {
    const saved = loadSession();
    return saved?.activeTicker ?? DEFAULT_TICKER;
  });

  useEffect(() => {
    const timer = setTimeout(() => saveSession(messages, activeTicker), 400);
    return () => clearTimeout(timer);
  }, [messages, activeTicker]);

  const clearHistory = useCallback(() => {
    clearSession();
    setMessages([WELCOME_MESSAGE]);
  }, []);

  return {
    messages,
    setMessages,
    activeTicker,
    setActiveTicker,
    clearHistory,
  };
}
