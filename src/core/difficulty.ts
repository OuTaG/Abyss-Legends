import { D, Decimal } from './num';
import type { GameData } from '../data/build';
import type { BossDef, WorldDef } from './types';

/** Puissance recommandee D(L) (config/balance/difficulte_niveaux.json) :
 *  D(L) = D(L-1) x g_cycle x pas_normalise[(L-1) mod 8], g_cycle indexe par monde et par cycle de 8 niveaux.
 *  Au-dela des mondes calibres, la croissance par defaut s'applique (progression infinie). */
export class Difficulty {
  private cache: Decimal[] = [D(0), D(0)];
  private pasNorm: number[];
  constructor(private data: GameData) {
    const bruts = data.difficulte.pas_cycle_8_bruts;
    const gm = Math.exp(bruts.reduce((a, b) => a + Math.log(b), 0) / bruts.length);
    this.pasNorm = bruts.map((p) => p / gm);
    this.cache[1] = D(data.difficulte.puissance_niveau_1);
  }
  private croissance(L: number): number {
    const monde = Math.floor((L - 1) / 80) + 1;
    const cycle = Math.floor(((L - 1) % 80) / 8);
    const table = (this.data.difficulte.croissance_par_cycle as Record<string, number[]>)[String(monde)];
    return table?.[cycle] ?? this.data.difficulte.croissance_monde_suivant_par_defaut;
  }
  puissance(L: number): Decimal {
    if (L < 1) throw new Error('niveau >= 1');
    for (let i = this.cache.length; i <= L; i++) {
      this.cache[i] = this.cache[i - 1].mul(this.croissance(i) * this.pasNorm[(i - 1) % 8]);
    }
    return this.cache[L];
  }
}

export interface NiveauInfo {
  niveau: number;
  monde: WorldDef;
  indexDansMonde: number; // 1..80
  rotation: number; // 0..7 (boss de la rotation)
  boss: BossDef;
  boss8: boolean; // niveau du boss n°8 : meilleures cles
  fin: boolean; // dernier niveau du monde
}

/** Niveau global -> monde/boss. Un monde sans donnees retombe sur le dernier monde connu (contenu a venir). */
export function niveauInfo(data: GameData, niveau: number): NiveauInfo {
  const parMonde = 80;
  const idxMonde = Math.floor((niveau - 1) / parMonde) + 1;
  const monde = data.mondes.find((m) => m.id === idxMonde) ?? data.mondes[data.mondes.length - 1];
  const indexDansMonde = ((niveau - 1) % parMonde) + 1;
  const rotation = (indexDansMonde - 1) % 8;
  return {
    niveau, monde, indexDansMonde, rotation,
    boss: monde.boss[rotation],
    boss8: rotation === 7,
    fin: indexDansMonde === monde.niveaux,
  };
}

export function niveauMax(data: GameData): number {
  return data.mondes.reduce((a, m) => a + m.niveaux, 0);
}
