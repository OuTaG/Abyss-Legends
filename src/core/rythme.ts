// Rythme d'une partie (GDD 5.2, 12, 16) : l'abonnement accelere UNIQUEMENT les scenes de combat (x2).
// Le Sonar, la traversee de l'eau, les mutations, le shop et les rencontres gardent leur duree.

export type Scene = 'sonar' | 'traversee' | 'combat' | 'choix';

/** Duree de la transition « traversee de l'eau » entre le choix de Sonar et la rencontre (secondes). */
export const DUREE_TRAVERSEE_S = 2.5;
export const VITESSE_ABONNEMENT = 2;

/** Multiplicateur de temps d'une scene. `vitesseCombat` = 1 ou 2 (bouton x2 de l'abonne). */
export function facteurTemps(scene: Scene, vitesseCombat: number): number {
  return scene === 'combat' ? vitesseCombat : 1;
}

/** Minuterie de la traversee : avance en temps reel, jamais acceleree par l'abonnement. */
export class Traversee {
  t = 0;
  constructor(public readonly duree = DUREE_TRAVERSEE_S) {}
  /** dtReel : secondes reelles. Retourne true quand la traversee est terminee. */
  avancer(dtReel: number, vitesseCombat = 1): boolean {
    this.t += dtReel * facteurTemps('traversee', vitesseCombat);
    return this.finie;
  }
  get progression(): number { return Math.min(1, this.t / this.duree); }
  get finie(): boolean { return this.t >= this.duree; }
}
