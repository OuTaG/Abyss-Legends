import type { GameData } from '../data/build';
import type { Element, MutationDef, Rarete } from './types';
import { Rng } from './rng';

const ORDRE: Rarete[] = ['commune', 'rare', 'epique'];

export const pileMax = (data: GameData, m: MutationDef): number => m.pileMax ?? data.mutations.raretes[m.rarete].pileMax;

/** Propose n mutations distinctes (par defaut 3), ponderees par rarete.
 *  Exclut celles au maximum de leur pile et celles reservees a un autre element que celui du heros. */
export function tirerMutations(
  data: GameData, rng: Rng, heroElement: Element | null, possedees: Record<string, number>,
  opts: { n?: number; rareteMin?: Rarete; exclure?: string[] } = {},
): MutationDef[] {
  const n = opts.n ?? 3;
  const min = ORDRE.indexOf(opts.rareteMin ?? 'commune');
  let pool = data.mutations.mutations.filter((m) =>
    ORDRE.indexOf(m.rarete) >= min &&
    (!m.element || m.element === heroElement) &&
    (possedees[m.id] ?? 0) < pileMax(data, m) &&
    !(opts.exclure ?? []).includes(m.id));
  const res: MutationDef[] = [];
  while (res.length < n && pool.length) {
    const i = rng.weighted(pool.map((m) => data.mutations.raretes[m.rarete].poids));
    res.push(pool[i]);
    pool = pool.filter((_, j) => j !== i);
  }
  return res;
}

export const rareteOk = (a: Rarete, min: Rarete): boolean => ORDRE.indexOf(a) >= ORDRE.indexOf(min);
