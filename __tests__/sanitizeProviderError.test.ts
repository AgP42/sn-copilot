import {sanitizeProviderError} from '../src/ui/sanitizeProviderError';

describe('sanitizeProviderError', () => {
  it('maps an "aborted" error to a timeout-friendly message', () => {
    expect(sanitizeProviderError(new Error('aborted'))).toBe(
      'Request timed out. Please try again.',
    );
  });

  it('preserves provider + status for HTTP errors and drops the body', () => {
    // 401/403 now carry a key-file hint; 500 (and other codes) stay bare.
    expect(
      sanitizeProviderError(
        new Error('anthropic: HTTP 401 — {"error":"invalid api key"}'),
      ),
    ).toContain('anthropic: HTTP 401');
    expect(
      sanitizeProviderError(
        new Error('anthropic: HTTP 401 — {"error":"invalid api key"}'),
      ),
    ).toContain('key');
  });

  it('handles HTTP errors without a body suffix', () => {
    expect(sanitizeProviderError(new Error('openai: HTTP 500'))).toBe(
      'openai: HTTP 500',
    );
  });

  it('falls back to a generic summary for unknown shapes', () => {
    expect(sanitizeProviderError(new Error('weird thing happened'))).toBe(
      'Provider request failed.',
    );
  });

  it('handles non-Error rejections', () => {
    expect(sanitizeProviderError('plain string')).toBe(
      'Provider request failed.',
    );
  });
});

describe('sanitizeProviderError — actionable hints', () => {
  it('404 points at the model id in Settings', () => {
    const msg = sanitizeProviderError(
      new Error('anthropic: HTTP 404 — {"type":"not_found_error"}'),
    );
    expect(msg).toContain('404');
    expect(msg.toLowerCase()).toContain('model');
    expect(msg).toContain('Settings');
  });

  it('403 points at the key file', () => {
    expect(
      sanitizeProviderError(new Error('openai: HTTP 403')).toLowerCase(),
    ).toContain('key');
  });

  it('other codes stay bare', () => {
    expect(sanitizeProviderError(new Error('openai: HTTP 429'))).toBe(
      'openai: HTTP 429',
    );
  });
});
