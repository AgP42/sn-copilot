# Topics sn-copilot — collecte avant spec (batch 2)

Fichier de travail local AgP — non destiné au commit upstream.
Batch 1 (PR1-PR6) : codé, buildé, en cours de test device sur Nomad.

## Découverts pendant les tests du batch 1

### T7 — buildPlugin.sh : fail-fast quand gradle échoue
Constaté le 2026-07-06 : si `build_android_apk` échoue (ex: JAVA_HOME absent),
le script loggue "APK build failed" mais CONTINUE et empaquette un .snplg
zombie : app.npk périmé du build précédent + PluginConfig.json sans
`nativeCodePackage` (le champ n'est ajouté que par copy_apk_and_update_config,
jamais exécuté). Symptôme device : plugin installé, bouton visible, tap mort.
Fix : exit dur après "APK build failed" + (option) vérification post-build
que le config empaqueté contient nativeCodePackage quand reactPackages existe.

### T8 — Contexte de page périmé (stale capture)
Constaté le 2026-07-07 : la capture (screenshot + OCR) se fait UNE fois au
tap du bouton sidebar. Le panneau ne couvre que la droite de l'écran, on
peut tourner les pages en dessous → toute question suivante part avec la
page d'AVANT. Préexistant en 1.0.3 (design "captured at button-tap time"),
amplifié par PR2 (l'historique restauré parle aussi de l'ancienne page).
Fix proposé : freshness check à l'envoi — comparer getCurrentFilePath +
getCurrentPageNum avec le ctx stocké ; si différent, recapturer (le
placeholder "thinking" absorbe la latence). Nécessite d'exposer un
"refresher" dans pageContext + wiring index.js.

### T9 — Heuristique page-referential anglophone uniquement
contextRouting.isPageReferential : regex EN seulement. "Résume cette page"
ne matche pas → aucun contexte attaché en freeform français → le modèle
répond depuis l'historique. Fix : ajouter patterns FR (résume, explique,
cette page/note, ce document, traduis, qu'est-ce que...) — et/ou inverser
la politique par défaut (default-attach est déjà la philosophie déclarée
du module, mais la liste de patterns fait office de gate en pratique...
à trancher en spec).

## Feedback tests device du 2026-07-07 (Nomad)

### T14 — Continuité de l'image dans la conversation
Test smiley : 1re question → le modèle voit le dessin ; question suivante
"c'est quoi cette image" → "je ne vois pas d'image". Causes combinées :
(a) design PR2 : l'historique rejoué est texte-seul, l'image n'est JAMAIS
renvoyée aux tours suivants (économie de tokens) ; (b) T9 : la question FR
ne matche pas l'heuristique → pas de nouvelle capture attachée non plus.
Spec à trancher : rattacher la capture courante à chaque tour d'une
conversation "ancrée page" ? rejouer la dernière image ? fusionner avec
T8/T9 ?

### T15 — Ligne max_tokens dans les templates
Fait en PR3 mais en COMMENTAIRE ; demande utilisateur : ligne exemple
claire. + vérifier que le README l'explique au bon endroit.

### T16 — max_tokens semble inopérant sur device (à investiguer)
Séquence testée : 0 (invalide → défaut attendu) → tronque court ; "ggg"
(invalide → défaut attendu) → encore plus court ; 1024 → même taille.
Hypothèses : (a) cycle de re-lecture du key file — quand la discovery
est-elle relancée ? éditer le .txt panneau ouvert n'a aucun effet ;
(b) période où le vault chiffré ignorait les .txt (avant sa réinstall) ;
(c) variance naturelle des réponses interprétée comme troncature.
Spec : afficher le max_tokens ACTIF dans Settings (observabilité) +
documenter/forcer le moment de re-lecture.

### T17 — Modèle éditable SANS chiffrement (demande utilisateur forte)
PR4 ne couvre que le mode vault. L'utilisateur veut éditer le modèle en
mode plaintext aussi → écrire back dans le .txt (le plugin sait déjà le
faire : writeBack du flux disable-encryption).

### T18 — BLOQUANT UPSTREAM : le déverrouillage du vault ne marche pas
sur device. Chiffrement OK, mais l'écran "Unlock copilot" refuse le bon
PIN. C'est LA raison historique pour laquelle l'utilisateur n'utilisait
pas le chiffrement. Encrypt (PBKDF2 natif) passe, unlock (même chemin
natif) échoue → mystère ; pas d'adb sur Nomad → prévoir un moyen de
diagnostic (log fichier temporaire ? tester sur A5X ? relire PinSetup/
UnlockScreen pour divergence de normalisation du PIN saisi ex. trim,
type clavier, IME e-ink).

### T19 — UX trap : l'écran Unlock n'a pas de sortie
Impossible de fermer le panneau depuis "Unlock copilot" (Settings caché
par design, pas de ×) → si le PIN échoue (T18), l'utilisateur doit
REDÉMARRER le Supernote et réinstaller. Il faut un bouton fermer + le
"Forgot PIN" (5 échecs) doit rester accessible.

### T20 — Indicateur de contexte en tête de panneau
Demande utilisateur : afficher clairement en haut du chat l'image/la page
actuellement attachée à la conversation (vignette ou libellé fichier+page),
et permettre de déclencher une nouvelle capture. Se combine avec T8
(fraîcheur) et T10 (multi-pages).

### T21 — PR4 : champ modèle pas éditable après chiffrement (bug batch 1)
Sur device, après encrypt, le champ Model est resté read-only. Hypothèse :
le .txt d'origine n'a pas été supprimé → useCopilotState est en état
'merge' (vault + plaintext coexistent), pas 'unlocked' → ma condition
`state.kind === 'unlocked'` ne s'applique pas. À corriger avec T17 de
toute façon (éditable dans tous les modes).

## Reportés du 1er échange (features fork AgP)

### T10 — Contexte multi-pages
Envoyer plusieurs pages (plage/sélection) en une requête pour réponse
globale. Multi-image (pas PDF : Anthropic rasterise de toute façon, coût
identique, dépendance en plus). Questions spec : UI de sélection, plafond
de pages, coût.

### T11 — Fenêtre flottante
Déplaçable, redimensionnable, plein écran, repliable en bulle (mécanique
dashboard). Gros chantier UI natif.

### T12 — Profils de system prompt par dossier
`perso/` → persona A, `pro/` → persona B. Mapping préfixe de chemin →
fichier persona. Le chemin courant est déjà dans PageContext.notePath.

### T13 — Routage multi-modèle par tâche
Chat premium / tâches bulk (Grill, résumés) cheap. La couche provider
prend déjà {apiKey, model} par appel. Version future.

## Statut tests batch 1 (Nomad, 2026-07-07)

- Lancement : OK (après fix builds zombies T7)
- PR2 multi-tours : OK sur le texte ("marche bien") ; MAIS continuité
  d'image absente (T14) et restauration de conversation + capture figée
  troublantes (T8/T20).
- PR3 max_tokens : NON CONCLUANT sur device → T16.
- PR4 modèle éditable : ÉCHEC sur device → T21 ; demande élargie → T17.
- PR6 janitor : OK.
- PR5/vault : chiffrement OK mais unlock CASSÉ upstream → T18, T19.
- PR1 : non observable directement sur device (pas d'accès au dossier
  privé) ; capture fonctionne (le smiley est vu au 1er tour).

## Dette batch 1.1 (à régler en phase PR)
- Couverture branches 96.72% vs seuil CI 97% : quelques branches des
  nouveaux chemins (kdf/randomBytes fallbacks préexistants + poignée
  de branches index.js/captureScreenshot). À compléter au découpage
  en PRs propres.

## Feedback tests batch 1.1 (Nomad, 2026-07-07 après-midi)

### T18 — CONFIRMÉ par copilot-debug.log : la crypto est INNOCENTE
Log récupéré via MTP :
  12:35:21 [unlock] attempt len=8 digitsOnly=true state=merge → ok
  12:35:22 [unlock] merge files=1 → ok   (idem à 12:38)
Le PIN est bon, le déchiffrement réussit, le merge réussit. Le bug est
la machine à états : après un merge réussi, le copilot-key-*.txt reste
sur le disque → au refresh/réouverture, useCopilotState voit vault +
plaintext → état 'merge' → écran Unlock à nouveau. Boucle infinie avec
un PIN correct. Fix spec : après merge réussi, proposer la suppression
du .txt (comme le flux encrypt initial), et/ou ne plus gater le chat
quand le plaintext est identique au contenu du vault. Bug upstream.

### T8/T9 — VALIDÉ sur device
"Si je change de page (sans reload) puis ouvre une nouvelle
conversation, c'est bien le new context qui est pris en compte."
Screenshot smiley (16:50) : la question "c'est quoi ca ?" du test
précédent ne matchait pas les patterns FR (« ca » sans cédille non
couvert par c'?est quoi (ça|ceci|cette|ce)) → renforcer T9 : variantes
sans accents (ca, ça), et/ou politique attach-par-défaut quand une
conversation a déjà du contexte page.

### T22 — Sélecteur de modèle : dropdown + champ libre
Demande : liste déroulante de modèles valides par provider + champ
libre pour les tout derniers modèles. Spec : liste curée embarquée
(à maintenir) ou fetch de l'API /v1/models du provider (Anthropic
l'expose ; OpenAI aussi ; à voir par provider). Champ libre conservé
(le plugin ne doit pas allow-lister, philosophie upstream).

### T23 — max_tokens éditable dans Settings
Comme le modèle (T17) : édition directe dans l'UI, écrit dans le .txt
(plaintext) ou le vault (encrypted). L'affichage read-only "Reply cap"
du batch 1.1 devient un éditeur.

## Décisions de spec (retour utilisateur, 2026-07-07 soir)

### T9 — REDÉFINI : tuer la gate regex, pas la rafistoler
Clarification : la regex n'est PAS la compréhension du LLM — c'est un
pré-filtre de l'AUTEUR qui décide si le screenshot de page est JOINT à
la requête (économie de tokens image + privacy : ne pas envoyer la
page manuscrite quand on demande une blague). Le LLM comprend tout ;
mais si la gate rate, il ne REÇOIT pas l'image → "je ne vois pas
d'image". Verdict utilisateur : inacceptable de dépendre de la
formulation. Cible spec :
  - le contexte de page doit partir PAR DÉFAUT (philosophie déclarée
    du module upstream, jamais vraiment appliquée),
  - contrôle VISIBLE et explicite dans le panneau : indicateur
    "page jointe : fichier p.N" + toggle on/off (fusion avec T20),
  - la regex peut rester comme optimisation pour ne pas joindre sur
    les cas manifestement génériques, mais ne doit plus jamais être
    la condition d'attachement d'une conversation ancrée page.

### T18 — REDÉFINI : la coexistence vault + .txt doit fonctionner
Le plugin propose lui-même "Skip — I'll delete it manually" au moment
du chiffrement → garder le .txt est un chemin SUPPORTÉ. Le fix ne
peut donc pas être "supprimer le fichier". Cible spec : après
unlock+merge réussi, si le contenu plaintext est déjà inclus dans le
vault (même provider/clé/modèle), passer directement au chat
déverrouillé — l'état 'merge' ne doit se déclencher que quand le .txt
diffère réellement du vault. Suppression du .txt = simple suggestion.

### T22 — VALIDÉ : liste curée de modèles
Anthropic : claude-haiku-4-5, claude-sonnet-5, claude-sonnet-4-6,
claude-opus-4-8, claude-opus-4-7, claude-opus-4-6 (tous vision).
Éviter claude-fable-5 (cher + refus safety = réponses vides dans ce
plugin). OpenAI : gpt-4o-mini, gpt-4o (+ champ libre pour gpt-5*/o*).
Gemini/DeepSeek : à vérifier au moment du code. Dropdown + champ
libre toujours présent (pas d'allow-list dure, philosophie upstream).

## Spec clarifiée : le CONTEXTE (fusion T8/T9/T10/T14/T20 → "T-CTX")

Principe validé avec l'utilisateur le 2026-07-07 :

1. VIGNETTE SÉLECTIONNABLE. Le panneau affiche une miniature de la
   capture de page courante. Le user CLIQUE pour la joindre au message ;
   désélectionnée par défaut. Remplace la gate regex (supprimée comme
   condition d'attachement). DÉCIDÉ (option A, 2026-07-07) : les quick
   actions (Summary/Explain/Clarify/Snapshot + customs) joignent
   TOUJOURS la capture automatiquement, sans regarder le toggle — le
   toggle ne gouverne que les messages tapés en champ libre.

2. MÉMOIRE D'IMAGES = HISTORIQUE REJOUÉ + PROMPT CACHING.
   L'API est stateless ; "se souvenir" d'une image = la renvoyer dans
   l'historique à chaque requête. Design cible :
   - l'image jointe entre dans l'historique de conversation (comme les
     tours texte du PR2) et est REJOUÉE aux tours suivants → le modèle
     "voit" toujours le smiley au tour 2 sans re-capture ;
   - activer cache_control (Anthropic) sur le préfixe de conversation →
     l'historique rejoué (images comprises) coûte ~10% au lieu de 100%.
     Le plugin n'utilise AUCUN caching aujourd'hui — gros gain upstream
     indépendant du reste (PR candidate à part entière) ;
   - cap raisonnable d'images en historique (ex. 3-5 dernières), au-delà
     on droppe les plus anciennes ;
   - min cacheable prefix Anthropic : 4096 tokens (haiku/opus) — une
     image ~1600 tokens + system suffit en général.
   - équivalents OpenAI (cache auto) / Gemini (implicit caching) : à
     vérifier au code ; DeepSeek : cache auto.

3. SÉLECTEUR DE CONTEXTE MULTI-FICHIERS. Le user peut joindre :
   - d'autres pages du fichier courant (plage ou sélection),
   - le FICHIER ENTIER : pour un PDF, l'envoyer NATIVEMENT (document
     block base64 Anthropic, ≤32MB, ≤600 pages sur modèles 1M, ≤100 sur
     Haiku 200K) — plus propre que N images ; pour un .note, N rendus
     PNG (pas d'export PDF via SDK à vérifier) ;
   - n'importe quel fichier du stockage : .txt/.json/.md inline en
     texte ; .pdf en document ; images en image blocks. UI type
     mini-explorateur de fichiers (le dashboard AgP a déjà un composant
     browser réutilisable pour NOTRE fork).
   Clarification : aujourd'hui, même sur un PDF, seule la page affichée
   part — le modèle ne voit jamais le document entier.

   Garde-fous : afficher une estimation de taille/coût avant envoi ;
   plafonds par provider ; DeepSeek = texte seul.

### T22bis — Erreur 404 doit pointer vers le modèle (2026-07-07, test A5X)
Incident : model=claude-Opus-4-8 (majuscule) dans le .txt → "anthropic:
HTTP 404" cryptique, l'utilisateur a suspecté le build. Spec : dans
sanitizeProviderError, cas 404 → message "HTTP 404 — model id probably
wrong, check Settings" ; le dropdown T22 prévient le problème à la
source.

### T24 — A5X gen-1 : overlay tactile mort après clavier système (PIN setup)
2026-07-07, test A5X gen-1 : écran "Create a PIN", PIN+Confirm saisis
(donc clavier système a marché), puis AUCUN bouton ne répond (Continue
affiche encore "Continue" pas "Working…" → le tap n'atteint pas le JS)
et Cancel non plus → user piégé, doit désinstaller/redémarrer. Fond OK.
- PinSetup.tsx NON modifié par le fork → bug upstream/firmware, pas nos
  changements crypto (qui afficheraient "Working…").
- Hypothèse : clavier système (IME) au-dessus de TYPE_APPLICATION_
  OVERLAY sur firmware gen-1 → l'overlay perd le focus tactile à la
  fermeture de l'IME. Le Manta (A5X2) ne semble pas affecté (encrypt
  y a marché).
- Pas d'adb sur gen-1 → dur à diagnostiquer à l'aveugle. Pistes :
  FLAG_NOT_FOCUSABLE vs focusable sur la LayoutParams de l'overlay ;
  ou éviter l'IME (saisie PIN via pavé custom dans l'overlay, comme le
  dashboard fait ses propres contrôles). À creuser SI l'A5X gen-1 doit
  être supporté — sinon documenter "PIN setup non fiable sur A5X gen-1,
  utiliser un clavier BT ou éditer le vault ailleurs".
- IMPACT UX transverse : un overlay qui piège l'utilisateur sans sortie
  est inacceptable ; au minimum, un bouton de fermeture d'urgence
  toujours réactif (mais si le tactile entier est mort, inutile...).
  Vraie mitigation = ne pas dépendre de l'IME système.

## DÉCISION (2026-07-07) : chiffrement DÉPRIORISÉ
Après 3 bugs successifs (T18 boucle unlock, T24 gel A5X gen-1, lock-on-
close absent), l'utilisateur décide de laisser tomber le chiffrement et
de se concentrer sur le fonctionnel utile. Conséquences :
- A8 (fix boucle unlock) reste CODÉ et testé mais N'EST PAS envoyé en PR
  upstream pour l'instant (pas prioritaire ; le comportement lock-on-
  close le rendrait de toute façon incohérent sans le fix associé).
- Ne plus investir sur T24 (pavé PIN custom) ni sur le lock-on-close.
- Le mode PLAINTEXT reste le mode d'usage réel → l'édition modèle /
  max_tokens en plaintext (A4/A3) est ce qui compte, pas le vault.
- Focus roadmap : T-CTX (contexte/images/multi-fichiers) = LA feature
  demandée, puis T22/T23 (petits gains visibles).

## CONTRAINTE FERME (prochaine version fork)
Revenir STRICTEMENT au code original de l'auteur sur toute la feature
chiffrement/vault. Cela signifie : `git checkout master --` sur tous les
fichiers touchés côté vault, et retirer proprement ce qui en dépend
côté nôtre. Fichiers à restaurer à l'identique master :
  - src/crypto/aesGcm.ts       (annuler nonces natifs A5/PR5)
  - src/storage/vault.ts       (annuler rewriteVault + maxTokens dans looksLikeKeyFile)
  - src/storage/secureFlows.ts (annuler changeModel/changeMaxTokens + uncovered)
  - src/storage/appState.ts    (annuler la règle uncovered A8)
  - src/storage/conversations.ts (annuler `await encrypt`)
  - src/storage/debugLogFile.ts  (SUPPRIMER — diag chiffrement)
  - src/ui/UnlockScreen.tsx      (annuler bouton ✕ + onClose)
  - src/ui/CopilotPanel.tsx      (annuler diag + uncovered ; garder le reste)
POINTS D'ATTENTION (dépendances non-chiffrement à préserver) :
  - keyFiles.ts : le parse `max_tokens=` (A3) est utile en PLAINTEXT →
    à conserver, MAIS il ajoute maxTokens à KeyFile que vault.ts valide.
    Si on revient au vault original, s'assurer que le champ optionnel
    ne casse pas la validation (l'original ignore les champs inconnus ?
    à vérifier — sinon garder juste le parse sans toucher au vault).
  - SettingsView.tsx : l'édition modèle/max_tokens en PLAINTEXT (A3/A4)
    est la feature utile → la garder, mais découplée du chemin vault
    (changeModel encrypted retiré, edit plaintext conservé).
  - Nonces GCM natifs (PR5/A5) : c'était une correction de SÉCURITÉ du
    vault. Si on revient à l'original, on réintroduit le nonce sync —
    acceptable puisque le vault n'est plus une cible de dev. PR #? déjà
    ouverte ? NON (A5 = pr5, pas dans la wave 1). OK, rien d'envoyé.
=> Faire une branche `fork-plaintext-only` propre : master + features
   NON-chiffrement uniquement (A1,A2,A6,A9 déjà upstream + A3/A4 plaintext
   + T-CTX + personas + multi-modèle). Repartir de là pour la suite.

### T25 — Chat ne scrolle pas en bas après réponse (vrai défaut UX)
2026-07-07 Manta : après une réponse, le ScrollView reste en haut, il
faut scroller à la main pour voir la fin. Fix : auto-scroll-to-end à
chaque nouveau message (ref sur le ScrollView + scrollToEnd dans un
effect sur messages, ou onContentSizeChange). Petit, sûr, ChatView.tsx.
FEATURE FONCTIONNELLE PURE, aucun rapport chiffrement — bon candidat.

### T26 — Édition modèle en mode chiffré casse (vault ≠ .txt)
Manta : édit modèle opus en mode unlocked → changeModel met à jour le
VAULT mais pas le .txt → au refresh, uncoveredPlaintextFiles voit
.txt(haiku)≠vault(opus) → état 'merge' → champ modèle non éditable +
affichage incohérent (haiku/1024). Interaction directe A8 ↔ changeModel.
=> Cohérent avec la décision d'abandonner le chiffrement : en mode
plaintext pur (pas de vault), l'édition modèle écrit le .txt, pas de
conflit. NE PAS corriger côté vault (on l'abandonne). Documenter :
disable encryption pour revenir en plaintext.

### T27 — max_tokens : plafond ≠ cible (malentendu, pas un bug)
1024 tokens → 16 lignes : normal, le modèle choisit sa longueur sous le
plafond. Pour rallonger : prompt ("réponds en détail") ou system prompt.
Piste UX : la ligne "Reply cap" pourrait être renommée/clarifiée, ou un
préréglage de style de réponse (bref/normal/détaillé) plus parlant que
des tokens. Nice-to-have.

### Ménage roadmap (2026-07-07)
- T9 (patterns FR) : RETIRÉ de la roadmap. Pansement déjà livré dans le
  fork, inoffensif, sera rendu caduc par T-CTX (qui supprime la regex
  comme condition d'attachement). Ne pas le compter comme feature.
- A7 = T7 (buildPlugin.sh fail-fast) confirmé comme candidat upstream S.

## FAIT — lot config (build 1.0.11, 2026-07-07)
- T22 : sélecteur de modèles par provider (modelCatalog.ts, presets
  cliquables + champ libre). IDs vérifiés web 2026-07-07.
- T23 : reply cap éditable dans Settings (presets 256/1024/2048/4096 +
  champ libre, vide=défaut, bornes 16-8192, erreur inline).
- T22bis : 404 → "model id not found, check Settings" ; 401/403 →
  "API key rejected, check your key file".
Note : templates deepseek-chat/gemini-2.5-flash restés inchangés
(choix auteur ; le picker propose les IDs à jour). deepseek-chat
déprécié après 2026-07-24 → à signaler à l'auteur un jour.
