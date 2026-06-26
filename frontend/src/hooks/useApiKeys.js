import { useCallback, useEffect, useState } from 'react';
import { loadApiKeys, saveApiKeys, clearApiKeys } from '../utils/apiKeys';
import { setApiKeyProvider } from '../api';

export function useApiKeys() {
  const [keys, setKeys] = useState(loadApiKeys);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const hasGroqKey = Boolean(keys.groqApiKey?.trim());
  const hasFinnhubKey = Boolean(keys.finnhubApiKey?.trim());

  const applyKeys = useCallback((next) => {
    setKeys(next);
    saveApiKeys(next);
    setApiKeyProvider(() => ({
      groq: next.groqApiKey?.trim() || '',
      finnhub: next.finnhubApiKey?.trim() || '',
    }));
  }, []);

  useEffect(() => {
    applyKeys(keys);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- init once

  const updateKeys = useCallback((partial) => {
    const next = { ...keys, ...partial };
    applyKeys(next);
  }, [keys, applyKeys]);

  const removeKeys = useCallback(() => {
    clearApiKeys();
    const empty = { groqApiKey: '', finnhubApiKey: '' };
    setKeys(empty);
    setApiKeyProvider(() => ({ groq: '', finnhub: '' }));
  }, []);

  return {
    keys,
    hasGroqKey,
    hasFinnhubKey,
    settingsOpen,
    setSettingsOpen,
    updateKeys,
    removeKeys,
  };
}
