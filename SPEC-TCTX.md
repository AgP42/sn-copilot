# SPEC détaillée — T-CTX (refonte du contexte)

Fork AgP42. À relire/amender AVANT tout code. Track B (fork).
État de départ : build 1.0.12 (plaintext-only + config).

## Problème actuel (rappel)
1. Une seule page (la courante) part, jamais plus.
2. L'attachement dépend d'une regex de formulation (le "manque de
   cédille") → imprévisible.
3. L'image n'est PAS rejouée dans l'historique → le modèle "oublie"
   le dessin au 2e tour ("c'est quoi cette image ?" → "je ne vois pas").
4. Aucun contrôle visible de ce qui est envoyé.

## Objectif
Donner à l'utilisateur un contrôle VISIBLE et EXPLICITE du contexte
envoyé, avec continuité multi-tours et possibilité d'en envoyer plus
qu'une page.

---

## Découpage en 4 tranches (livrables/testables séparément)

### B1a — Vignette de page cliquable + toggle (fondation)
COMPORTEMENT :
- Sous la barre d'actions du panneau, une VIGNETTE de la capture de la
  page courante (le PNG déjà généré au tap du bouton), ~64px de haut.
- État sélectionné/désélectionné, **désélectionné par défaut** pour
  les messages libres.
- Tap sur la vignette → toggle. Un cadre/coche indique l'état.
- Libellé à côté : "fichier p.N" (nom + numéro de page, depuis
  PageContext.notePath/page).
- ENVOI :
  - Message libre (champ texte) : l'image part SEULEMENT si la vignette
    est sélectionnée. La regex contextRouting n'est PLUS la condition
    d'attachement (on la neutralise pour le texte libre).
  - Quick actions (Summary/Explain/…) : joignent TOUJOURS la capture
    (option A actée), indépendamment du toggle.
- FRAÎCHEUR : la vignette montre toujours la page COURANTE. Si
  l'utilisateur tourne la page sous le panneau, getFreshPageContext
  (déjà codé) recapture → la vignette se met à jour. (À vérifier : la
  vignette doit refléter la recapture ; sinon rafraîchir au focus.)
CAS LIMITES :
- Page non-.note/.pdf (unsupported) → pas de vignette, pas d'attache.
- Capture échouée (null) → vignette absente ou placeholder grisé
  non-cliquable.
- DeepSeek (text-only) → vignette montrée mais l'IMAGE n'est jamais
  envoyée ; seul le texte OCR/transcrit part (déjà le cas). Indiquer
  visuellement "image non supportée par ce provider".
FICHIERS : ChatView.tsx (barre vignette + état), un composant
PageThumbnail, contextRouting (neutraliser la gate texte libre),
pageContext (exposer le base64 courant à l'UI).
TESTS : rendu vignette, toggle, envoi conditionnel (libre vs quick
action), provider text-only.

### B1b — Mémoire d'image dans l'historique
COMPORTEMENT :
- Quand une image est jointe à un message, elle entre dans
  l'historique de conversation ET est REJOUÉE aux tours suivants
  (le modèle garde le dessin sous les yeux).
- ProviderTurn étendu : `imageBase64?: string` (optionnel). Les 4
  clients mappent l'image du tour comme bloc image natif (anthropic
  image block, openai image_url, gemini inline_data) ; DeepSeek ignore.
- CAP : 5 images max rejouées (les 5 plus récentes de la conv) ; au-
  delà, on droppe les plus anciennes (garde le texte, retire l'image
  des tours trop vieux). Configurable via une const.
- Le prompt caching (déjà actif) refacture ce préfixe image à ~10%.
CAS LIMITES :
- Conversation restaurée (les 5 dernières) : les images ne sont PAS
  persistées sur disque (trop lourd) → à la restauration, l'historique
  texte revient mais SANS les images (documenter). Option future :
  persister les chemins PNG. Pour B1b : images vivent en mémoire de
  session uniquement.
- DeepSeek : images jamais rejouées.
- Redaction : inchangée (texte seul scrubé sur DeepSeek).
FICHIERS : ProviderClient (type), providers x4, ChatView (ChatMessage
porte l'image + buildProviderHistory la propage), providerHistory.
TESTS : image rejouée dans le body des 4 clients, cap à 5, drop des
vieilles, DeepSeek exclu, restauration sans image.

### B1c — Multi-pages du fichier courant
COMPORTEMENT :
- Bouton/menu "ajouter des pages" : sélectionner une PLAGE (ex. 3-7)
  ou des pages individuelles du .note/.pdf courant.
- Chaque page → rendu PNG (generateNotePng/generateDocImage) → bloc
  image. Plafond N=10 pages (message si dépassé).
- Vignettes multiples dans la barre, chacune toggleable.
- Estimation tokens affichée (image ~1600 chacune) avant envoi.
CAS LIMITES : page hors bornes, rendu échoué (skip + warn), gros total
(> seuil ~20k tokens → confirmation).
FICHIERS : captureScreenshot (rendu page arbitraire), UI sélecteur de
pages, ChatView. TESTS : sélection, plafond, estimation.

### B1d — Fichiers externes (PDF natif, texte)
COMPORTEMENT :
- Bouton 📎 → mini-explorateur de fichiers (réutiliser la logique
  browser du dashboard AgP) → choisir un fichier du stockage.
- PDF → document block NATIF Anthropic (base64, ≤32MB, ≤100 pages sur
  Haiku 200K / ≤600 sur modèles 1M). Plus propre que N images.
  OpenAI/Gemini : support PDF à vérifier ; fallback N images rendues.
  DeepSeek : extraction texte seulement.
- .txt/.json/.md → inline en texte (plafond 100KB, sinon tronqué+warn).
- Images → image block.
- Estimation taille/coût + confirmation si > seuil.
CAS LIMITES : type non supporté (skip+message), fichier trop gros,
provider sans support PDF (fallback), binaire non-image/non-pdf (refus).
FICHIERS : nouveau module fileContext (classify + build blocks),
providers (document block), UI explorateur, ChatView. TESTS : mapping
par type, plafonds, fallback provider.

---

## Décisions transverses à confirmer
D1. Barre de vignettes : horizontale scrollable en haut du chat, OU un
    tiroir dépliable (📎) ? Reco : vignette page courante toujours
    visible en haut ; le 📎 ouvre le sélecteur multi-fichiers (B1c/d).
D2. Persistance des images en historique restauré : NON pour B1a-b
    (mémoire session). Persister les chemins plus tard ? (nice-to-have)
D3. Estimation de coût : simple compteur de tokens approximatif affiché
    près du bouton d'envoi quand des images/fichiers sont attachés.
    Seuil de confirmation ~20k tokens. OK ?
D4. Indicateur provider text-only (DeepSeek) : badge "image non
    envoyée" sur les vignettes. OK ?
D5. Ordre de build : B1a → tester → B1b → tester → B1c → B1d.
    (B1a+B1b = le cœur qui règle ton irritant smiley.)

## Candidat upstream
Oui à terme (issue RFC chez l'auteur d'abord), mais gros — probablement
après avoir tout stabilisé sur le fork.
