// Le Sonar (GDD 5.2) : 30 choix, toujours 3 echos (gauche, devant, droite), mini-boss aux choix 10 et 20, boss au choix 30.
// Incertitude complete : le type d'un echo n'est connu que de la logique ; la vue ne recoit que le nombre d'echos.
// Aux choix 10, 20 et 30, les 3 echos menent tous au mini-boss / boss (rien ne le montre avant la traversee).
import type { GameData } from '../data/build';
import type { EchoType } from './types';
import { Rng } from './rng';
import { choisirGroupe, tierDuChoix } from './enemies';

export const NB_CHOIX = 30;
export const CHOIX_MINIBOSS = [10, 20];
/** Toujours 3 echos, aux 3 memes emplacements : gauche, devant, droite. */
export const NB_ECHOS = 3;

export interface Echo {
  type: EchoType;
  seed: number;
  /** Combat normal : id du groupe d'ennemis (jamais montre au joueur avant la traversee). */
  groupe?: string;
  /** Mini-boss : index dans la liste du monde. */
  miniIndex?: number;
}

export interface SonarProgress {
  /** Nombre de rencontres deja faites par type. */
  compteurs: Partial<Record<EchoType, number>>;
  /** Combats normaux faits, au total et par tiers (0..2). */
  combatsNormaux: number;
  combatsParTiers: [number, number, number];
}

export const progressVide = (): SonarProgress => ({ compteurs: {}, combatsNormaux: 0, combatsParTiers: [0, 0, 0] });

/** Echos propose a une etape. Deterministe pour (graine, etape, progression). */
export function genererEchos(data: GameData, graine: number, step: number, prog: SonarProgress): Echo[] {
  const rng = Rng.derive(graine, step);
  const cfg = data.prov.tirage_sonar;
  if (step === NB_CHOIX) return Array.from({ length: NB_ECHOS }, () => ({ type: 'boss' as const, seed: rng.int(1, 1e9) }));
  if (CHOIX_MINIBOSS.includes(step)) {
    // 3 variantes de mini-boss de la liste du monde, cachees derriere 3 echos identiques
    const n = NB_ECHOS;
    const ordre = rng.shuffle(Array.from({ length: n }, (_, i) => i));
    const decalage = step === CHOIX_MINIBOSS[1] ? 2 : 0;
    return ordre.map((i) => ({ type: 'miniboss' as const, seed: rng.int(1, 1e9), miniIndex: i + decalage }));
  }
  const tier = tierDuChoix(step);
  const finTiers = [9, 19, 29][tier];
  const dernierDuTiers = step === finTiers;
  const combatForce = dernierDuTiers && prog.combatsParTiers[tier] < cfg.combat_min_par_tiers;
  // On reserve la place des combats minimum des tiers suivants avant d'autoriser davantage de combats.
  const reserveSuivants = (2 - tier) * cfg.combat_min_par_tiers;
  const besoinTiers = Math.max(0, cfg.combat_min_par_tiers - prog.combatsParTiers[tier]);
  const combatInterdit = besoinTiers === 0 && prog.combatsNormaux + reserveSuivants >= cfg.combats_normaux_max;

  const echos: Echo[] = [];
  if (combatForce) {
    const vus: string[] = [];
    for (let i = 0; i < 3; i++) {
      const g = choisirGroupe(data, rng, vus);
      vus.push(g);
      echos.push({ type: 'combat', seed: rng.int(1, 1e9), groupe: g });
    }
    return echos;
  }
  const types = Object.keys(cfg.poids_echos) as EchoType[];
  const dispo = types.filter((t) => {
    if (t === 'combat') return !combatInterdit;
    const max = (cfg.max_par_partie as Record<string, number>)[t];
    return max === undefined || (prog.compteurs[t] ?? 0) < max;
  });
  const choisis: EchoType[] = [];
  const pool = [...dispo];
  // Les plafonds par type sont souples : si moins de 3 types restent disponibles, on complete.
  for (const t of types) if (pool.length < 3 && !pool.includes(t) && (t !== 'combat' || !combatInterdit)) pool.push(t);
  while (choisis.length < 3 && pool.length) {
    const i = rng.weighted(pool.map((t) => (cfg.poids_echos as Record<string, number>)[t]));
    choisis.push(pool[i]);
    pool.splice(i, 1);
  }
  const vus: string[] = [];
  for (const t of choisis) {
    const e: Echo = { type: t, seed: rng.int(1, 1e9) };
    if (t === 'combat') {
      e.groupe = choisirGroupe(data, rng, vus);
      vus.push(e.groupe);
    }
    echos.push(e);
  }
  return echos;
}
