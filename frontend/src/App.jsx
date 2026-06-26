import React, { useState, useEffect, Suspense, lazy } from 'react';
import { LayoutDashboard, LineChart, MessageSquare, KeyRound } from 'lucide-react';
import { ChatBox } from './components/ChatBox';
import { ApiKeySettings } from './components/ApiKeySettings';
import { TickerSearch } from './components/TickerSearch';
import { TickerTape } from './components/TickerTape';
import { LegalDisclaimer } from './components/LegalDisclaimer';
import { checkHealth } from './api';
import { useChatHistory } from './hooks/useChatHistory';
import { useApiKeys } from './hooks/useApiKeys';

const Dashboard = lazy(() =>
  import('./components/Dashboard').then((m) => ({ default: m.Dashboard })),
);
const MarketView = lazy(() =>
  import('./components/MarketView').then((m) => ({ default: m.MarketView })),
);

const TABS = [
  { id: 'desk', label: 'Desk', icon: LayoutDashboard },
  { id: 'markets', label: 'Markets', icon: LineChart },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
];

function TabLoader() {
  return <div className="tab-loader" aria-busy="true">Loading view…</div>;
}

function App() {
  const {
    messages,
    setMessages,
    activeTicker,
    setActiveTicker,
    clearHistory,
  } = useChatHistory();

  const {
    keys,
    hasGroqKey,
    hasFinnhubKey,
    settingsOpen,
    setSettingsOpen,
    updateKeys,
    removeKeys,
  } = useApiKeys();

  const [backendOnline, setBackendOnline] = useState(null);
  const [serverHasGroq, setServerHasGroq] = useState(false);
  const [serverHasGemini, setServerHasGemini] = useState(false);
  const [serverHasFinnhub, setServerHasFinnhub] = useState(false);
  const [activeTab, setActiveTab] = useState('desk');

  const agentReady = backendOnline && (hasGroqKey || serverHasGroq || serverHasGemini);

  useEffect(() => {
    let cancelled = false;

    const pollHealth = async () => {
      try {
        const health = await checkHealth();
        if (!cancelled) {
          setBackendOnline(health.status === 'ok');
          setServerHasGroq(Boolean(health.server_groq_configured));
          setServerHasGemini(Boolean(health.server_gemini_configured));
          setServerHasFinnhub(Boolean(health.server_finnhub_configured));
        }
      } catch {
        if (!cancelled) {
          setBackendOnline(false);
          setServerHasGroq(false);
          setServerHasGemini(false);
          setServerHasFinnhub(false);
        }
      }
    };

    pollHealth();
    const onFocus = () => { pollHealth(); };
    window.addEventListener('focus', onFocus);
    const interval = setInterval(pollHealth, 120000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const statusLabel = () => {
    if (backendOnline === null) return 'Connecting…';
    if (!backendOnline) return 'Offline';
    if (!agentReady) return 'Needs API key';
    return 'Live';
  };

  const showKeyBanner = backendOnline && !hasGroqKey && !serverHasGroq && !serverHasGemini;

  return (
    <div className="app-shell">
      <ApiKeySettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        keys={keys}
        onSave={updateKeys}
        onClear={removeKeys}
      />

      <header className="app-header-wrap">
        <div className="glass-panel app-header">
          <div className="app-brand">
            <span className="app-brand-eyebrow">Terminal</span>
            <h1 className="app-brand-title">Stock Analyst</h1>
          </div>

          <div className="app-header-search">
            <TickerSearch value={activeTicker} onSelect={setActiveTicker} />
          </div>

          <nav className="app-tabs" role="tablist" aria-label="Main views">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                className={`app-tab ${activeTab === id ? 'app-tab--active' : ''}`}
                onClick={() => setActiveTab(id)}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </button>
            ))}
          </nav>

          <div className="app-header-actions">
            <button
              type="button"
              className={`api-key-btn ${hasGroqKey ? 'api-key-btn--set' : 'api-key-btn--missing'}`}
              onClick={() => setSettingsOpen(true)}
            >
              <KeyRound size={15} aria-hidden="true" />
              Keys
            </button>
            <div className="app-status" role="status" aria-live="polite">
              <span
                className={`status-dot ${agentReady ? 'status-dot--online' : 'status-dot--offline'}`}
                aria-hidden="true"
              />
              <span>{statusLabel()}</span>
            </div>
          </div>
        </div>

        <TickerTape activeTicker={activeTicker} />
      </header>

      {showKeyBanner && (
        <div className="byok-banner glass-panel">
          <p>
            <strong>Add API keys</strong> in Settings or <code>backend/.env</code> to enable the AI analyst (Groq or Gemini).
          </p>
          <button type="button" className="glass-button" onClick={() => setSettingsOpen(true)}>
            Open settings
          </button>
        </div>
      )}

      {activeTab === 'desk' && (
        <div className="app-container" role="tabpanel">
          <div className="dashboard-container">
            <Suspense fallback={<TabLoader />}>
              <Dashboard
                ticker={activeTicker}
                backendOnline={backendOnline}
                hasFinnhubKey={hasFinnhubKey || serverHasFinnhub}
                compact
              />
            </Suspense>
          </div>
          <div className="chat-container">
            <ChatBox
              messages={messages}
              setMessages={setMessages}
              onAnalyzeTicker={setActiveTicker}
              onClearHistory={clearHistory}
              agentReady={agentReady}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </div>
        </div>
      )}

      {activeTab === 'markets' && (
        <div className="market-container" role="tabpanel">
          <Suspense fallback={<TabLoader />}>
            <MarketView
              ticker={activeTicker}
              onTickerChange={setActiveTicker}
              hasFinnhubKey={hasFinnhubKey || serverHasFinnhub}
            />
          </Suspense>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="chat-only-container" role="tabpanel">
          <ChatBox
            messages={messages}
            setMessages={setMessages}
            onAnalyzeTicker={setActiveTicker}
            onClearHistory={clearHistory}
            agentReady={agentReady}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </div>
      )}

      <LegalDisclaimer />
    </div>
  );
}

export default App;
