/**
 * Tests for src/scope/pageContext — promise-singleton holding the
 * most recent page-context capture (async since the capture is now
 * fired before the overlay opens).
 *
 * Pins:
 *   1. Initial state resolves to null.
 *   2. setPageContext(ctx) → getPageContext() resolves to ctx.
 *   3. setPageContext(null) clears.
 *   4. setPageContextPromise(p) lets the getter await an in-flight
 *      capture (the whole point of this rewrite).
 *   5. __testing__.reset() returns to the initial state.
 */
import {
  getFreshPageContext,
  getPageContext,
  setPageContext,
  setPageContextProbe,
  setPageContextPromise,
  setPageContextRefresher,
  __testing__,
  type PageContext,
} from '../src/scope/pageContext';

beforeEach(() => {
  __testing__.reset();
});

const sample: PageContext = {
  notePath: '/sd/notes/x.note',
  page: 3,
  screenshotPath: '/sd/.scratch/copilot-page.png',
  screenshotBase64: 'aGVsbG8=',
  pageText: 'transcribed page text',
};

describe('pageContext', () => {
  it('initial state resolves to null', async () => {
    expect(await getPageContext()).toBeNull();
  });

  it('setPageContext(ctx) → getPageContext() resolves to ctx', async () => {
    setPageContext(sample);
    expect(await getPageContext()).toBe(sample);
  });

  it('setPageContext(null) clears the singleton', async () => {
    setPageContext(sample);
    setPageContext(null);
    expect(await getPageContext()).toBeNull();
  });

  it('setPageContextPromise: getter awaits the in-flight capture', async () => {
    let resolveIt!: (v: PageContext | null) => void;
    const p = new Promise<PageContext | null>(r => {
      resolveIt = r;
    });
    setPageContextPromise(p);
    // Resolve later — getter should still see the value.
    resolveIt(sample);
    expect(await getPageContext()).toBe(sample);
  });

  it('setPageContextPromise: a still-pending capture yields when awaited', async () => {
    let resolveIt!: (v: PageContext | null) => void;
    const p = new Promise<PageContext | null>(r => {
      resolveIt = r;
    });
    setPageContextPromise(p);
    const reader = getPageContext();
    // The reader is awaiting — resolve and verify it picks up the value.
    resolveIt(sample);
    expect(await reader).toBe(sample);
  });

  it('__testing__.reset() returns to null', async () => {
    setPageContext(sample);
    __testing__.reset();
    expect(await getPageContext()).toBeNull();
  });
});

describe('getFreshPageContext — staleness detection', () => {
  const onPage = (path: string, page: number) => async () => ({path, page});

  afterEach(() => {
    __testing__.reset();
  });

  it('returns the stored context when the user has not moved', async () => {
    setPageContext(sample);
    setPageContextProbe(onPage(sample.notePath, sample.page));
    const refresher = jest.fn();
    setPageContextRefresher(refresher);
    expect(await getFreshPageContext()).toBe(sample);
    expect(refresher).not.toHaveBeenCalled();
  });

  it('re-captures when the user flipped to another page', async () => {
    const fresh = {...sample, page: sample.page + 3};
    setPageContext(sample);
    setPageContextProbe(onPage(sample.notePath, sample.page + 3));
    const refresher = jest.fn(async () => fresh);
    setPageContextRefresher(refresher);
    expect(await getFreshPageContext()).toBe(fresh);
    expect(refresher).toHaveBeenCalledTimes(1);
    // The refreshed value replaces the stored promise for later reads.
    expect(await getPageContext()).toBe(fresh);
  });

  it('re-captures when the user switched files', async () => {
    const fresh = {...sample, notePath: '/sd/other.note'};
    setPageContext(sample);
    setPageContextProbe(onPage('/sd/other.note', sample.page));
    setPageContextRefresher(jest.fn(async () => fresh));
    expect(await getFreshPageContext()).toBe(fresh);
  });

  it('re-captures when the initial capture failed (stored null)', async () => {
    setPageContext(null);
    setPageContextProbe(onPage(sample.notePath, sample.page));
    const refresher = jest.fn(async () => sample);
    setPageContextRefresher(refresher);
    expect(await getFreshPageContext()).toBe(sample);
    expect(refresher).toHaveBeenCalledTimes(1);
  });

  it('falls back to the stored context when probe/refresher are unwired', async () => {
    setPageContext(sample);
    expect(await getFreshPageContext()).toBe(sample);
  });

  it('falls back to the stored context when the probe throws or yields null', async () => {
    setPageContext(sample);
    setPageContextRefresher(jest.fn());
    setPageContextProbe(async () => {
      throw new Error('probe boom');
    });
    expect(await getFreshPageContext()).toBe(sample);
    setPageContextProbe(async () => null);
    expect(await getFreshPageContext()).toBe(sample);
  });

  it('yields null (not a rejection) when the re-capture itself fails', async () => {
    setPageContext(sample);
    setPageContextProbe(onPage('/sd/other.note', 1));
    setPageContextRefresher(async () => {
      throw new Error('capture boom');
    });
    expect(await getFreshPageContext()).toBeNull();
  });
});
