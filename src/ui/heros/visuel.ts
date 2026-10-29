// Couche d'abstraction du visuel d'un heros : la logique (combat, Sonar, traversee) ne connait que cette interface.
// Aujourd'hui : rig de pieces PNG (rigPieces.ts) ou dessin provisoire (visuelGraphique). Demain : export Spine
// (@esotericsoftware/spine-pixi-v8), en ajoutant une implementation de VisuelHeros, sans toucher a la logique.
import type { Container } from 'pixi.js';

/** Animations attendues (GDD 2). Noms Spine conseilles entre parentheses. */
export type AnimHeros =
  | 'attente' // (idle) respiration, en boucle
  | 'attaque' // (attack) bras avant + harpon, une fois puis retour a l'attente
  | 'coup' // (hit) recul + flash, une fois
  | 'nage'; // (move) deplacement, en boucle (traversee de l'eau)

export interface VisuelHeros {
  /** Conteneur a placer dans la scene ; origine = entre les pieds, au sol. Regarde vers la droite. */
  readonly vue: Container;
  /** Hauteur approximative en pixels a l'echelle 1 de `vue` (pour placer barres et textes). */
  readonly hauteur: number;
  jouer(anim: AnimHeros): void;
  /** A appeler a chaque image (secondes). */
  maj(dt: number): void;
  detruire(): void;
  /** Fige une pose (captures d'ecran et tests) ; null relance l'animation normale. */
  figer?(anim: AnimHeros | null, t?: number): void;
}

/** Correspondance avec les animations d'un futur export Spine. */
export const NOMS_SPINE: Record<AnimHeros, string> = { attente: 'idle', attaque: 'attack', coup: 'hit', nage: 'move' };
