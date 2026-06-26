export function formatProviderName(provider) {
  if (provider === 'groq') return 'Groq';
  if (provider === 'gemini') return 'Gemini';
  return provider || 'Unknown';
}

/** Short label for inline badges; full detail goes in title/tooltip. */
export function formatLlmRouteCompact({ provider, model, routing } = {}) {
  if (!provider) return { label: null, title: null };

  const name = formatProviderName(provider);
  const label = routing === 'fallback' ? `${name} ↺` : name;
  const titleParts = [name];
  if (model) titleParts.push(model);
  if (routing === 'fallback') titleParts.push('fallback');

  return {
    label,
    title: titleParts.join(' · '),
  };
}

export function formatLlmRoute({ provider, model, routing } = {}) {
  const compact = formatLlmRouteCompact({ provider, model, routing });
  return compact.label;
}
