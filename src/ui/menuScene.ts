// Decor anime de l'ecran principal (onglet Recif) : le heros sur sa monture, ses pets et gardiens autour de lui.
import { Container, Graphics } from 'pixi.js';
import { creerVisuelHeros, type VisuelHeros } from './heros';
import { dessinerGardien, dessinerMonture, dessinerPet, hex } from './sprites';
import { ELEMENT_COULEUR } from '../core/elements';
import type { Element } from '../core/types';

const Y_EQUIPAGE = 405;

interface Flotteur { c: Container; x: number; y: number; ph: number }

export class MenuScene extends Container {
  private equipage = new Container();
  private heros: VisuelHeros | null = null;
  private heroId = '';
  private flotteurs: Flotteur[] = [];
  private t = 0;

  /** Reconstruit la scene si le heros a change. */
  preparer(heroId: string, pets: { element: string | null }[], gardiens: { element: string | null }[]): void {
    if (heroId === this.heroId) return;
    this.heroId = heroId;
    this.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.flotteurs = [];
    this.equipage = new Container();
    const arr = new Graphics(), av = new Graphics();
    dessinerMonture(arr, av);
    this.heros = creerVisuelHeros(heroId, 190);
    this.heros.vue.position.set(-10, 16);
    arr.scale.set(1.6);
    av.scale.set(1.6);
    this.equipage.addChild(arr, this.heros.vue, av);
    this.equipage.position.set(185, Y_EQUIPAGE);
    this.addChild(this.equipage);
    const coul = (e: string | null) => (e ? hex(ELEMENT_COULEUR[e as Element]) : 0xb8c4cc);
    const placer = (dessin: (g: Graphics) => void, x: number, y: number, s: number) => {
      const c = new Container();
      const g = new Graphics();
      dessin(g);
      g.scale.set(s);
      c.addChild(g);
      c.position.set(x, y);
      this.addChild(c);
      this.flotteurs.push({ c, x, y, ph: Math.random() * 6 });
    };
    const posPets = [[64, 215], [318, 200], [338, 330]];
    pets.forEach((p, i) => placer((g) => dessinerPet(g, coul(p.element), i), posPets[i][0], posPets[i][1], 1.8));
    const posG = [[40, 345], [30, 470]];
    gardiens.forEach((p, i) => placer((g) => dessinerGardien(g, coul(p.element)), posG[i][0], posG[i][1], 1.5));
  }

  maj(dt: number): void {
    this.t += dt;
    this.heros?.maj(dt);
    this.equipage.y = Y_EQUIPAGE + Math.sin(this.t * 1.3) * 6;
    this.equipage.rotation = Math.sin(this.t * 1.3 + 0.8) * 0.02;
    for (const f of this.flotteurs) f.c.position.set(f.x + Math.sin(this.t * 0.8 + f.ph) * 6, f.y + Math.sin(this.t * 1.6 + f.ph) * 5);
  }
}
