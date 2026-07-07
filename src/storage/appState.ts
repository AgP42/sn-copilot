// Pure function that decides what UI to render based on the
// observable facts at startup (and whenever the user takes an action
// that changes them).
//
// Inputs are snapshots — IO is the caller's job. This keeps the
// decision logic 100% unit-testable and means CopilotPanel can be a
// thin orchestrator over `computeAppState`.
//
// State machine:
//
//   no-key        → no vault file AND no plaintext .txt files.
//   plaintext     → no vault, plaintext files exist, mode='plaintext'.
//                    (today's behaviour; also chosen for 'undecided'
//                    + plaintext when the user is in the chat sidebar
//                    and we don't want to interrupt them — the
//                    Settings cog surfaces the migration prompt.)
//   migrate       → vault doesn't exist, plaintext files exist, and
//                    mode='undecided'. Show MigrationPrompt.
//   merge         → vault exists AND plaintext files exist with
//                    content NOT already covered by the vault
//                    (rotation / new provider added). Show unlock
//                    first; the merge happens in the unlock callback.
//                    A plaintext file whose entries are already in
//                    the unlocked vault does NOT trigger merge —
//                    keeping the .txt after encrypting is a supported
//                    path ("Skip — I'll delete it manually"), and
//                    before this rule the state machine looped on the
//                    unlock screen forever with a correct PIN.
//   locked        → vault exists, no plaintext, no in-memory key.
//   unlocked      → vault exists and in-memory key is loaded.

import type {EncryptionMode, KeyFile} from '../types';

export type AppState =
  | {kind: 'no-key'}
  | {kind: 'plaintext'; files: KeyFile[]}
  | {kind: 'migrate'; files: KeyFile[]}
  | {kind: 'merge'; vaultExists: true; plaintextFiles: KeyFile[]}
  | {kind: 'locked'}
  | {kind: 'unlocked'; files: KeyFile[]};

export type AppStateInputs = {
  vaultExists: boolean;
  plaintextFiles: KeyFile[];
  encryptionMode: EncryptionMode;
  unlockedFiles: KeyFile[] | null;
};

// Semantic equality for "is this plaintext entry already in the
// vault?". sourcePath is ignored (the vault copy legitimately keeps
// the path it was imported from). Every other field counts: a user
// who edits model= or clarify_redact= in the .txt expects a merge.
const isCovered = (file: KeyFile, vaultFiles: KeyFile[]): boolean =>
  vaultFiles.some(
    v =>
      v.provider === file.provider &&
      v.key === file.key &&
      v.model === file.model &&
      v.defaultProvider === file.defaultProvider &&
      v.clarifyRedact === file.clarifyRedact,
  );

// Plaintext entries the unlocked vault does NOT already contain —
// the only ones that justify surfacing the merge flow. Exported for
// the unlock callback, which uses it to skip a redundant vault
// rewrite (a full PBKDF2 round) when everything is already covered.
export const uncoveredPlaintextFiles = (
  plaintextFiles: KeyFile[],
  vaultFiles: KeyFile[],
): KeyFile[] => plaintextFiles.filter(f => !isCovered(f, vaultFiles));

export const computeAppState = (i: AppStateInputs): AppState => {
  // Fast paths that don't depend on encryption mode.
  if (i.vaultExists && i.unlockedFiles !== null) {
    const uncovered = uncoveredPlaintextFiles(
      i.plaintextFiles,
      i.unlockedFiles,
    );
    if (uncovered.length > 0) {
      // A .txt landed (or changed) since last unlock and carries
      // content the vault doesn't have — surface the merge prompt so
      // the user can fold it in.
      return {
        kind: 'merge',
        vaultExists: true,
        plaintextFiles: uncovered,
      };
    }
    return {kind: 'unlocked', files: i.unlockedFiles};
  }
  if (i.vaultExists && i.plaintextFiles.length > 0) {
    return {
      kind: 'merge',
      vaultExists: true,
      plaintextFiles: i.plaintextFiles,
    };
  }
  if (i.vaultExists) {
    return {kind: 'locked'};
  }

  // No vault from here on.
  if (i.plaintextFiles.length === 0) {
    return {kind: 'no-key'};
  }

  if (i.encryptionMode === 'undecided') {
    return {kind: 'migrate', files: i.plaintextFiles};
  }
  // 'plaintext' OR 'encrypted' (the latter shouldn't happen — vault
  // doesn't exist yet — but we collapse it to plaintext rather than
  // showing nothing).
  return {kind: 'plaintext', files: i.plaintextFiles};
};
