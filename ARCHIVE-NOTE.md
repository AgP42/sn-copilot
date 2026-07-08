# Fork archive — AgP42/sn-copilot (v1.1.2)

Point d'archive du fork avant pivot vers un nouveau plugin
(architecture repensée). Dernière version stable et testée sur device
(Manta A5X2) : **1.1.2**.

## Ce que ce fork ajoute au code de j-raghavan/sn-copilot

Envoyé upstream (PRs #4-#7, en attente) :
- Suppression des PNG scratch après capture + purge orphelins au boot.
- Contexte multi-tours (historique texte rejoué au provider).
- PluginJanitor (purge des versions empilées au boot).
- Prompt caching Anthropic (cache_control ephemeral).

Gardé local sur le fork (non proposé upstream) :
- Fraîcheur de capture (recapture si page changée).
- Édition modèle + max_tokens dans Settings (mode plaintext), avec
  sélecteur de modèles curé par provider (modelCatalog.ts) et champ
  libre. Messages d'erreur 404/401 parlants.
- Auto-scroll du chat vers la dernière réponse.
- T-CTX B1a : vignette de page cliquable + toggle d'attachement
  (remplace la gate regex par un contrôle explicite), rafraîchie à la
  demande. Quick actions toujours auto-attach. Badge text-only pour
  DeepSeek.

Chiffrement/vault : **code original de l'auteur** (mes modifs
abandonnées après des bugs device — voir TOPICS-AGP.md T18/T24).

## Ce qui n'a PAS été fait
T-CTX B1b (mémoire d'image rejouée), B1c (multi-pages), B1d (fichiers/
PDF natif), T12 personas par dossier, T13 multi-modèle, T11 fenêtre
flottante. Voir SPEC-TCTX.md et SPEC-BATCH2.md.

## Tags
- `fork-stable-1.0.12` : base plaintext + config, avant T-CTX.
- `fork-archive-1.1.2` : cet état (B1a inclus).

## Docs de travail
TOPICS-AGP.md (collecte T7-T27), SPEC-BATCH2.md, SPEC-TCTX.md,
PR-TEXTS.md (textes des PRs envoyées).
