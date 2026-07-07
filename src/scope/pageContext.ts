// Singleton holding the most recent page-context capture.
//
// Captured at sidebar-button tap (BEFORE the overlay opens — see
// index.js subscribeToButtonEvents). The capture is fired
// asynchronously: the button handler kicks it off and stores the
// PROMISE here, then immediately opens the overlay so the popup
// renders without waiting for screenshot + OCR (700-2000ms on
// device). ChatView awaits the promise inside its send flow — by
// then capture is usually done; if not, the existing "thinking"
// placeholder covers the wait.
//
// Lifetime: replaced on every sidebar tap; cleared on overlay close.

export type PageContext = {
  notePath: string;
  page: number;
  // Absolute path on the device (file:// URL drops the prefix).
  screenshotPath: string;
  // Base64-encoded PNG bytes, ready for direct inclusion in provider
  // request bodies (Anthropic image block, OpenAI image_url data URL,
  // Gemini inline_data). Pre-encoded so the per-action send is a
  // pure construction step.
  screenshotBase64: string;
  // Concatenated transcribed text — typed text from TextBox elements
  // plus the firmware's handwriting-recognition output for any
  // strokes on the page. Empty string when neither is present.
  // Sent alongside the image to give text-only providers (DeepSeek)
  // a useful signal, and to give image-capable providers a cleaner
  // backup transcription that's often easier for the LLM to read
  // than rendered handwriting.
  pageText: string;
};

let currentPromise: Promise<PageContext | null> | null = null;

// Wired by index.js at bootstrap. `refresher` re-runs the full
// capture; `prober` answers "which file+page is the user on right
// now" with two cheap SDK calls. Both live here (not in ChatView)
// so the UI stays free of sn-plugin-lib imports and tests register
// fakes instead.
let refresher: (() => Promise<PageContext | null>) | null = null;
let prober: (() => Promise<{path: string; page: number} | null>) | null =
  null;

export const setPageContextRefresher = (
  fn: () => Promise<PageContext | null>,
): void => {
  refresher = fn;
};

export const setPageContextProbe = (
  fn: () => Promise<{path: string; page: number} | null>,
): void => {
  prober = fn;
};

// Used by index.js: stores the in-flight capture promise. The button
// handler does NOT await this — it just hands the promise off so the
// overlay can open immediately. Chat send awaits later.
export const setPageContextPromise = (
  p: Promise<PageContext | null>,
): void => {
  currentPromise = p;
};

// Convenience for callers who already have a resolved value (tests
// and the overlay-close path). Wraps in a resolved Promise so the
// async getter can stay uniform.
export const setPageContext = (ctx: PageContext | null): void => {
  currentPromise = ctx === null ? null : Promise.resolve(ctx);
};

// Async — resolves to the captured context (or null if no capture
// is in flight or the capture failed). Awaiting a settled promise
// is essentially free; awaiting an in-flight one yields naturally.
export const getPageContext = async (): Promise<PageContext | null> => {
  return currentPromise ?? null;
};

// Freshness-checked getter for the chat send path. The capture is
// taken ONCE at sidebar tap, but the panel only covers part of the
// screen — the user can keep flipping pages beneath it. Answering
// about a page the user left is worse than a 1-2s recapture, so:
// probe the current file+page (two cheap SDK calls); when it differs
// from the stored capture (or the stored capture is missing/failed),
// re-run the capture and replace the stored promise. Falls back to
// the stored value when the probe/refresher aren't wired (tests,
// unexpected hosts).
export const getFreshPageContext = async (): Promise<PageContext | null> => {
  const ctx = await (currentPromise ?? Promise.resolve(null));
  if (prober === null || refresher === null) {
    return ctx;
  }
  let cur: {path: string; page: number} | null = null;
  try {
    cur = await prober();
  } catch {
    return ctx;
  }
  if (cur === null) {
    return ctx;
  }
  if (ctx !== null && ctx.notePath === cur.path && ctx.page === cur.page) {
    return ctx;
  }
  currentPromise = refresher().catch(() => null);
  return currentPromise;
};

// Test-only — a fresh module under jest is the same singleton, and we
// don't want test ordering to leak state.
export const __testing__ = {
  reset(): void {
    currentPromise = null;
    refresher = null;
    prober = null;
  },
};
