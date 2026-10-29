# Abyss Legends - prototype jouable (vertical slice)

Un niveau complet du monde 1 (Lagon) : le Sonar (30 choix, 3 échos), la traversée de l'eau, combats 100 % automatiques, mutations, shop, mini-boss aux choix 10 et 20, boss final, clés de première fois, record, énergie.
Référence de conception : `/home/user/design/GDD.md`. Valeurs d'équilibrage : copie de `/home/user/balance/config/` dans `config/balance/`.

Stack : TypeScript, Vite, PixiJS v8 (formes provisoires, Spine plus tard), break_infinity.js (grands nombres), Vitest, Capacitor.

## Lancer en local

```bash
npm install
npm run dev        # http://localhost:5173 (ouvrir en mode mobile / fenêtre étroite)
npm test           # tests unitaires (Vitest)
npm run build      # tsc + build de production dans dist/
npm run preview    # sert dist/
```

Écran principal (onglet **Récif**, par défaut) : choix libre du niveau avec les flèches, record du niveau (affiché uniquement ici), énergie « 45/60 », bouton COMBATTRE. Barre du bas, de gauche à droite : **Boutique ; Héros ; Récif ; Événements ; Pets**. L'onglet Héros regroupe héros, talents, perles, gardiens, équipement (démonstration des couleurs de rareté et des halos S / SS) et montures ; ce qui n'existe pas encore est un écran d'attente.
Options de test dans les **réglages** (roue dentée en haut à droite) : langue, abonnement (combats x2), puissance du joueur (facile / calibré / dur), recharge d'énergie, export/import/effacement de la sauvegarde.

## Déroulement d'un choix (GDD 5.2, 5.3)

1. **Sonar** (écran séparé, vue de l'intérieur du sous-marin) : 3 échos **strictement identiques**, toujours à gauche, devant et à droite. La vue ne reçoit que le *nombre* d'échos (`SonarView.afficher(n, …)`), jamais leur type. Aux choix 10, 20 (mini-boss) et 30 (boss), les 3 échos mènent tous au mini-boss / boss.
2. **Traversée de l'eau** (≈ 2,5 s, `src/core/rythme.ts` + `src/ui/traverseeView.ts`) : le hublot se referme, le héros sur sa monture file vers la droite (traînées, bulles, rayons), une forme sombre indistincte, puis la rencontre est révélée. Elle avance en temps réel : **l'abonnement x2 ne l'accélère pas** (seules les scènes de combat le sont, `facteurTemps`).
3. **Rencontre** : combat (aucun choix, Sonar jamais visible), épave, grotte, marchand, autel ou mystère.

**Sauvegarde de la partie en cours** (GDD 4.1) : à chaque tour (chaque choix de Sonar), l'état complet de la partie (tour, échos, mutations, PV, pièces et XP de partie, bonus temporaires, stock du marchand, compteurs du hasard) est enregistré dans le profil (`Run.sauvegarde()` / `Run.restaurer()`, champ `partieEnCours`). Fermer l'application puis la rouvrir reprend exactement au choix de Sonar en attente. Le hasard étant entièrement dérivé de la graine, la suite de la partie est identique.
**Fin de partie** : la défaite affiche simplement « Défaite » et « Tour X ». Le marchand peut revenir plusieurs fois dans une partie, avec le même stock.

Contenu (`content/heros.json`, noms du GDD 6.1, 8.1, 8.3 à 8.5) : 11 héros (Plongeur, Dauphin guerrier, Sirène des courants…), 4 montures sans élément (Raie manta et Espadon épiques ; Bébé Nessie et Léviathan juvénile légendaires), 7 gardiens, 30 pets, 6 familles d'armes. L'équipe fixe de test : Plongeur sur Raie manta, pets Étoile de mer épineuse, Seiche, Poisson-lanterne, gardiens Feu follet abyssal et Nautile mécanique. Les statistiques restent provisoires.

En combat, **seuls le héros et la monture peuvent être touchés** : la monture a ses propres PV (part des PV du héros, `config/provisoire.json` > `monture`), les ennemis la visent parfois ; hors de combat, elle n'attaque plus. Les pets et gardiens ne sont jamais ciblés.

## Architecture

| Dossier | Rôle |
|---|---|
| `src/core/` | Logique pure, sans navigateur ni rendu : `run.ts` (partie), `combat.ts`, `sonar.ts`, `difficulty.ts`, `mutations.ts`, `shop.ts`, `profile.ts` (record, clés, énergie), `save.ts` (sauvegarde versionnée), `num.ts` (grands nombres), `bot.ts` (joueur automatique) |
| `src/core/rythme.ts` | Durée de la traversée, facteur de vitesse par scène (l'abonnement n'accélère que le combat) |
| `src/ui/` | Rendu PixiJS (`combatView`, `sonarView`, `traverseeView`, `menuScene`, `background`, `sprites`) et DOM (`menu.ts` : écran principal et onglets, `dom.ts`, `style.css`) |
| `src/ui/theme.ts` | **Thème central** : couleurs des raretés (Commun gris, Original vert, Rare bleu, Épique violet, Légendaire jaune, Mythique rouge), halos S (blanc) / SS (rouge rubis), matières (laiton, verre sombre…) ; exposées en variables CSS `--rar-*` |
| `src/ui/heros/` | Visuel du héros derrière une interface (`visuel.ts`) : rig de pièces PNG (`rigPieces.ts`) ou dessin provisoire ; prêt pour Spine |
| `src/i18n/` | Traductions (`t('cle', {param})`), fichiers `locales/fr.json`, `en.json`, `ja.json`, `ko.json`, `zh-Hant.json` |
| `content/rigs/` | Description des rigs (positions, pivots, ordre d'affichage des pièces) |
| `assets/heros/` | Pièces détourées des héros (PNG) et images de référence |
| `src/data/` | Chargement des données (`build.ts` sans Vite, `index.ts` avec découverte des mondes) |
| `config/balance/` | Copie des fichiers de `/home/user/balance/config/` (ne pas modifier à la main) |
| `config/provisoire.json` | Valeurs inventées pour le combat, absentes de l'équilibrage |
| `content/` | Contenu : mondes (`worlds/*.json`), familles, mutations, rencontres, boutique, héros |
| `tests/` | Tests Vitest |
| `scripts/` | `calibrer.ts` (banc d'essai du combat), `e2e.cjs` (partie complète dans Chromium headless + captures) |

**Ajouter un monde = ajouter `content/worlds/mondeN.json`** (boss, mini-boss, habillage des 6 familles, palette) ; il est découvert automatiquement. La difficulté vient de `difficulte_niveaux.json` (croissance par défaut au-delà des mondes calibrés), les clés et récompenses de `tirages.json` / `economie_sources.json`. Aucun code ne mentionne un monde précis.

Sauvegarde : `localStorage`, format versionné (`VERSION_SAUVEGARDE`, actuellement 3 : langue en v2, partie en cours en v3) avec table de migrations dans `src/core/save.ts`.

Outils :

```bash
npx tsx scripts/calibrer.ts <niveau> <parties> <ratio> "<héros>" <combats|aleatoire|prudent>   # taux de victoire, durées
ABO=1 PRESET=facile node scripts/e2e.cjs http://127.0.0.1:5173/ docs/captures/v2 3 1                # partie automatisée + captures + vérifications (Playwright)
```

Le script e2e joue une partie complète dans Chromium headless (il lit la logique pour choisir, l'écran ne montre rien), capture les écrans dans `docs/captures/v2/` (écran principal, onglets, réglages, Sonar, étapes de la traversée au ralenti, combat, attaque et coup reçu au ralenti, mini-boss, boss, mutations, shop, rencontres, fin) et vérifie : barre de navigation, format de l'énergie, record seulement sur l'écran principal, 3 échos à chaque choix, mini-boss / boss derrière les 3 échos aux choix 10 / 20 / 30, aucun Sonar ni choix pendant le combat, traversée non accélérée par l'abonnement, sauvegarde à chaque tour et reprise après rechargement de la page (même état), écran de défaite « Défaite » / « Tour X ».

## Héros animé (rig provisoire, en attendant Spine)

Les pièces du plongeur (`assets/heros/plongeur/pieces/*.png`) sont assemblées par `src/ui/heros/rigPieces.ts` d'après `content/rigs/plongeur.json` : un conteneur Pixi par os, pivot à l'articulation (`pivot` dans l'image de la pièce, `at` dans l'espace de `plongeur_reference_v1.jpg`), pièces derrière (`back`) ou devant (`front`). Hiérarchie : racine > jambes (> bottes), bassin, buste > (bouteille, bras arrière > main), torse, ceinture, tête, bras avant > main avant > harpon. Animations : `attente` (respiration), `attaque` (bras avant + harpon), `coup` (recul + flash), `nage` (traversée).

**Remplacer par un export Spine** : la logique et les vues ne manipulent que l'interface `VisuelHeros` (`jouer(anim)`, `maj(dt)`, `vue`, `hauteur`). Ajouter une classe `VisuelSpine` (avec `@esotericsoftware/spine-pixi-v8`) qui charge le squelette exporté et traduit les animations via `NOMS_SPINE` (`attente` → `idle`, `attaque` → `attack`, `coup` → `hit`, `nage` → `move`), puis la retourner dans `creerVisuelHeros` (`src/ui/heros/index.ts`) quand un export existe. Rien d'autre ne change. Un héros sans pièces ni export utilise le dessin provisoire.

## Langues

Langues prévues : français (référence), anglais, japonais, coréen, chinois traditionnel. `fr.json` et `en.json` sont complets ; `ja.json`, `ko.json` et `zh-Hant.json` ont toutes les clés, **vides** (aucune traduction inventée) : une clé vide retombe sur l'anglais. « Automatique » suit la langue de l'appareil (zh-TW / zh-HK → zh-Hant). Polices : Cinzel (titres) et Barlow (interface) depuis Google Fonts, avec replis CJK (Noto Sans/Serif JP, KR, TC, Hiragino, Apple SD Gothic Neo, PingFang TC…) puis polices système ; en CJK, hauteur de ligne augmentée et pas de capitales forcées. Le contenu de jeu (noms d'ennemis, mutations, événements dans `content/`) reste en français dans ce prototype.

## Prévisualisation par branche (GitHub Pages)

Le workflow `.github/workflows/preview.yml` lance les tests, construit le projet et publie chaque branche dans `previews/<branche>/` de la branche `gh-pages`.

À faire une seule fois après la création du dépôt GitHub :
1. Pousser le code (aucun dépôt distant n'est créé par ce projet).
2. Premier push : le workflow crée la branche `gh-pages`.
3. Dans GitHub : Settings > Pages > Source « Deploy from a branch » > branche `gh-pages`, dossier `/ (root)`.
4. URL : `https://<utilisateur>.github.io/<depot>/previews/<branche>/` (affichée aussi dans le résumé du workflow).

`nettoyage-preview.yml` supprime la prévisualisation quand la branche est supprimée. Le dépôt doit être public (ou avoir un plan GitHub qui autorise Pages privé).
Alternative gratuite sans configuration Pages : Cloudflare Pages ou Netlify (dossier `dist`, commande `npm run build`) donnent aussi une URL par branche.

### Tester sur Mac
- Ouvrir l'URL de prévisualisation dans Safari ou Chrome ; pour le format mobile : Safari > Développement > Mode de conception adaptative (390 x 844), ou Chrome DevTools > appareil mobile.
- Sur iPhone : ouvrir la même URL (même réseau pas nécessaire) ; ou `npm run dev` sur le Mac puis `http://<ip-du-mac>:5173` sur l'iPhone.

## Capacitor (iOS / Android)

Configuré dans `capacitor.config.ts` (`appId` : `com.abysslegends.prototype`, `webDir` : `dist`). Les dossiers `ios/` et `android/` ne sont pas versionnés dans ce prototype.

Sur Mac (Xcode installé pour iOS, Android Studio pour Android) :

```bash
npm install
npm run cap:ios        # build + npx cap add ios + sync + ouvre Xcode
npm run cap:android    # build + npx cap add android + sync + ouvre Android Studio
# ensuite, après chaque modification du code web :
npm run cap:sync
```

Pas de plugin natif nécessaire pour ce prototype. Le CocoaPods (`sudo gem install cocoapods` ou `brew install cocoapods`) est requis par Capacitor pour iOS.

## Limites connues du prototype
- Graphismes provisoires (formes dessinées par code) sauf le plongeur (pièces PNG assemblées) ; pas d'animation Spine, pas de sons. La raie manta est dessinée par code (placeholder).
- La partie est sauvegardée à chaque choix de Sonar (le choix fait est enregistré aussitôt) : fermer l'application en plein combat reprend ce combat depuis son début, sans possibilité de choisir un autre écho.
- Les coffres, la boutique, les pets/montures/gardiens évolutifs, les événements et le PvP ne sont pas inclus.
