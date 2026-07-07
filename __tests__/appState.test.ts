/**
 * Tests for src/storage/appState. Pure-function table.
 */
import {
  computeAppState,
  uncoveredPlaintextFiles,
} from '../src/storage/appState';
import type {KeyFile} from '../src/types';

const f = (id: string): KeyFile => ({
  provider: 'anthropic',
  model: 'claude-haiku-4-5',
  key: 'sk-ant-' + id,
  sourcePath: `/x/${id}.txt`,
});

describe('computeAppState — vault present', () => {
  it('unlocked with no plaintext → unlocked', () => {
    expect(
      computeAppState({
        vaultExists: true,
        plaintextFiles: [],
        encryptionMode: 'encrypted',
        unlockedFiles: [f('a')],
      }),
    ).toEqual({kind: 'unlocked', files: [f('a')]});
  });

  it('unlocked with plaintext → merge (rotation)', () => {
    expect(
      computeAppState({
        vaultExists: true,
        plaintextFiles: [f('b')],
        encryptionMode: 'encrypted',
        unlockedFiles: [f('a')],
      }),
    ).toEqual({
      kind: 'merge',
      vaultExists: true,
      plaintextFiles: [f('b')],
    });
  });

  it('locked, plaintext present → merge', () => {
    expect(
      computeAppState({
        vaultExists: true,
        plaintextFiles: [f('b')],
        encryptionMode: 'encrypted',
        unlockedFiles: null,
      }),
    ).toEqual({
      kind: 'merge',
      vaultExists: true,
      plaintextFiles: [f('b')],
    });
  });

  it('locked, no plaintext → locked', () => {
    expect(
      computeAppState({
        vaultExists: true,
        plaintextFiles: [],
        encryptionMode: 'encrypted',
        unlockedFiles: null,
      }),
    ).toEqual({kind: 'locked'});
  });
});

describe('computeAppState — no vault', () => {
  it('no plaintext → no-key', () => {
    expect(
      computeAppState({
        vaultExists: false,
        plaintextFiles: [],
        encryptionMode: 'undecided',
        unlockedFiles: null,
      }),
    ).toEqual({kind: 'no-key'});
  });

  it('plaintext + undecided → migrate', () => {
    expect(
      computeAppState({
        vaultExists: false,
        plaintextFiles: [f('a')],
        encryptionMode: 'undecided',
        unlockedFiles: null,
      }),
    ).toEqual({kind: 'migrate', files: [f('a')]});
  });

  it('plaintext + plaintext mode → plaintext', () => {
    expect(
      computeAppState({
        vaultExists: false,
        plaintextFiles: [f('a')],
        encryptionMode: 'plaintext',
        unlockedFiles: null,
      }),
    ).toEqual({kind: 'plaintext', files: [f('a')]});
  });

  it('plaintext + encrypted mode (impossible state) collapses to plaintext', () => {
    expect(
      computeAppState({
        vaultExists: false,
        plaintextFiles: [f('a')],
        encryptionMode: 'encrypted',
        unlockedFiles: null,
      }),
    ).toEqual({kind: 'plaintext', files: [f('a')]});
  });
});

describe('computeAppState — plaintext already covered by the vault', () => {
  it('unlocked + identical plaintext (kept .txt) → unlocked, NOT merge', () => {
    // The exact loop from the field report: encrypt, keep the .txt
    // ("Skip — I'll delete it manually"), relaunch, unlock — the
    // state must land on the chat, not back on the unlock screen.
    const vaultCopy = {...f('a'), sourcePath: '/vault'};
    expect(
      computeAppState({
        vaultExists: true,
        plaintextFiles: [f('a')],
        encryptionMode: 'encrypted',
        unlockedFiles: [vaultCopy],
      }),
    ).toEqual({kind: 'unlocked', files: [vaultCopy]});
  });

  it('sourcePath differences never trigger merge', () => {
    expect(
      computeAppState({
        vaultExists: true,
        plaintextFiles: [{...f('a'), sourcePath: '/somewhere/else.txt'}],
        encryptionMode: 'encrypted',
        unlockedFiles: [f('a')],
      }).kind,
    ).toBe('unlocked');
  });

  it('a changed model in the .txt still triggers merge', () => {
    expect(
      computeAppState({
        vaultExists: true,
        plaintextFiles: [{...f('a'), model: 'claude-opus-4-8'}],
        encryptionMode: 'encrypted',
        unlockedFiles: [f('a')],
      }).kind,
    ).toBe('merge');
  });

  it('partially covered → merge carries ONLY the uncovered entries', () => {
    const newProvider: KeyFile = {
      provider: 'openai',
      model: 'gpt-4o-mini',
      key: 'sk-x',
      sourcePath: '/x/openai.txt',
    };
    const state = computeAppState({
      vaultExists: true,
      plaintextFiles: [f('a'), newProvider],
      encryptionMode: 'encrypted',
      unlockedFiles: [f('a')],
    });
    expect(state).toEqual({
      kind: 'merge',
      vaultExists: true,
      plaintextFiles: [newProvider],
    });
  });

  it('locked (no in-memory key) + plaintext stays merge — no vault to compare against', () => {
    expect(
      computeAppState({
        vaultExists: true,
        plaintextFiles: [f('a')],
        encryptionMode: 'encrypted',
        unlockedFiles: null,
      }).kind,
    ).toBe('merge');
  });
});

describe('uncoveredPlaintextFiles', () => {
  it('treats optional-field changes as uncovered', () => {
    expect(
      uncoveredPlaintextFiles(
        [{...f('a'), clarifyRedact: true}],
        [f('a')],
      ),
    ).toHaveLength(1);
    expect(
      uncoveredPlaintextFiles(
        [{...f('a'), defaultProvider: 'anthropic'}],
        [f('a')],
      ),
    ).toHaveLength(1);
  });

  it('empty inputs behave', () => {
    expect(uncoveredPlaintextFiles([], [f('a')])).toEqual([]);
    expect(uncoveredPlaintextFiles([f('a')], [])).toEqual([f('a')]);
  });
});
