// Vue du Sonar : 3 echos sous forme de silhouettes floues dans 3 directions. Le joueur touche l'une d'elles.
import { BlurFilter, Container, Graphics, Text } from 'pixi.js';
import type { Echo } from '../core/sonar';
import type { GameData } from '../data/build';
import type { NiveauInfo } from '../core/difficulty';
import { ELEMENT_COULEUR } from '../core/elements';
import { dessinerCreature, dessinerHeros, dessinerMonture, hex } from './sprites';

const POS3 = [[88, 345], [195, 225], [302, 345]];
const LABELS = ['Gauche', 'Devant', 'Droite'];
const SILH = 0x03121f;

interface Item { root: Container; sil: Container; flou: BlurFilter; i: number; phase: number; echo: Echo }

export class SonarView extends Container {
  private items: Item[] = [];
  private anneaux: Graphics[] = [];
  private faisceaux = new Graphics();
  private zone = new Container();
  private t = 0;
  private reveal: { i: number; t: number } | null = null;
  private onChoix: ((i: number) => void) | null = null;
  private flouBase = 5;

  constructor() {
    super();
    for (let i = 0; i < 3; i++) {
      const g = new Graphics();
      g.position.set(195, 650);
      this.anneaux.push(g);
    }
    const hero = new Graphics();
    const mont = new Graphics();
    dessinerMonture(mont);
    mont.position.set(195, 700);
    mont.scale.set(1.1);
    dessinerHeros(hero, 0x2fa8c8);
    hero.position.set(195, 650);
    hero.scale.set(1.3);
    this.addChild(this.faisceaux, ...this.anneaux, mont, hero, this.zone);
  }

  afficher(data: GameData, info: NiveauInfo, echos: Echo[], onChoix: (i: number) => void): void {
    this.zone.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.items = [];
    this.reveal = null;
    this.onChoix = onChoix;
    const pos = echos.length === 1 ? [[195, 235]] : POS3;
    echos.forEach((echo, i) => {
      const root = new Container();
      root.position.set(pos[i][0], pos[i][1]);
      const sil = new Container();
      const halo = new Graphics();
      halo.circle(0, 0, echo.type === 'boss' ? 92 : 62).fill({ color: 0x7fe3ff, alpha: 0.1 }).stroke({ width: 2, color: 0x9ff0ff, alpha: 0.35 });
      root.addChild(halo);
      this.dessinerEcho(sil, data, info, echo);
      const flou = new BlurFilter({ strength: this.flouBase, quality: 3 });
      sil.filters = [flou];
      root.addChild(sil);
      const lab = new Text({ text: echos.length === 1 ? 'Le gardien du niveau' : LABELS[i], style: { fontFamily: 'Arial', fontSize: 13, fontWeight: '700', fill: 0xbfeaff, stroke: { color: 0x04121e, width: 3 } } });
      lab.anchor.set(0.5, 0);
      lab.position.set(0, echo.type === 'boss' ? 98 : 68);
      root.addChild(lab);
      root.eventMode = 'static';
      root.cursor = 'pointer';
      root.hitArea = { contains: (x: number, y: number) => x * x + y * y < (echo.type === 'boss' ? 100 : 70) ** 2 };
      root.on('pointertap', () => this.choisir(i));
      this.zone.addChild(root);
      this.items.push({ root, sil, flou, i, phase: Math.random() * 6, echo });
    });
  }

  choisir(i: number): void {
    if (this.reveal || !this.onChoix) return;
    this.reveal = { i, t: 0 };
  }

  private dessinerEcho(c: Container, data: GameData, info: NiveauInfo, echo: Echo): void {
    const g = new Graphics();
    c.addChild(g);
    switch (echo.type) {
      case 'combat': {
        const groupe = data.familles.groupes.find((x) => x.id === echo.groupe)!;
        const n = groupe.familles.length;
        groupe.familles.forEach((f, k) => {
          const e = new Graphics();
          dessinerCreature(e, data.familles.familles[f].forme, SILH);
          e.scale.set(n > 3 ? 0.6 : n > 1 ? 0.75 : 0.95);
          const ang = (k / n) * Math.PI * 2 + 0.6;
          e.position.set(n === 1 ? 0 : Math.cos(ang) * 26, n === 1 ? 0 : Math.sin(ang) * 20);
          c.addChild(e);
        });
        break;
      }
      case 'miniboss': {
        const def = info.monde.miniboss[(echo.miniIndex ?? 0) % info.monde.miniboss.length];
        const e = new Graphics();
        dessinerCreature(e, def.forme, SILH);
        e.scale.set(1.15);
        c.addChild(e);
        const lueur = new Graphics();
        lueur.circle(0, 0, 50).fill({ color: hex(ELEMENT_COULEUR[def.element]), alpha: 0.28 });
        c.addChildAt(lueur, 0);
        break;
      }
      case 'boss': {
        const e = new Graphics();
        dessinerCreature(e, info.boss.forme, SILH);
        e.scale.set(2.2);
        c.addChild(e);
        const lueur = new Graphics();
        lueur.circle(0, 0, 80).fill({ color: hex(ELEMENT_COULEUR[info.boss.element]), alpha: 0.3 });
        c.addChildAt(lueur, 0);
        break;
      }
      case 'epave':
        g.poly([-40, 6, 40, 6, 28, 30, -28, 30]).fill(SILH);
        g.roundRect(-34, -20, 68, 28, 4).fill(SILH);
        g.arc(0, -20, 34, Math.PI, 0).fill(SILH);
        g.rect(-3, -40, 6, 20).fill(SILH);
        break;
      case 'grotte':
        g.arc(0, 26, 46, Math.PI, 0).fill(SILH);
        g.rect(-46, 26, 92, 8).fill(SILH);
        g.arc(0, 26, 22, Math.PI, 0).fill(0x1a6b8a);
        g.rect(-22, 26, 44, 8).fill(0x1a6b8a);
        break;
      case 'marchand':
        g.moveTo(0, -48).lineTo(0, -30).stroke({ width: 4, color: SILH });
        g.circle(0, -8, 24).fill(SILH);
        g.roundRect(-30, 12, 60, 14, 5).fill(SILH);
        g.circle(0, -8, 11).fill(0xffe9a0);
        break;
      case 'autel':
        g.roundRect(-40, 22, 80, 14, 3).fill(SILH).roundRect(-28, 4, 56, 18, 3).fill(SILH).roundRect(-16, -14, 32, 18, 3).fill(SILH);
        g.circle(0, -30, 11).fill(0xc9b0ff);
        break;
      case 'mystere': {
        const t = new Text({ text: '?', style: { fontFamily: 'Arial', fontSize: 100, fontWeight: '900', fill: SILH } });
        t.anchor.set(0.5);
        c.addChild(t);
        break;
      }
    }
  }

  maj(dt: number): void {
    this.t += dt;
    this.faisceaux.clear();
    for (const it of this.items) {
      const pulse = Math.sin(this.t * 2 + it.phase);
      it.sil.scale.set(1 + 0.04 * pulse);
      it.sil.y = pulse * 3;
      this.faisceaux.moveTo(195, 640).lineTo(it.root.x, it.root.y).stroke({ width: 2, color: 0x7fe3ff, alpha: 0.12 });
    }
    this.anneaux.forEach((a, k) => {
      const p = ((this.t * 0.35 + k / 3) % 1);
      a.clear();
      a.circle(0, 0, 30 + p * 330).stroke({ width: 2.5, color: 0x8ff5ff, alpha: (1 - p) * 0.45 });
    });
    if (this.reveal) {
      this.reveal.t += dt;
      const k = Math.min(1, this.reveal.t / 0.45);
      for (const it of this.items) {
        if (it.i === this.reveal.i) {
          it.flou.strength = this.flouBase * (1 - k);
          it.root.scale.set(1 + 0.25 * k);
          // la silhouette prend ses vraies couleurs : on eclaircit
          it.sil.alpha = 1;
        } else it.root.alpha = 1 - k;
      }
      if (k >= 1 && this.reveal.t > 0.55) {
        const i = this.reveal.i;
        this.reveal = null;
        const cb = this.onChoix;
        this.onChoix = null;
        cb?.(i);
      }
    }
  }
}
