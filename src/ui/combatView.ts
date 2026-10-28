// Vue du combat : lit l'etat de Combat (logique) et rejoue ses evenements en animations. Aucune regle de jeu ici.
import { Container, Graphics, Text, type TextStyleOptions } from 'pixi.js';
import type { Combat, CombatEvent, Fighter } from '../core/combat';
import type { Run } from '../core/run';
import { ELEMENT_ABBR, ELEMENT_COULEUR } from '../core/elements';
import { fmt } from '../core/num';
import type { Element } from '../core/types';
import { dessinerCreature, dessinerGardien, dessinerHeros, dessinerMonture, dessinerPet, hex } from './sprites';

const neutre = 0xb8c4cc;
const couleurEl = (e: Element | null): number => (e ? hex(ELEMENT_COULEUR[e]) : neutre);

const STYLE_NOM: TextStyleOptions = { fontFamily: 'Arial', fontSize: 12, fontWeight: '700', fill: 0xffffff, stroke: { color: 0x04121e, width: 3 } };

interface Ent {
  f: Fighter;
  root: Container;
  body: Graphics;
  barre: Graphics;
  badge: Container;
  statut: Text;
  baseX: number;
  baseY: number;
  taille: number;
  phase: number;
  lunge: { t: number; dx: number; dy: number } | null;
  recul: number;
  flash: number;
  mort: number; // > 0 : en cours de disparition
  tele: number;
  teleDur: number;
  vue: boolean;
}
interface Flottant { t: Text; vx: number; vy: number; vie: number; max: number }
interface Proj { g: Graphics; x0: number; y0: number; x1: number; y1: number; t: number }

const SLOTS_EN = [
  [[195, 315]],
  [[115, 315], [275, 315]],
  [[75, 355], [195, 280], [315, 355]],
  [[62, 360], [150, 275], [240, 275], [328, 360]],
  [[62, 365], [135, 270], [195, 365], [255, 270], [328, 365]],
];
const SLOTS_EXTRA = [[75, 205], [315, 205], [195, 195], [60, 445], [330, 445], [195, 455]];

export class CombatView extends Container {
  private ents = new Map<number, Ent>();
  private flottants: Flottant[] = [];
  private projs: Proj[] = [];
  private couche = new Container();
  private effets = new Container();
  private banniere: Text;
  private flashEcran = new Graphics();
  private heroEnt!: Ent;
  private secousse = 0;
  private t = 0;
  private extraUtilises = 0;
  private combat: Combat | null = null;

  constructor() {
    super();
    this.addChild(this.couche, this.effets);
    this.banniere = new Text({ text: '', style: { fontFamily: 'Arial', fontSize: 22, fontWeight: '800', fill: 0xfff1a8, stroke: { color: 0x04121e, width: 5 } } });
    this.banniere.anchor.set(0.5);
    this.banniere.position.set(195, 440);
    this.banniere.alpha = 0;
    this.flashEcran.rect(0, 0, 390, 844).fill(0xffffff);
    this.flashEcran.alpha = 0;
    this.flashEcran.eventMode = 'none';
    this.effets.addChild(this.flashEcran, this.banniere);
  }

  /** Construit les sprites du combat en cours. */
  demarrer(run: Run): void {
    this.couche.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.ents.clear();
    this.flottants.forEach((f) => f.t.destroy());
    this.flottants = [];
    this.projs.forEach((p) => p.g.destroy());
    this.projs = [];
    this.extraUtilises = 0;
    const c = run.combat!;
    this.combat = c;
    // ennemis
    const n = c.enemies.length;
    const slots = SLOTS_EN[Math.min(n, 5) - 1];
    c.enemies.forEach((e, i) => {
      const [x, y] = slots[i] ?? SLOTS_EXTRA[i % SLOTS_EXTRA.length];
      this.creerEnnemi(e, x, y);
    });
    // monture (sous le heros), heros, puis pets et gardiens
    const monture = c.allies.find((a) => a.kind === 'mount')!;
    this.creerAlly(monture, 195, 650, (g) => dessinerMonture(g), 1.15, false);
    this.heroEnt = this.creerAlly(c.hero, 195, 600, (g) => dessinerHeros(g, couleurEl(c.hero.element)), 1.5, true);
    const pos: Record<string, number[][]> = { pet: [[80, 545], [58, 628], [332, 628]], guardian: [[326, 548], [128, 712], [268, 712]] };
    let ip = 0, ig = 0;
    for (const a of c.allies) {
      if (a.kind === 'pet') {
        const [x, y] = pos.pet[ip];
        const k = ip++;
        this.creerAlly(a, x, y, (g) => dessinerPet(g, couleurEl(a.element), k), 1.2, false);
      } else if (a.kind === 'guardian') {
        const [x, y] = pos.guardian[ig++];
        this.creerAlly(a, x, y, (g) => dessinerGardien(g, couleurEl(a.element)), 1.1, false);
      }
    }
  }

  private creerAlly(f: Fighter, x: number, y: number, dessin: (g: Graphics) => void, taille: number, hero: boolean): Ent {
    const root = new Container();
    const body = new Graphics();
    dessin(body);
    body.scale.set(taille);
    root.addChild(body);
    root.position.set(x, y);
    if (hero) {
      const b = this.badgeElement(f.element, 0.9);
      b.position.set(0, 52);
      root.addChild(b);
    }
    this.couche.addChild(root);
    const e: Ent = {
      f, root, body, barre: new Graphics(), badge: new Container(), statut: new Text({ text: '' }), baseX: x, baseY: y, taille, phase: Math.random() * 6,
      lunge: null, recul: 0, flash: 0, mort: 0, tele: 0, teleDur: 0, vue: true,
    };
    this.ents.set(f.uid, e);
    return e;
  }

  private badgeElement(el: Element | null, s = 1): Container {
    const c = new Container();
    const g = new Graphics();
    g.roundRect(-17, -8, 34, 16, 6).fill(couleurEl(el)).stroke({ width: 1.5, color: 0x04121e });
    const t = new Text({ text: el ? ELEMENT_ABBR[el] : 'NEU', style: { fontFamily: 'Arial', fontSize: 11, fontWeight: '800', fill: 0x04121e } });
    t.anchor.set(0.5);
    c.addChild(g, t);
    c.scale.set(s);
    return c;
  }

  private creerEnnemi(f: Fighter, x: number, y: number): Ent {
    const spec = f.spec!;
    const root = new Container();
    const body = new Graphics();
    dessinerCreature(body, spec.forme, couleurEl(f.element));
    body.scale.set(spec.echelle * (spec.kind === 'normal' ? 0.9 : 1.15));
    root.addChild(body);
    const barre = new Graphics();
    const taille = spec.echelle * (spec.kind === 'normal' ? 0.9 : 1.15);
    barre.position.set(0, -34 * taille - 12);
    root.addChild(barre);
    const nom = new Text({ text: spec.nom, style: STYLE_NOM });
    nom.anchor.set(0.5, 0);
    nom.position.set(0, 26 * taille + 6);
    if (spec.nom.length > 16) nom.style.fontSize = 11;
    const badge = this.badgeElement(f.element, 0.85);
    badge.position.set(0, 26 * taille + 28);
    const statut = new Text({ text: '', style: { fontFamily: 'Arial', fontSize: 13, fontWeight: '800', fill: 0xfff1a8, stroke: { color: 0x04121e, width: 3 } } });
    statut.anchor.set(0.5);
    statut.position.set(0, -34 * taille - 36);
    root.addChild(nom, badge, statut);
    root.position.set(x, y);
    this.couche.addChild(root);
    const e: Ent = {
      f, root, body, barre, badge, statut, baseX: x, baseY: y, taille, phase: Math.random() * 6,
      lunge: null, recul: 0, flash: 0, mort: 0, tele: 0, teleDur: 0, vue: true,
    };
    this.ents.set(f.uid, e);
    this.dessinerBarre(e);
    return e;
  }

  private dessinerBarre(e: Ent): void {
    const w = 62, f = e.f;
    const frac = f.maxHp.gt(0) ? Math.max(0, Math.min(1, f.hp.div(f.maxHp).toNumber())) : 0;
    e.barre.clear();
    e.barre.roundRect(-w / 2, 0, w, 8, 4).fill(0x0b1620).stroke({ width: 1.5, color: 0x04121e });
    if (frac > 0) e.barre.roundRect(-w / 2 + 1, 1, (w - 2) * frac, 6, 3).fill(frac > 0.4 ? 0xff5a5a : 0xffa24a);
  }

  private flotter(texte: string, x: number, y: number, couleur: number, taille = 18, vie = 0.9, vy = -50): void {
    const t = new Text({ text: texte, style: { fontFamily: 'Arial', fontSize: taille, fontWeight: '900', fill: couleur, stroke: { color: 0x04121e, width: 4 } } });
    t.anchor.set(0.5);
    t.position.set(x + (Math.random() - 0.5) * 18, y);
    this.effets.addChild(t);
    this.flottants.push({ t, vx: (Math.random() - 0.5) * 20, vy, vie, max: vie });
  }

  private pos(uid: number): [number, number] {
    const e = this.ents.get(uid);
    return e ? [e.root.x, e.root.y] : [195, 600];
  }

  private traiter(ev: CombatEvent): void {
    const E = this.ents;
    switch (ev.t) {
      case 'attack': {
        const s = E.get(ev.src), d = E.get(ev.dst);
        if (s && d) {
          const dx = d.root.x - s.baseX, dy = d.root.y - s.baseY;
          const L = Math.hypot(dx, dy) || 1;
          s.lunge = { t: 0, dx: (dx / L) * 34, dy: (dy / L) * 34 };
        }
        break;
      }
      case 'projectile': {
        const [x0, y0] = this.pos(ev.src), [x1, y1] = this.pos(ev.dst);
        const g = new Graphics();
        g.circle(0, 0, 6).fill(0xffe9a0).stroke({ width: 2, color: 0xb8742a });
        g.position.set(x0, y0);
        this.effets.addChild(g);
        this.projs.push({ g, x0, y0, x1, y1, t: 0 });
        break;
      }
      case 'hit': {
        const d = E.get(ev.dst);
        if (!d) break;
        const [x, y] = [d.root.x, d.root.y - 36 * d.taille];
        const sur = ev.dst === this.heroEnt.f.uid;
        if (sur) {
          this.secousse = Math.max(this.secousse, ev.viaPoison ? 0.05 : 0.22);
          d.flash = 0.18;
          this.flotter('-' + fmt(ev.amount), x, y - 10, ev.viaPoison ? 0x8cff7a : 0xff6b6b, 20);
        } else {
          d.flash = 0.14;
          d.recul = 0.22;
          if (ev.thorns) this.flotter(fmt(ev.amount), x, y, 0xff9ec0, 14);
          else if (ev.viaPoison) this.flotter(fmt(ev.amount), x, y, 0x8cff7a, 14);
          else {
            this.flotter(fmt(ev.amount) + (ev.crit ? '!' : ''), x, y, ev.crit ? 0xffd23c : 0xffffff, ev.crit ? 26 : 18);
            if (ev.mult > 1) this.flotter('FORT', x, y - 22, 0x7dff9a, 12, 0.8, -40);
            else if (ev.mult < 1) this.flotter('faible', x, y - 22, 0xa9b7c2, 12, 0.8, -40);
          }
        }
        break;
      }
      case 'miss': {
        const [x, y] = this.pos(ev.dst);
        this.flotter('ESQUIVE', x, y - 60, 0x9ae8ff, 16);
        break;
      }
      case 'heal': {
        const [x, y] = this.pos(ev.dst);
        this.flotter('+' + fmt(ev.amount), x, y - 56, 0x7dff9a, 17);
        break;
      }
      case 'shield': {
        const [x, y] = this.pos(ev.dst);
        this.flotter('BOUCLIER', x, y - 70, 0x8cc8ff, 14);
        break;
      }
      case 'death': {
        const d = E.get(ev.uid);
        if (d) {
          d.mort = 0.01;
          for (let i = 0; i < 7; i++) this.flotter('o', d.root.x + (Math.random() - 0.5) * 40, d.root.y + (Math.random() - 0.5) * 20, 0xcff6ff, 14, 0.7, -60 - Math.random() * 30);
        }
        break;
      }
      case 'telegraph': {
        const d = E.get(ev.src);
        if (d) { d.tele = ev.dur; d.teleDur = ev.dur; }
        break;
      }
      case 'status': {
        const d = E.get(ev.dst);
        if (!d) break;
        if (ev.nom === 'enrage') { this.flotter('ENRAGÉ !', d.root.x, d.root.y - 90, 0xff7a4a, 20, 1.2); this.banniere.text = 'Enragé !'; this.banniere.alpha = 1; }
        else if (ev.nom === 'etourdi') this.flotter('ZZZ', d.root.x, d.root.y - 60 * d.taille, 0xffe56b, 16, 0.9);
        else if (ev.nom === 'poison') this.flotter('POISON', d.root.x, d.root.y - 56 * d.taille, 0x8cff7a, 13, 0.9);
        break;
      }
      case 'spawn': {
        const f = this.combat!.byUid(ev.uid);
        if (f) {
          const [x, y] = SLOTS_EXTRA[this.extraUtilises++ % SLOTS_EXTRA.length];
          this.creerEnnemi(f, x, y);
          this.flotter('Renfort !', x, y - 40, 0xffd2a0, 16, 1.1);
        }
        break;
      }
      case 'assistant': {
        this.banniere.text = ev.nom.replace('Epique', 'Épique') + ' !';
        this.banniere.alpha = 1;
        this.flashEcran.alpha = 0.22;
        break;
      }
      case 'multi': {
        const [x, y] = this.pos(ev.src);
        this.flotter('COUP DOUBLE', x, y - 60, 0x9fe3ff, 13);
        break;
      }
    }
  }

  /** Appele a chaque image avec le temps reel ecoule (secondes, avant multiplicateur de vitesse). */
  maj(dtReel: number, vitesse: number): void {
    const c = this.combat;
    if (!c) return;
    const dt = dtReel * vitesse; // animations acceleres avec le combat
    this.t += dt;
    for (const ev of c.drainEvents()) this.traiter(ev);

    for (const e of this.ents.values()) {
      const f = e.f;
      const t = this.t;
      const idle = Math.sin(t * 2.2 + e.phase) * (f.side === 'enemy' ? 4 : 3);
      let ox = 0, oy = idle;
      if (e.lunge) {
        e.lunge.t += dt;
        const k = e.lunge.t / 0.24;
        const a = k < 0.4 ? k / 0.4 : Math.max(0, 1 - (k - 0.4) / 0.6);
        ox += e.lunge.dx * a;
        oy += e.lunge.dy * a;
        if (k >= 1) e.lunge = null;
      }
      if (e.recul > 0) {
        e.recul -= dt;
        const a = Math.max(0, e.recul / 0.22);
        oy -= 12 * a * (f.side === 'enemy' ? 1 : -1);
        ox += Math.sin(this.t * 90) * 4 * a;
      }
      if (e.tele > 0) {
        e.tele -= dt;
        const p = 1 - e.tele / e.teleDur;
        e.body.scale.set(e.taille * (1 + 0.18 * Math.sin(p * Math.PI * 6) * p + 0.1 * p));
        e.body.tint = 0xff9a9a;
        e.statut.text = '!!';
        e.statut.style.fill = 0xff5a5a;
      } else if (f.side === 'enemy') {
        e.body.scale.set(e.taille);
        e.body.tint = f.poison ? 0xb8ffb0 : 0xffffff;
        e.statut.text = f.stun > 0 ? 'ZZ' : f.caché > 0 ? '?' : f.poison ? 'POI' : f.enrage ? 'RAGE' : '';
        e.statut.style.fill = 0xfff1a8;
      }
      if (f.side === 'enemy' && f.caché > 0) e.root.alpha = 0.45;
      else if (!e.mort) e.root.alpha = 1;
      if (e.flash > 0) {
        e.flash -= dt;
        e.body.tint = f.side === 'enemy' ? 0xffd0d0 : 0xff7070;
        e.root.scale.set(1 + 0.08 * (e.flash / 0.14));
      } else e.root.scale.set(1);
      e.root.position.set(e.baseX + ox, e.baseY + oy);
      if (e.mort > 0) {
        e.mort += dt;
        const k = Math.min(1, e.mort / 0.45);
        e.root.alpha = 1 - k;
        e.root.scale.set(1 - 0.5 * k);
        e.root.rotation = k * 0.8;
        if (k >= 1) { e.root.visible = false; e.vue = false; }
      }
      if (f.side === 'enemy' && e.vue) this.dessinerBarre(e);
    }
    for (const [uid, e] of [...this.ents]) if (!e.vue && e.f.side === 'enemy') { e.root.destroy({ children: true }); this.ents.delete(uid); }

    // flottants
    for (const fl of [...this.flottants]) {
      fl.vie -= dt;
      fl.t.x += fl.vx * dt;
      fl.t.y += fl.vy * dt;
      fl.t.alpha = Math.min(1, (fl.vie / fl.max) * 1.8);
      if (fl.vie <= 0) { fl.t.destroy(); this.flottants.splice(this.flottants.indexOf(fl), 1); }
    }
    for (const p of [...this.projs]) {
      p.t += dt / 0.28;
      p.g.position.set(p.x0 + (p.x1 - p.x0) * p.t, p.y0 + (p.y1 - p.y0) * p.t);
      if (p.t >= 1) { p.g.destroy(); this.projs.splice(this.projs.indexOf(p), 1); }
    }
    if (this.banniere.alpha > 0) this.banniere.alpha = Math.max(0, this.banniere.alpha - dtReel * 1.2);
    if (this.flashEcran.alpha > 0) this.flashEcran.alpha = Math.max(0, this.flashEcran.alpha - dtReel * 1.2);
    if (this.secousse > 0) {
      this.secousse -= dtReel;
      this.couche.position.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    } else this.couche.position.set(0, 0);
    if (this.heroEnt) {
      this.heroEnt.body.tint = this.heroEnt.flash > 0 ? 0xff7070 : 0xffffff;
    }
  }
}
