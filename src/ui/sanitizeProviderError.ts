// User-facing sanitization for provider errors.
//
// Raw error messages from a ProviderClient include the upstream HTTP
// body text (formatted by src/providers/_http.ts) or low-level
// network errors. Surfacing those verbatim in a chat bubble leaks
// implementation detail and can include API request ids the user
// has no use for. The detailed text remains in console.log; the UI
// gets a short, recognisable summary.

export const sanitizeProviderError = (err: unknown): string => {
  const raw = err instanceof Error ? err.message : String(err);
  if (/aborted/i.test(raw)) {
    return 'Request timed out. Please try again.';
  }
  const httpMatch = raw.match(/^([a-zA-Z][a-zA-Z0-9_-]*):\s*HTTP\s+(\d+)/);
  if (httpMatch) {
    const [, provider, status] = httpMatch;
    // A 404 from a provider almost always means the model id is
    // wrong (or wrong-cased) — the single most common config mistake.
    // Point the user at the fix instead of a bare status code.
    if (status === '404') {
      return `${provider}: HTTP 404 — model id not found. Check the Model in Settings.`;
    }
    if (status === '401' || status === '403') {
      return `${provider}: HTTP ${status} — API key rejected. Check your key file.`;
    }
    return `${provider}: HTTP ${status}`;
  }
  return 'Provider request failed.';
};
