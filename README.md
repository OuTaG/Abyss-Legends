# Abyss Legends - prototype jouable (vertical slice)

Un niveau complet du monde 1 (Lagon) : le Sonar (30 choix, 3 échos), combats 100 % automatiques, mutations, shop, mini-boss aux choix 10 et 20, boss final, clés de première fois, record, énergie.
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

Options de test sur l'écran principal : abonnement (combats x2), puissance du joueur (facile / calibré / dur), recharge d'énergie, export/import/effacement de la sauvegarde. Le niveau (1 à 160) se choisit avec les flèches.

## Architecture

| Dossier | Rôle |
|---|---|
| `src/core/` | Logique pure, sans navigateur ni rendu : `run.ts` (partie), `combat.ts`, `sonar.ts`, `difficulty.ts`, `mutations.ts`, `shop.ts`, `profile.ts` (record, clés, énergie), `save.ts` (sauvegarde versionnée), `num.ts` (grands nombres), `bot.ts` (joueur automatique) |
| `src/ui/` | Rendu PixiJS (`combatView`, `sonarView`, `background`, `sprites`) et DOM (`dom.ts`, `style.css`) |
| `src/data/` | Chargement des données (`build.ts` sans Vite, `index.ts` avec découverte des mondes) |
| `config/balance/` | Copie des fichiers de `/home/user/balance/config/` (ne pas modifier à la main) |
| `config/provisoire.json` | Valeurs inventées pour le combat, absentes de l'équilibrage |
| `content/` | Contenu : mondes (`worlds/*.json`), familles, mutations, rencontres, boutique, héros |
| `tests/` | Tests Vitest |
| `scripts/` | `calibrer.ts` (banc d'essai du combat), `e2e.cjs` (partie complète dans Chromium headless + captures) |

**Ajouter un monde = ajouter `content/worlds/mondeN.json`** (boss, mini-boss, habillage des 6 familles, palette) ; il est découvert automatiquement. La difficulté vient de `difficulte_niveaux.json` (croissance par défaut au-delà des mondes calibrés), les clés et récompenses de `tirages.json` / `economie_sources.json`. Aucun code ne mentionne un monde précis.

Sauvegarde : `localStorage`, format versionné (`VERSION_SAUVEGARDE`) avec table de migrations dans `src/core/save.ts`.

Outils :

```bash
npx tsx scripts/calibrer.ts <niveau> <parties> <ratio> "<héros>" <combats|aleatoire|prudent>   # taux de victoire, durées
node scripts/e2e.cjs http://127.0.0.1:5173/ docs/captures 1 1                                     # partie automatisée + captures (Playwright)
```

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
- Graphismes provisoires (formes dessinées par code), pas d'animation Spine, pas de sons.
- Une partie en cours n'est pas sauvegardée (seul le profil l'est) : recharger la page l'abandonne.
- Les coffres, la boutique, les pets/montures/gardiens évolutifs, les événements et le PvP ne sont pas inclus.
