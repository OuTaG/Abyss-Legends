import type { GameData } from '../data/build';
import type { Element } from './types';

export function fortContre(data: GameData, e: Element): Element {
  return (data.heros.elements.fort_contre as Record<string, Element>)[e];
}

/** Multiplicateur de degats d'un attaquant (element ou null) sur un defenseur (cycle GDD 6.2).
 *  Avantage x1,2 ; desavantage x0,85 ; sinon 1. */
export function multElement(data: GameData, att: Element | null, def: Element | null): number {
  if (!att || !def) return 1;
  if (fortContre(data, att) === def) return data.heros.elements.avantage;
  if (fortContre(data, def) === att) return data.heros.elements.desavantage;
  return 1;
}

export function aAvantage(data: GameData, att: Element | null, def: Element | null): boolean {
  return !!att && !!def && fortContre(data, att) === def;
}

export const ELEMENT_COULEUR: Record<Element, string> = {
  Courant: '#35c4e8', Encre: '#8b5cd6', Lumen: '#f7e04a', Pression: '#ee7a2c', Corail: '#ff6b8b',
};
export const ELEMENT_ABBR: Record<Element, string> = {
  Courant: 'COU', Encre: 'ENC', Lumen: 'LUM', Pression: 'PRE', Corail: 'COR',
};
