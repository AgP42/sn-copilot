# Textes de PR — wave 1 (à relire avant tout envoi)

Cible : j-raghavan/sn-copilot, base `master`, depuis les branches du
fork AgP42/sn-copilot. Ordre d'ouverture suggéré : 1, 2, 3, 4.
Note : PR2 et PR4 touchent toutes deux `anthropic.ts` — si les deux
sont acceptées, la seconde mergée aura un conflit trivial (une ligne) ;
signalé dans le texte de PR4.

---

## PR 1 — branche `pr1-scratch-cleanup`

**Titre :** Delete scratch page PNGs after capture + sweep orphans at bootstrap

**Corps :**

Every sidebar tap renders the current page to
`copilot-page-<timestamp>-<n>.png` in the plugin directory (or the
shared `/sdcard/Android/data` fallback) and never deletes it. Two
consequences:

- **Privacy:** the scratch directory accumulates a permanent, plaintext
  archive of every page the user ever opened Copilot on — even when the
  key vault is encrypted.
- **Storage:** one full-page PNG per panel open, forever.

Changes:

- `captureScreenshot` takes an optional `deleteFile` dep (wired to
  `FileUtils.deleteFile` in production). The PNG is discarded as soon
  as its bytes are base64'd — on success, on read failure, and on the
  partial-file case when the render itself fails. Deletion is
  best-effort: capture never fails because cleanup did.
- `sweepScratchOrphans` runs fire-and-forget at bootstrap and removes
  files left behind by crashes or by plugin versions that predate
  per-capture deletion. The filename match is anchored
  (`copilot-page-<digits>-<digits>.png`), so nothing user-owned can
  ever match — safe even on the shared fallback path.
- `PageContext.screenshotPath` is kept for type stability; no consumer
  re-reads the file (the base64 field is the only use).

Tests: 13 new cases (deletion on both capture paths and all failure
modes, sweep filtering/robustness, bootstrap wiring). Suite green,
coverage thresholds kept.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

---

## PR 2 — branche `pr2-multiturn-context`

**Titre :** Send prior conversation turns to the provider (multi-turn context)

**Corps :**

Every send currently goes out as a single isolated message — the model
never sees its own earlier replies, so follow-ups like *"expand on
point 2"* or *"tell me more"* get answered with "I don't see any
previous context". The chat UI shows a conversation; the wire never
carries one.

Changes:

- `ProviderRequest.history?: ProviderTurn[]` — prior turns, oldest
  first. Absent/empty keeps the exact single-turn wire shape, so
  nothing changes for callers that don't opt in (Grill, Test
  Connection).
- New pure module `providerHistory.ts` normalises the on-screen
  message list for the wire: drops `thinking` placeholders and empty
  texts, caps at the 10 most recent messages, truncates over-long
  turns (4000 chars, head kept), and enforces user-first + strict
  role alternation — Anthropic's Messages API rejects anything else,
  and merging consecutive same-role turns also covers the
  failed-send-left-two-user-messages case.
- All four clients map history 1:1 onto their native message arrays
  (Gemini renames assistant → `model`); `fakeProvider` ignores it.
- ChatView snapshots the prior turns *before* appending the new user
  message (it travels as `userText`; snapshotting later would double
  it once the re-render lands) and reads through a ref so the
  memoized send callback sees the current list without widening its
  dep array. On the DeepSeek path, replayed turns get the same
  `redactPii` scrub as the current text.

History replay is text-only by design: page context from earlier turns
is not resent and no image rides along — the token cost per send stays
bounded (≤10 short turns).

Tests: 10 new cases for the normaliser, 5 wire-shape cases across the
four clients (+ omitted-history regression check). Suite green,
coverage thresholds kept. Verified on-device (Nomad): follow-up
questions now build on the previous answer.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

---

## PR 3 — branche `pr6-plugin-janitor`

**Titre :** PluginJanitor: prune stale plugin versions at bootstrap

**Corps :**

PluginHost keeps every past version's files (`app_<ts>.npk`,
`app_<ts>_libs/`, compiled `oat/` artifacts) in the plugin directory
on reinstall, and nothing ever prunes them — the plugin's on-device
footprint grows by its full size (~7 MB) with every update, forever.
Since the plugin runs inside the PluginHost process, it can clean up
after itself: keep the newest timestamp (the running version), drop
the rest.

Changes:

- `CopilotOverlayModule.cleanupOldVersions(dirPath)`: sweeps
  `app_<ts>*` entries older than the newest `.npk`, plus their `oat/`
  artifacts; resolves `{success, freedBytes, kept}`. Defensive: no
  `.npk` found (fresh install layout) → no-op.
- JS wrapper mirrors the other bridge methods (structured
  `MODULE_MISSING` result, never rejects).
- `index.js` fires it at bootstrap, fire-and-forget, with
  `PluginManager.getPluginDirPath()`; logs KiB freed when > 0. A
  janitor failure can never block bootstrap.

The cleanup recipe is adapted from the Dashboard plugin's janitor
(AgP42); the underlying PluginHost behaviour is documented in
https://github.com/AgP42/supernote-dashboard/blob/main/docs/FINDINGS.md.

Tests: wrapper (forwarding, missing module, missing method) and
bootstrap wiring (dir passed, failure survival, skip when dir
unavailable). Suite green. Verified on-device (Nomad): storage stays
flat across repeated reinstalls.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

---

## PR 4 — branche `pr9-prompt-caching`

**Titre :** Enable Anthropic prompt caching on every chat request

**Corps :**

The plugin currently sends every request uncached: the system prompt
and the page image (both of which precede the user's text in the
request body) are billed at the full input rate on every send of a
session.

Changes:

- `anthropic.ts` adds the top-level auto-caching parameter
  (`cache_control: {type: "ephemeral"}`): the API places a cache
  breakpoint on the last cacheable block automatically. On a
  page-anchored session the stable prefix — system prompt + page
  image (~2k+ tokens) — is repriced at ~10% of the input rate on
  subsequent sends. Below the model's minimum cacheable size the
  parameter is silently ignored (never an error), so it is safe to
  send unconditionally. No key-file option needed.
- Cache accounting (`cache_read_input_tokens`,
  `cache_creation_input_tokens`) is mapped into
  `ProviderResponse.usage`, so the effect is verifiable and future
  UI/logging can surface it.
- OpenAI and DeepSeek cache automatically server-side; Gemini has
  implicit caching — no changes needed for those clients.

Verified on-device against the Anthropic usage dashboard: cache-read
tokens appear from the second send of a session.

Note: this touches the same request-body literal as the multi-turn PR
(#2); whichever lands second has a one-line trivial conflict. The two
compose well — replayed history extends the cached prefix, so longer
conversations save proportionally more.

Tests: 3 new wire/usage-mapping cases. Suite green, coverage kept.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
