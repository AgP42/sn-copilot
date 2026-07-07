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
