/**
 * Tests for src/ui/modelCatalog — the curated per-provider model list.
 * Pins: every provider has entries, ids are non-empty and unique, and
 * catalogFor is total over ProviderId.
 */
import {MODEL_CATALOG, catalogFor} from '../src/ui/modelCatalog';
import {PROVIDER_IDS} from '../src/types';

describe('modelCatalog', () => {
  it('has a non-empty list for every provider', () => {
    for (const p of PROVIDER_IDS) {
      expect(catalogFor(p).length).toBeGreaterThan(0);
    }
  });

  it('every entry has a non-empty id and label; ids are unique per provider', () => {
    for (const p of PROVIDER_IDS) {
      const ids = catalogFor(p).map(e => e.id);
      for (const e of catalogFor(p)) {
        expect(e.id.length).toBeGreaterThan(0);
        expect(e.label.length).toBeGreaterThan(0);
        expect(typeof e.vision).toBe('boolean');
      }
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('deepseek entries are marked text-only (no vision)', () => {
    for (const e of catalogFor('deepseek')) {
      expect(e.vision).toBe(false);
    }
  });

  it('MODEL_CATALOG covers exactly the provider ids', () => {
    expect(Object.keys(MODEL_CATALOG).sort()).toEqual([...PROVIDER_IDS].sort());
  });
});
