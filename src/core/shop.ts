import type { GameData } from '../data/build';
import type { ShopArticle } from '../core/types';
import { Rng } from './rng';

export interface ShopSlot { article: ShopArticle; achete: number }
export interface ShopState { slots: ShopSlot[] }

/** Genere le stock du shop du niveau : un soin garanti puis des articles ponderes distincts. */
export function genererShop(data: GameData, seed: number): ShopState {
  const rng = Rng.derive(seed, 777);
  const cfg = data.boutique;
  let pool = [...cfg.articles];
  const slots: ShopSlot[] = [];
  for (const g of pool.filter((a) => a.garanti)) slots.push({ article: g, achete: 0 });
  pool = pool.filter((a) => !a.garanti);
  while (slots.length < cfg.stock && pool.length) {
    const i = rng.weighted(pool.map((a) => a.poids));
    slots.push({ article: pool[i], achete: 0 });
    pool.splice(i, 1);
  }
  return { slots };
}

export const prixActuel = (s: ShopSlot): number => Math.round(s.article.prix * (1 + 0.5 * s.achete));
export const epuise = (s: ShopSlot): boolean => s.achete >= s.article.max;
