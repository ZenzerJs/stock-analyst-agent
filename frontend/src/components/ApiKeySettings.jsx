import React, { useState, useEffect } from 'react';
import { KeyRound, ExternalLink, Trash2, X } from 'lucide-react';
import { maskKey } from '../utils/apiKeys';

export const ApiKeySettings = ({
  open,
  onClose,
  keys,
  onSave,
  onClear,
}) => {
  const [groqApiKey, setGroqApiKey] = useState(keys.groqApiKey || '');
  const [finnhubApiKey, setFinnhubApiKey] = useState(keys.finnhubApiKey || '');

  useEffect(() => {
    if (open) {
      setGroqApiKey(keys.groqApiKey || '');
      setFinnhubApiKey(keys.finnhubApiKey || '');
    }
  }, [open, keys.groqApiKey, keys.finnhubApiKey]);

  if (!open) return null;

  const handleSave = (e) => {
    e.preventDefault();
    onSave({ groqApiKey: groqApiKey.trim(), finnhubApiKey: finnhubApiKey.trim() });
    onClose();
  };

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <button type="button" className="settings-backdrop" onClick={onClose} aria-label="Close settings" />
      <div className="glass-panel settings-panel">
        <div className="settings-header">
          <div className="settings-title-row">
            <KeyRound size={20} className="settings-icon" aria-hidden="true" />
            <div>
              <h2 id="settings-title">API keys</h2>
              <p className="settings-subtitle">Stored in browser localStorage — prefer backend/.env for local dev</p>
            </div>
          </div>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="settings-form">
          <div className="settings-field">
            <label htmlFor="groq-key">
              Groq API key <span className="settings-required">required for AI chat</span>
            </label>
            <input
              id="groq-key"
              type="password"
              className="glass-input"
              placeholder={keys.groqApiKey ? maskKey(keys.groqApiKey) : 'gsk_...'}
              value={groqApiKey}
              onChange={(e) => setGroqApiKey(e.target.value)}
              autoComplete="off"
            />
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="settings-link"
            >
              Get free key from Groq <ExternalLink size={12} />
            </a>
          </div>

          <div className="settings-field">
            <label htmlFor="finnhub-key">
              Finnhub API key <span className="settings-optional">optional — live quotes & ratings</span>
            </label>
            <input
              id="finnhub-key"
              type="password"
              className="glass-input"
              placeholder={keys.finnhubApiKey ? maskKey(keys.finnhubApiKey) : 'd...'}
              value={finnhubApiKey}
              onChange={(e) => setFinnhubApiKey(e.target.value)}
              autoComplete="off"
            />
            <a
              href="https://finnhub.io/register"
              target="_blank"
              rel="noopener noreferrer"
              className="settings-link"
            >
              Get free key from Finnhub <ExternalLink size={12} />
            </a>
            <p className="settings-hint">Charts still work without Finnhub (yfinance). Live price cards need it.</p>
          </div>

          <div className="settings-actions">
            <button type="submit" className="glass-button">Save keys</button>
            {(keys.groqApiKey || keys.finnhubApiKey) && (
              <button
                type="button"
                className="clear-history-btn"
                onClick={() => { onClear(); onClose(); }}
              >
                <Trash2 size={14} />
                Remove keys
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
