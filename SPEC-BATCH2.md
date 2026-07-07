# SPEC Batch 2 — sn-copilot (fork AgP42)

Document de travail local — à relire et amender avant tout code.
État de référence : batch 1 (PR1-PR6) + batch 1.1 codés localement,
testés sur Nomad. Rien n'a été poussé publiquement.

---

## 0. Principes

- **Deux pistes** : Track A = corrections/améliorations destinées à
  l'upstream (PRs indépendantes, avec tests, style de l'auteur) ;
  Track B = features du fork AgP (upstreamables plus tard si accueil
  favorable).
- **Code only après validation de cette spec.** Chaque item ci-dessous
  a : comportement cible, cas limites, fichiers touchés, tests, statut.
- **Aucun push sans go explicite.** Textes de PR relus avant envoi.
- L'approche vis-à-vis de l'auteur : ouvrir des **issues d'abord** pour
  les bugs majeurs (T18 avec le log de debug comme preuve, T7), les PRs
  ensuite — ça établit le contact et évite les PRs surprises.

---

## Track A — PRs upstream

### A1 — Suppression des PNG scratch [CODÉ ✅ batch 1]
Chaque ouverture du panneau laissait un screenshot de page sur disque,
pour toujours. Fix : suppression post-lecture + purge des orphelins au
boot. **Reste à faire :** rien. PR prête.

### A2 — Historique multi-tours texte [CODÉ ✅ batch 1, validé device]
ProviderRequest.history + normalisation (alternance stricte, cap 10
messages, troncature 4000 chars/tour, redaction DeepSeek). **Reste à
faire :** rien pour la version texte. La continuité d'IMAGE arrive en
A9/B1 (dépend du caching). PR prête.

### A3 — max_tokens configurable + observabilité [CODÉ ✅ batch 1+1.1]
Parse `max_tokens=` (16-8192), survie vault/write-back, ligne explicite
dans les templates, affichage "Reply cap" dans Settings. **Reste à
faire :** T23 — rendre la valeur ÉDITABLE dans Settings (même mécanique
que le modèle A4 : write .txt en plaintext, rewriteVault en encrypted).
Cas limites : valeur hors bornes saisie dans l'UI → erreur inline, pas
de write. Fichiers : SettingsView, secureFlows (changeMaxTokens ou
généralisation de changeModel en changeKeyFileField). Tests : UI +
flows, les deux modes.

### A4 — Modèle éditable partout + sélecteur [CODÉ ✅ partiel]
Batch 1+1.1 : édition texte libre en modes unlocked ET plaintext.
**Reste à faire :** T22 — dropdown de modèles curés PAR PROVIDER +
champ libre conservé :
- anthropic : claude-haiku-4-5, claude-sonnet-5, claude-sonnet-4-6,
  claude-opus-4-8, claude-opus-4-7, claude-opus-4-6
- openai : gpt-4o-mini, gpt-4o (champ libre pour gpt-5*/o*)
- gemini / deepseek : liste à vérifier au moment du code
UI : liste de boutons radio (pas de vrai dropdown natif RN simple sur
e-ink) + champ "autre". La liste vit dans un module `modelCatalog.ts`
avec date de mise à jour en commentaire. Cas limites : modèle inconnu
saisi → accepté tel quel (pas d'allow-list, philosophie upstream).
Tests : rendu, sélection → save → vault/.txt.

### A5 — Nonces GCM natifs [CODÉ ✅ batch 1]
PR prête. Argumentaire : l'historique de conversations réutilise la
clé dérivée → le raisonnement "nonce unicité suffit" ne tient pas.

### A6 — PluginJanitor [CODÉ ✅ batch 1, validé device]
PR prête. Crédit dashboard/FINDINGS.md dans le texte.

### A7 — buildPlugin.sh fail-fast [À CODER]
Cible : si `build_android_apk` échoue → exit 1 immédiat, AVANT le
paquetage. + Vérification post-build : si reactPackages non vide,
le PluginConfig.json empaqueté DOIT contenir nativeCodePackage, sinon
exit 1 avec message explicite. Cas limites : projets sans natif
(should_build_native=1) → pas de vérif npk. Fichiers : buildPlugin.sh
(et .ps1 pour parité Windows — l'auteur build sur Mac/Windows).
Tests : pas de harness bash upstream ; description de repro dans la PR
(JAVA_HOME absent → avant : zombie ; après : échec franc).

### A8 — Fix boucle unlock/merge (T18) + sortie Unlock (T19) [PARTIEL]
Batch 1.1 a livré : bouton ✕ (T19 ✅), erreurs de merge visibles,
copilot-debug.log. **Reste à faire (le cœur) :** la coexistence
vault + .txt doit fonctionner — garder le fichier est un chemin
supporté par l'UX du plugin.
Cible : au refresh, si les fichiers plaintext découverts sont un
SOUS-ENSEMBLE du contenu du vault (comparaison provider+key+model+
options par provider), l'état est 'locked' (ou 'unlocked' si clé en
mémoire) et non 'merge'. 'merge' ne se déclenche que si un .txt
apporte quelque chose de nouveau/différent. Après merge réussi, offrir
(pas imposer) la suppression du .txt, et NE PLUS re-gater si refusé.
Cas limites : .txt modifié pendant session unlocked → merge proposé au
prochain refresh ; .txt avec provider absent du vault → merge ; vault
corrompu + .txt sain → flux reset actuel.
Fichiers : useCopilotState (calcul d'état), CopilotPanel (post-merge),
tests useCopilotState + CopilotPanelUnlock (le scénario du user :
encrypt → keep file → relaunch → unlock → CHAT, pas re-unlock).
PR accompagnée de l'issue avec extraits du debug log.

### A9 — Prompt caching [À CODER — gain massif, indépendant]
Le plugin ne met RIEN en cache : chaque tour repaye système + histoire
+ (bientôt) images plein tarif.
Cible minimale (PR upstream propre) :
- anthropic.ts : cache_control ephemeral sur le system prompt + sur le
  dernier tour d'historique (auto-cache top-level = plus simple :
  `cache_control: {type: "ephemeral"}` au niveau requête).
- openai/deepseek : caching implicite côté serveur, rien à faire.
- gemini : implicit caching OK, rien à faire (vérifier au code).
Contraintes : préfixe stable → l'ordre system→history→message actuel
convient ; min cacheable 4096 tokens (haiku/opus) → pas de cache hit
sur micro-conversations, inoffensif. Vérif : usage.cache_read_input_
tokens loggé dans infoLog réponse. Tests : forme du body (blocs
cache_control présents), pas de tests réseau.

---

## Track B — Fork AgP (upstream possible ensuite)

### B1 — T-CTX : le contexte repensé [LE GROS MORCEAU]
Décisions actées :
1. **Vignette cliquable** de la capture de page courante dans le
   panneau, désélectionnée par défaut pour les messages libres.
   Sélectionnée → l'image part avec le message. Quick actions :
   TOUJOURS auto-attach (option A actée).
2. **Mémoire d'images** : une image jointe entre dans l'historique de
   conversation et est REJOUÉE aux tours suivants (ProviderTurn étendu
   avec `imageBase64?`). Cap : 3 images max en historique (les plus
   récentes), au-delà on droppe les anciennes. Dépend de A9 (caching)
   pour la viabilité économique. DeepSeek : images jamais rejouées
   (texte seul).
3. **Sélecteur multi-fichiers** : bouton 📎 → mini-explorateur
   (réutiliser la logique browser du dashboard AgP) → sélection de :
   - autres pages du fichier courant (rendus PNG à la volée),
   - fichier entier : PDF → document block natif Anthropic (≤32MB ;
     ≤100 pages sur Haiku 200K, ≤600 sur modèles 1M) ; .note → N PNG
     (plafond N=10, message sinon) ; .txt/.json/.md → texte inline
     (plafond 100KB) ; images → image blocks.
   - Estimation affichée avant envoi (approx tokens : image ~1600,
     texte len/4, PDF pages×~2000) + confirmation si > seuil (~20k).
   OpenAI/Gemini : PDF support à vérifier au code ; fallback N images.
   DeepSeek : texte extrait seulement.
4. **Fraîcheur** (T8, déjà codé batch 1.1) : conservée — la vignette
   affiche toujours la page COURANTE (re-capture si page changée).
   La regex contextRouting devient obsolète pour l'attachement ; les
   patterns FR restent sans effet nocif (nettoyage optionnel).
Étapes internes (ordre) : B1a vignette+toggle ; B1b image en
historique ; B1c multi-pages ; B1d fichiers externes.
Tests : composePrompt/history étendus, providers (image blocks en
historique), UI vignette, sélecteur.
Candidat upstream : oui à terme, précédé d'une issue RFC chez l'auteur.

### B2 — T12 : personas par dossier [PETIT]
Mapping préfixe de chemin → fichier persona :
`MyStyle/SnCopilot/personas.txt` format `prefixe: fichier_persona.txt`
(ex. `Note/pro: persona_pro.txt`). Résolution au moment du send via
PageContext.notePath ; fallback system_prompt.txt puis prompt intégré.
Cas limites : préfixes imbriqués → le plus long gagne ; fichier
manquant → fallback + warn log. Tests : résolution pure + intégration.

### B3 — T13 : routage multi-modèle par tâche [MOYEN]
`model_chat=` et `model_bulk=` optionnels dans le key file (fallback
`model=`). Grill/regenerate/judge/rephrase → bulk ; chat → chat.
Tests : plumbing. UI Settings : affichage des deux.

### B4 — T11 : fenêtre flottante [GROS, dernier]
Déplaçable (drag sur le header), redimensionnable (poignée coin),
plein écran (bouton), repliable en bulle (mécanique dashboard AgP).
Kotlin : WindowManager.updateViewLayout sur drag/resize ; état persisté
(prefs). Spec détaillée à faire au moment de l'attaquer — dépendra de
ce qu'on apprend en B1 sur CopilotOverlayModule.

---

## Ordre d'exécution proposé

1. **Repackaging batch 1.1 → branches PR propres** (T15→A3, T17/T21→A4,
   T19+debug→A8, T8 freshness → reste en fork jusqu'à B1). Chaque
   branche : verte seule (tests + tsc + lint + coverage ≥97%).
2. **A7** (build script) et **A9** (caching) — nouveaux, petits, forts.
3. **A8 cœur** (état merge) — le bug le plus grave upstream.
4. **A3 reste** (T23 éditable) + **A4 reste** (T22 dropdown).
5. → **Point de synchro : issues + première vague de PRs upstream**
   (A1, A2, A5, A6 prêtes ; A7, A9 rapides) après ton go.
6. **B1a→B1d** (T-CTX) sur le fork, build de test à chaque sous-étape.
7. **B2**, **B3**, puis **B4**.

## Questions ouvertes (à trancher à la relecture)

Q1. Vague upstream : tout d'un coup (6-8 PRs) ou 2-3 d'abord pour
    tester la réactivité de l'auteur ?
Q2. A8 : d'accord pour l'issue publique AVANT la PR (avec ton log
    anonymisé) ?
Q3. B1b : cap de 3 images rejouées en historique — OK ou tu veux plus ?
Q4. Versionnage fork : rester en 1.0.x-agpN pour les builds de test,
    ou passer à un schéma 1.1.0-fork ?
Q5. La liste Gemini/DeepSeek de B2/A4 : je vérifie les IDs au moment
    du code (web) — OK ?

---

## Réponses à la relecture (2026-07-07)

Q1 : 2-3 PRs d'abord → VAGUE 1 = A1 (scratch) + A6 (janitor) + A9
     (caching). Processus confirmé : master + ces 3 fixes seulement →
     build de test device → validation user → PRs → ensuite le reste
     continue côté fork. AUCUNE PR sans go explicite.
Q2 : pas d'issue préalable — PR directe (pour A8/T18 plus tard).
Q3 : cap images en historique = 5.
Q4 : versionnage 1.0.x pour les builds de test (schéma actuel).
Q5 : IDs Gemini/DeepSeek vérifiés au moment du code (implicite).
