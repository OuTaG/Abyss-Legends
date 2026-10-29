// Fabrique des visuels de heros. Ordre de preference : export Spine (a venir) > rig de pieces PNG > dessin provisoire.
// Pour brancher Spine plus tard : ajouter une classe VisuelSpine (meme interface, NOMS_SPINE pour les animations)
// et la retourner ici quand un export existe pour le heros. Rien d'autre ne change.
import { Container, Graphics } from 'pixi.js';
import type { AnimHeros, VisuelHeros } from './visuel';
import { RigPieces, defRig } from './rigPieces';
import { dessinerHeros } from '../sprites';

export type { AnimHeros, VisuelHeros } from './visuel';
export { prechargerRigs } from './rigPieces';

/** hauteurPx : taille voulue a l'ecran (du sol au sommet de la tete). */
export function creerVisuelHeros(heroId: string, hauteurPx: number, couleur = 0x2fa8c8): VisuelHeros {
  const def = defRig(heroId);
  if (def) return new RigPieces(def, hauteurPx / def.hauteur);
  return new VisuelGraphique(couleur, hauteurPx);
}

/** Heros sans pieces dessinees : forme provisoire animee par simples transformations. */
class VisuelGraphique implements VisuelHeros {
  readonly vue = new Container();
  private g = new Graphics();
  private anim: AnimHeros = 'attente';
  private ta = 0;
  private t = 0;
  constructor(couleur: number, readonly hauteur: number) {
    dessinerHeros(this.g, couleur);
    const s = hauteur / 80;
    this.g.scale.set(s);
    this.g.y = -46 * s;
    this.vue.addChild(this.g);
  }
  jouer(anim: AnimHeros): void { this.anim = anim; this.ta = 0; }
  maj(dt: number): void {
    this.t += dt;
    this.ta += dt;
    let dx = 0;
    this.g.tint = 0xffffff;
    if (this.anim === 'attaque') { dx = Math.sin(Math.min(1, this.ta / 0.4) * Math.PI) * 14; if (this.ta > 0.4) this.anim = 'attente'; }
    if (this.anim === 'coup') { dx = -Math.sin(Math.min(1, this.ta / 0.35) * Math.PI) * 10; this.g.tint = this.ta < 0.15 ? 0xff6060 : 0xffffff; if (this.ta > 0.35) this.anim = 'attente'; }
    this.g.x = dx;
    this.g.scale.y = this.g.scale.x * (1 + 0.02 * Math.sin(this.t * 2.4));
  }
  detruire(): void { this.vue.destroy({ children: true }); }
}
