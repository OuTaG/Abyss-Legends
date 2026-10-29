// Vue du combat : lit l'etat de Combat (logique) et rejoue ses evenements en animations. Aucune regle de jeu ici.
// Disposition (guide de style 13) : le heros sur sa monture a gauche (regard a droite), pets au-dessus, gardiens a ses
// cotes, ennemis a droite. Seuls le heros et la monture ont une barre de vie (ils sont les seuls a pouvoir etre touches).
import { Container, Graphics, Text, type TextStyleOptions } from 'pixi.js';
import type { Combat, CombatEvent, Fighter } from '../core/combat';
import type { Run } from '../core/run';
import { ELEMENT_ABBR, ELEMENT_COULEUR } from '../core/elements';
import { fmt } from '../core/num';
import type { Element } from '../core/types';
import { dessinerCreature, dessinerGardien, dessinerMonture, dessinerPet, hex } from './sprites';
import { creerVisuelHeros, type VisuelHeros } from './heros';
import { POLICE_UI } from './polices';
import { t } from '../i18n';

const neutre = 0xb8c4cc;
const couleurEl = (e: Element | null): number => (e ? hex(ELEMENT_COULEUR[e]) : neutre);
const STYLE_NOM: TextStyleOptions = { fontFamily: POLICE_UI, fontSize: 12, fontWeight: '700', fill: 0xe8f0f4, stroke: { color: 0x04121e, width: 3 } };

interface Ent {
  f: Fighter;
  root: Container;
  body: Container;
  barre: Graphics;
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

/** Position des pieds du heros et du sommet de la carapace de la monture. */
const EQUIPAGE: [number, number] = [118, 540];
const SLOTS_EN = [
  [[292, 470]],
  [[282, 395], [300, 560]],
  [[270, 360], [338, 470], [270, 585]],
  [[262, 340], [342, 430], [262, 525], [342, 615]],
  [[262, 320], [342, 400], [262, 480], [342, 560], [262, 640]],
];
const SLOTS_EXTRA = [[340, 300], [345, 650], [250, 250], [230, 680], [350, 230], [300, 720]];
const PETS = [[52, 330], [118, 300], [184, 330]];
const GARDIENS = [[30, 420], [34, 650]];

export class CombatView extends Container {
  private ents = new Map<number, Ent>();
  private flottants: Flottant[] = [];
  private projs: Proj[] = [];
  private couche = new Container();
  private effets = new Container();
  private banniere: Text;
  private flashEcran = new Graphics();
  private heroEnt!: Ent;
  private mountEnt!: Ent;
  private heros: VisuelHeros | null = null;
  private montureArr = new Graphics();
  private montureAv = new Graphics();
  private barreHeros = new Graphics();
  private barreMonture = new Graphics();
  private secousse = 0;
  private t = 0;
  private extraUtilises = 0;
  private combat: Combat | null = null;

  constructor() {
    super();
    this.addChild(this.couche, this.effets);
    this.banniere = new Text({ text: '', style: { fontFamily: POLICE_UI, fontSize: 24, fontWeight: '800', fill: 0xfff1a8, stroke: { color: 0x04121e, width: 5 } } });
    this.banniere.anchor.set(0.5);
    this.banniere.position.set(195, 250);
    this.banniere.alpha = 0;
    this.flashEcran.rect(0, 0, 390, 844).fill(0xffffff);
    this.flashEcran.alpha = 0;
    this.flashEcran.eventMode = 'none';
    this.effets.addChild(this.flashEcran, this.banniere);
  }

  /** Visuel du heros (tests, captures). */
  get visuelHeros(): VisuelHeros | null { return this.heros; }

  /** Construit les sprites du combat en cours. */
  demarrer(run: Run): void {
    this.couche.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.heros = null;
    this.ents.clear();
    this.flottants.forEach((f) => f.t.destroy());
    this.flottants = [];
    this.projs.forEach((p) => p.g.destroy());
    this.projs = [];
    this.extraUtilises = 0;
    const c = run.combat!;
    this.combat = c;
    // pets (au-dessus du heros) et gardiens (a ses cotes) : aucune barre de vie, ils ne sont jamais touches
    let ip = 0, ig = 0;
    for (const a of c.allies) {
      if (a.kind === 'pet') {
        const k = ip++;
        this.creerSimple(a, PETS[k][0], PETS[k][1], (g) => dessinerPet(g, couleurEl(a.element), k), 1.25);
      } else if (a.kind === 'guardian') {
        const [x, y] = GARDIENS[ig++];
        this.creerSimple(a, x, y, (g) => dessinerGardien(g, couleurEl(a.element)), 1.15);
      }
    }
    this.creerEquipage(run, c);
    const n = c.enemies.length;
    const slots = SLOTS_EN[Math.min(n, 5) - 1];
    c.enemies.forEach((e, i) => {
      const [x, y] = slots[i] ?? SLOTS_EXTRA[i % SLOTS_EXTRA.length];
      this.creerEnnemi(e, x, y);
    });
  }

  private ent(f: Fighter, root: Container, body: Container, x: number, y: number, taille: number): Ent {
    const e: Ent = {
      f, root, body, barre: new Graphics(), statut: new Text({ text: '' }), baseX: x, baseY: y, taille, phase: Math.random() * 6,
      lunge: null, recul: 0, flash: 0, mort: 0, tele: 0, teleDur: 0, vue: true,
    };
    this.ents.set(f.uid, e);
    return e;
  }

  private creerSimple(f: Fighter, x: number, y: number, dessin: (g: Graphics) => void, taille: number): Ent {
    const root = new Container();
    const body = new Graphics();
    dessin(body);
    body.scale.set(taille);
    root.addChild(body);
    root.position.set(x, y);
    this.couche.addChild(root);
    return this.ent(f, root, body, x, y, taille);
  }

  /** Heros (rig anime) assis sur sa monture : une seule unite qui bouge ensemble. */
  private creerEquipage(run: Run, c: Combat): void {
    const [x, y] = EQUIPAGE;
    const root = new Container();
    root.position.set(x, y);
    // nouveaux objets a chaque combat (les precedents sont detruits avec la couche)
    this.montureArr = new Graphics();
    this.montureAv = new Graphics();
    this.barreHeros = new Graphics();
    this.barreMonture = new Graphics();
    dessinerMonture(this.montureArr, this.montureAv);
    const monture = new Container();
    monture.addChild(this.montureArr);
    this.heros = creerVisuelHeros(run.opts.heroId, 130, couleurEl(c.hero.element));
    this.heros.vue.position.set(-6, 10);
    root.addChild(monture, this.heros.vue, this.montureAv);
    // barres de vie : heros au-dessus de la tete, monture sous la carapace
    this.barreHeros.position.set(-34, -this.heros.hauteur - 2);
    this.barreMonture.position.set(-40, 48);
    const badge = this.badgeElement(c.hero.element, 0.8);
    badge.position.set(-48, -this.heros.hauteur + 1);
    root.addChild(this.barreHeros, this.barreMonture, badge);
    this.couche.addChild(root);
    this.heroEnt = this.ent(c.hero, root, this.heros.vue, x, y, 1);
    // la monture partage la position de l'equipage ; ses coups et degats s'affichent sur la carapace
    const ancre = new Container();
    ancre.position.set(x + 10, y + 30);
    this.mountEnt = this.ent(c.mount, ancre, monture, x + 10, y + 30, 1);
    this.dessinerBarres();
  }

  private badgeElement(el: Element | null, s = 1): Container {
    const c = new Container();
    const g = new Graphics();
    g.roundRect(-17, -8, 34, 16, 6).fill(couleurEl(el)).stroke({ width: 1.5, color: 0x04121e });
    const tx = new Text({ text: el ? ELEMENT_ABBR[el] : 'NEU', style: { fontFamily: POLICE_UI, fontSize: 11, fontWeight: '800', fill: 0x04121e } });
    tx.anchor.set(0.5);
    c.addChild(g, tx);
    c.scale.set(s);
    return c;
  }

  private creerEnnemi(f: Fighter, x: number, y: number): Ent {
    const spec = f.spec!;
    const root = new Container();
    const body = new Graphics();
    dessinerCreature(body, spec.forme, couleurEl(f.element));
    const taille = spec.echelle * (spec.kind === 'normal' ? 0.72 : spec.kind === 'boss' ? 0.62 : 0.66);
    body.scale.set(-taille, taille); // les ennemis regardent vers la gauche, vers le heros
    root.addChild(body);
    const barre = new Graphics();
    barre.position.set(0, -30 * taille - 10);
    root.addChild(barre);
    const nom = new Text({ text: spec.nom, style: STYLE_NOM });
    nom.anchor.set(0.5, 0);
    nom.position.set(0, 24 * taille + 4);
    if (spec.nom.length > 16) nom.style.fontSize = 11;
    const badge = this.badgeElement(f.element, 0.75);
    badge.position.set(-38, -30 * taille - 6);
    const statut = new Text({ text: '', style: { fontFamily: POLICE_UI, fontSize: 13, fontWeight: '800', fill: 0xfff1a8, stroke: { color: 0x04121e, width: 3 } } });
    statut.anchor.set(0.5);
    statut.position.set(0, -30 * taille - 26);
    root.addChild(nom, badge, statut);
    root.position.set(x, y);
    this.couche.addChild(root);
    const e = this.ent(f, root, body, x, y, taille);
    e.barre = barre;
    e.statut = statut;
    this.dessinerBarre(e);
    return e;
  }

  private dessinerBarre(e: Ent): void {
    const w = 62, f = e.f;
    const frac = f.maxHp.gt(0) ? Math.max(0, Math.min(1, f.hp.div(f.maxHp).toNumber())) : 0;
    e.barre.clear();
    e.barre.roundRect(-w / 2, 0, w, 8, 4).fill(0x0b1620).stroke({ width: 1.5, color: 0x04121e });
    if (frac > 0) e.barre.roundRect(-w / 2 + 1, 1, (w - 2) * frac, 6, 3).fill(frac > 0.4 ? 0xe8453c : 0xffa24a);
  }

  private dessinerBarres(): void {
    const c = this.combat;
    if (!c) return;
    const barre = (g: Graphics, f: Fighter, w: number, bouclier = 0) => {
      const frac = f.maxHp.gt(0) ? Math.max(0, Math.min(1, f.hp.div(f.maxHp).toNumber())) : 0;
      g.clear();
      g.roundRect(0, 0, w, 9, 4).fill(0x061016).stroke({ width: 1.5, color: 0x02080c });
      if (frac > 0) g.roundRect(1, 1, (w - 2) * frac, 7, 3).fill(frac > 0.35 ? 0x4fdc8e : 0xf0a838);
      if (bouclier > 0) g.roundRect(1, 1, (w - 2) * Math.min(1, bouclier), 3, 1.5).fill(0x9ad8ff);
    };
    barre(this.barreHeros, c.hero, 68, c.shield.gt(0) ? c.shield.div(c.hero.maxHp).toNumber() : 0);
    barre(this.barreMonture, c.mount, 80);
  }

  private flotter(texte: string, x: number, y: number, couleur: number, taille = 18, vie = 0.9, vy = -50): void {
    const tx = new Text({ text: texte, style: { fontFamily: POLICE_UI, fontSize: taille, fontWeight: '900', fill: couleur, stroke: { color: 0x04121e, width: 4 } } });
    tx.anchor.set(0.5);
    tx.position.set(x + (Math.random() - 0.5) * 18, y);
    this.effets.addChild(tx);
    this.flottants.push({ t: tx, vx: (Math.random() - 0.5) * 20, vy, vie, max: vie });
  }

  private pos(uid: number): [number, number] {
    const e = this.ents.get(uid);
    if (e === this.heroEnt) return [e.root.x + 10, e.root.y - 60];
    return e ? [e.root.x, e.root.y] : [EQUIPAGE[0], EQUIPAGE[1] - 60];
  }

  private traiter(ev: CombatEvent): void {
    const E = this.ents;
    switch (ev.t) {
      case 'attack': {
        const s = E.get(ev.src), d = E.get(ev.dst);
        if (s === this.heroEnt) { this.heros?.jouer('attaque'); break; }
        if (s === this.mountEnt) { this.heroEnt.lunge = { t: 0, dx: 12, dy: 0 }; break; }
        if (s && d) {
          const [dxp, dyp] = this.pos(ev.dst);
          const dx = dxp - s.baseX, dy = dyp - s.baseY;
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
        if (d === this.heroEnt) {
          this.secousse = Math.max(this.secousse, ev.viaPoison ? 0.05 : 0.22);
          if (!ev.viaPoison) this.heros?.jouer('coup');
          const [x, y] = this.pos(ev.dst);
          this.flotter('-' + fmt(ev.amount), x, y - 50, ev.viaPoison ? 0x8cff7a : 0xff6b6b, 22);
        } else if (d === this.mountEnt) {
          d.flash = 0.18;
          this.secousse = Math.max(this.secousse, 0.12);
          this.flotter('-' + fmt(ev.amount), d.root.x + 30, d.root.y, 0xff9a6b, 18);
        } else {
          const [x, y] = [d.root.x, d.root.y - 30 * d.taille];
          d.flash = 0.14;
          d.recul = 0.22;
          if (ev.thorns) this.flotter(fmt(ev.amount), x, y, 0xff9ec0, 14);
          else if (ev.viaPoison) this.flotter(fmt(ev.amount), x, y, 0x8cff7a, 14);
          else {
            this.flotter(fmt(ev.amount) + (ev.crit ? '!' : ''), x, y, ev.crit ? 0xf0a838 : 0xffffff, ev.crit ? 28 : 20);
            if (ev.mult > 1) this.flotter(t('combat.fort'), x, y - 24, 0x7dff9a, 12, 0.8, -40);
            else if (ev.mult < 1) this.flotter(t('combat.faible'), x, y - 24, 0xa9b7c2, 12, 0.8, -40);
          }
        }
        break;
      }
      case 'miss': {
        const [x, y] = this.pos(ev.dst);
        this.flotter(t('combat.esquive'), x, y - 40, 0x9ae8ff, 16);
        break;
      }
      case 'heal': {
        const [x, y] = this.pos(ev.dst);
        this.flotter('+' + fmt(ev.amount), x, y - 36, 0x7dff9a, 17);
        break;
      }
      case 'shield': {
        const [x, y] = this.pos(ev.dst);
        this.flotter(t('combat.bouclier'), x, y - 54, 0x8cc8ff, 14);
        break;
      }
      case 'death': {
        const d = E.get(ev.uid);
        if (d === this.mountEnt) { this.flotter(t('combat.monture_ko'), d.root.x, d.root.y - 10, 0xffb070, 16, 1.4); break; }
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
        const [x, y] = this.pos(ev.dst);
        if (ev.nom === 'enrage') { this.flotter(t('combat.enrage'), x, y - 70, 0xff7a4a, 20, 1.2); this.banniere.text = t('combat.enrage'); this.banniere.alpha = 1; }
        else if (ev.nom === 'etourdi') this.flotter('ZZZ', x, y - 46 * d.taille, 0xffe56b, 16, 0.9);
        else if (ev.nom === 'poison') this.flotter(t('combat.poison'), x, y - 42 * d.taille, 0x8cff7a, 13, 0.9);
        break;
      }
      case 'spawn': {
        const f = this.combat!.byUid(ev.uid);
        if (f) {
          const [x, y] = SLOTS_EXTRA[this.extraUtilises++ % SLOTS_EXTRA.length];
          this.creerEnnemi(f, x, y);
          this.flotter(t('combat.renfort'), x, y - 40, 0xffd2a0, 16, 1.1);
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
        this.flotter(t('combat.coup_double'), x, y - 40, 0x9fe3ff, 13);
        break;
      }
    }
  }

  /** Appele a chaque image avec le temps reel ecoule (secondes, avant multiplicateur de vitesse). */
  maj(dtReel: number, vitesse: number): void {
    const c = this.combat;
    if (!c) return;
    const dt = dtReel * vitesse; // animations accelerees avec le combat (abonnement x2)
    this.t += dt;
    for (const ev of c.drainEvents()) this.traiter(ev);
    this.heros?.maj(dt);

    for (const e of this.ents.values()) {
      const f = e.f;
      if (e === this.mountEnt) continue;
      const tt = this.t;
      const idle = e === this.heroEnt ? Math.sin(tt * 1.8) * 3 : Math.sin(tt * 2.2 + e.phase) * (f.side === 'enemy' ? 4 : 3);
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
        ox += 12 * a; // recul vers la droite (loin du heros)
        oy += Math.sin(this.t * 90) * 3 * a;
      }
      const body = e.body as Graphics;
      if (f.side === 'enemy') {
        if (e.tele > 0) {
          e.tele -= dt;
          const p = 1 - e.tele / e.teleDur;
          const s = e.taille * (1 + 0.18 * Math.sin(p * Math.PI * 6) * p + 0.1 * p);
          body.scale.set(-s, s);
          body.tint = 0xff9a9a;
          e.statut.text = '!!';
          e.statut.style.fill = 0xff5a5a;
        } else {
          body.scale.set(-e.taille, e.taille);
          body.tint = f.poison ? 0xb8ffb0 : 0xffffff;
          e.statut.text = f.stun > 0 ? 'ZZ' : f.caché > 0 ? '?' : f.poison ? 'POI' : f.enrage ? 'RAGE' : '';
          e.statut.style.fill = 0xfff1a8;
        }
        if (f.caché > 0) e.root.alpha = 0.45;
        else if (!e.mort) e.root.alpha = 1;
        if (e.flash > 0) {
          e.flash -= dt;
          body.tint = 0xffd0d0;
          e.root.scale.set(1 + 0.08 * (e.flash / 0.14));
        } else e.root.scale.set(1);
      }
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
    // monture : suit l'equipage ; flash quand elle est touchee, grisee hors de combat
    const m = this.mountEnt;
    m.root.position.set(this.heroEnt.root.x + 10, this.heroEnt.root.y + 30);
    if (m.flash > 0) m.flash -= dt;
    const tm = !m.f.alive ? 0x707070 : m.flash > 0 ? 0xff7a7a : 0xffffff;
    this.montureArr.tint = tm;
    this.montureAv.tint = tm;
    this.dessinerBarres();
    for (const [uid, e] of [...this.ents]) if (!e.vue && e.f.side === 'enemy') { e.root.destroy({ children: true }); this.ents.delete(uid); }

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
  }
}
