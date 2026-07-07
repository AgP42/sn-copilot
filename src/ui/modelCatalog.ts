// Curated per-provider model lists for the Settings model picker.
//
// This is a convenience shortlist, NOT an allow-list — the picker
// always keeps a free-text field so a brand-new model id works the
// moment the provider ships it (matching the plugin's no-allow-list
// philosophy). The list only saves the user from typing (and
// mistyping — a wrong-cased id yields a cryptic HTTP 404).
//
// `vision: false` marks text-only entries (the page image won't be
// sent). Keep this file current — model ids churn.
//
// Verified 2026-07-07 against each provider's live model docs.

import type {ProviderId} from '../types';

export type CatalogEntry = {
  id: string;
  // Short human label for the button; the id is shown beneath it.
  label: string;
  vision: boolean;
  // Optional one-word tag (e.g. "cheap", "legacy") shown as a hint.
  note?: string;
};

export const MODEL_CATALOG: Record<ProviderId, CatalogEntry[]> = {
  anthropic: [
    {id: 'claude-haiku-4-5', label: 'Haiku 4.5', vision: true, note: 'cheap'},
    {id: 'claude-sonnet-5', label: 'Sonnet 5', vision: true},
    {id: 'claude-opus-4-8', label: 'Opus 4.8', vision: true, note: 'best'},
    {id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', vision: true},
  ],
  openai: [
    {id: 'gpt-4o-mini', label: 'GPT-4o mini', vision: true, note: 'cheap'},
    {id: 'gpt-4o', label: 'GPT-4o', vision: true},
    {id: 'gpt-5.4-mini', label: 'GPT-5.4 mini', vision: true},
    {id: 'gpt-5.5', label: 'GPT-5.5', vision: true, note: 'best'},
  ],
  gemini: [
    {id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', vision: true, note: 'cheap'},
    {id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', vision: true, note: 'best'},
    {id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', vision: true},
  ],
  deepseek: [
    {id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', vision: false, note: 'text-only'},
    {id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', vision: false, note: 'text-only'},
  ],
};

export const catalogFor = (provider: ProviderId): CatalogEntry[] =>
  MODEL_CATALOG[provider] ?? [];
