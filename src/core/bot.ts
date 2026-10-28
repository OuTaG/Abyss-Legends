// Joueur automatique : sert aux tests, au calibrage et a la verification de bout en bout (aucun blocage possible).
import { Run } from './run';
import { Rng } from './rng';

export type Politique = 'combats' | 'aleatoire' | 'prudent';

export interface BotStats { victoire: boolean; step: number; combats: number; niveauHeros: number; mutations: number; dureeCombats: number[] }

export function choisirEcho(run: Run, politique: Politique, rng: Rng): number {
  const types = run.echos.map((e) => e.type);
  if (politique === 'aleatoire') return rng.int(0, types.length - 1);
  const pref = politique === 'combats'
    ? ['miniboss', 'boss', 'combat', 'autel', 'epave', 'marchand', 'mystere', 'grotte']
    : ['miniboss', 'boss', 'grotte', 'combat', 'epave', 'marchand', 'autel', 'mystere'];
  let best = 0;
  let bestRank = 99;
  types.forEach((t, i) => {
    const r = pref.indexOf(t);
    if (r < bestRank) { bestRank = r; best = i; }
  });
  return best;
}

/** Joue une partie complete. dt = pas de simulation du combat (secondes de jeu). */
export function jouerPartie(run: Run, politique: Politique, graineBot: number, dt = 0.25, maxIterations = 200000): BotStats {
  const rng = new Rng(graineBot);
  const durees: number[] = [];
  let iter = 0;
  while (!run.fini) {
    if (iter++ > maxIterations) throw new Error('Blocage : la partie ne se termine pas (phase ' + run.phase + ')');
    switch (run.phase) {
      case 'sonar':
        run.chooseEcho(choisirEcho(run, politique, rng));
        break;
      case 'combat': {
        const c = run.combat!;
        run.update(dt);
        if (c.ended) durees.push(c.time);
        break;
      }
      case 'mutation':
        run.pickMutation(rng.int(0, run.offre.length - 1));
        break;
      case 'shop': {
        // achete tant que possible : soins d'abord si PV bas, sinon au hasard parmi les articles abordables
        let achete = true;
        while (achete) {
          achete = false;
          const ordre = rng.shuffle(run.shop!.slots.map((_, i) => i));
          for (const i of ordre) {
            if (run.acheter(i)) { achete = true; break; }
          }
          if (run.phase !== 'shop') break;
        }
        if (run.phase === 'shop') run.quitterShop();
        break;
      }
      case 'rencontre': {
        const r = run.rencontre!;
        const ok = r.options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
        run.choisirRencontre(ok[rng.int(0, ok.length - 1)]);
        break;
      }
    }
  }
  return {
    victoire: run.phase === 'victoire', step: run.step, combats: run.nbCombats, niveauHeros: run.niveauHeros,
    mutations: run.nbMutations, dureeCombats: durees,
  };
}
