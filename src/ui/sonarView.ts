// Ecran du Sonar, vu de l'interieur du sous-marin : paroi d'acier rivetee, hublot de laiton, scope vert avec balayage,
// cadrans. INCERTITUDE COMPLETE (GDD 5.2) : la vue ne recoit que le NOMBRE d'echos, jamais leur type ; les 3 echos
// sont strictement identiques (forme, couleur, animation en phase) et toujours a gauche, devant et a droite.
import { Container, Graphics, Text } from 'pixi.js';
import { MATIERES, num } from './theme';
import { POLICE_TITRE } from './polices';

const CX = 195, CY = 392, R = 150, BORD = 20;
/** Emplacements fixes des echos, relatifs au centre du scope : gauche, devant, droite. */
export const POSITIONS_ECHOS: ReadonlyArray<readonly [number, number]> = [[-88, -34], [0, -96], [88, -34]];
const VERT = num(MATIERES.phosphore);
const LAITON = num(MATIERES.laiton), LAITON_F = num(MATIERES.laitonFonce), LAITON_C = num(MATIERES.laitonClair);

interface Echo { root: Container; glow: Graphics; anneau: Graphics }

export class SonarView extends Container {
  /** Les 3 echos (positions lues par les tests de bout en bout). */
  items: Echo[] = [];
  private hublot = new Container();
  private scope = new Container();
  private bruit = new Graphics();
  private balayage = new Graphics();
  private onde = new Graphics();
  private zone = new Container();
  private aiguilles: Graphics[] = [];
  private voile = new Graphics();
  private t = 0;
  private tBruit = 0;
  private choisi: { i: number; t: number } | null = null;
  private onChoix: ((i: number) => void) | null = null;

  constructor() {
    super();
    this.dessinerParoi();
    this.dessinerCadrans();
    this.dessinerHublot();
    this.voile.rect(0, 0, 390, 844).fill(0x000000);
    this.voile.alpha = 0;
    this.voile.eventMode = 'none';
    this.addChild(this.voile);
  }

  /** Affiche n echos identiques ; onChoix est appele des que le joueur touche un echo (ou un bouton). */
  afficher(n: number, onChoix: (i: number) => void): void {
    this.zone.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.items = [];
    this.choisi = null;
    this.onChoix = onChoix;
    this.fermeture(0);
    for (let i = 0; i < n; i++) {
      const [x, y] = POSITIONS_ECHOS[i % POSITIONS_ECHOS.length];
      const root = new Container();
      root.position.set(x, y);
      const glow = new Graphics();
      for (let k = 6; k >= 1; k--) glow.ellipse(0, 0, 9 + k * 6, 6 + k * 4.2).fill({ color: VERT, alpha: 0.07 + (6 - k) * 0.015 });
      glow.ellipse(0, 0, 9, 6).fill({ color: 0xc8ffe0, alpha: 0.85 });
      const anneau = new Graphics();
      root.addChild(anneau, glow);
      root.eventMode = 'static';
      root.cursor = 'pointer';
      root.hitArea = { contains: (px: number, py: number) => px * px + py * py < 48 * 48 };
      root.on('pointertap', () => this.choisir(i));
      this.zone.addChild(root);
      this.items.push({ root, glow, anneau });
    }
  }

  choisir(i: number): void {
    if (this.choisi || !this.onChoix || !this.items[i]) return;
    this.choisi = { i, t: 0 };
    const cb = this.onChoix;
    this.onChoix = null;
    cb(i);
  }

  /** Position d'un echo dans l'ecran (pour les tests automatises). */
  positionEcho(i: number): [number, number] {
    const it = this.items[i];
    return [CX + it.root.x, CY + it.root.y];
  }

  /** 0 = hublot ouvert ; 1 = refermé (il se rétrécit vers le centre, l'écran s'assombrit). */
  fermeture(p: number): void {
    const k = Math.min(1, Math.max(0, p));
    const s = 1 - 0.6 * k * k;
    this.hublot.scale.set(s);
    this.hublot.alpha = 1 - Math.max(0, k - 0.6) / 0.4;
    this.voile.alpha = 0.85 * k;
  }

  maj(dt: number): void {
    this.t += dt;
    // balayage : ligne et traine qui s'estompe
    const a = this.t * 1.6;
    const b = this.balayage;
    b.clear();
    for (let k = 0; k < 18; k++) {
      const a0 = a - k * 0.045, a1 = a - (k + 1) * 0.045;
      b.moveTo(0, 0).lineTo(Math.cos(a0) * R, Math.sin(a0) * R).lineTo(Math.cos(a1) * R, Math.sin(a1) * R).closePath()
        .fill({ color: VERT, alpha: 0.2 * (1 - k / 18) });
    }
    b.moveTo(0, 0).lineTo(Math.cos(a) * R, Math.sin(a) * R).stroke({ width: 2, color: 0xd8ffe8, alpha: 0.9 });
    // bruit de fond
    this.tBruit -= dt;
    if (this.tBruit <= 0) {
      this.tBruit = 0.12;
      this.bruit.clear();
      for (let k = 0; k < 70; k++) {
        const r = Math.sqrt(Math.random()) * R, th = Math.random() * Math.PI * 2;
        this.bruit.circle(Math.cos(th) * r, Math.sin(th) * r, Math.random() < 0.85 ? 0.9 : 1.6).fill({ color: VERT, alpha: 0.25 + Math.random() * 0.4 });
      }
    }
    // echos : meme pulsation, meme phase pour les 3 (aucune difference possible)
    const p = (this.t * 0.9) % 1;
    const puls = 1 + 0.08 * Math.sin(this.t * 3.2);
    for (const it of this.items) {
      it.glow.scale.set(puls);
      it.anneau.clear();
      it.anneau.ellipse(0, 0, 14 + p * 34, 10 + p * 24).stroke({ width: 2, color: VERT, alpha: 0.7 * (1 - p) });
      it.root.alpha = 1;
    }
    // onde blanche sur l'echo choisi, les autres s'estompent
    this.onde.clear();
    if (this.choisi) {
      this.choisi.t += dt;
      const it = this.items[this.choisi.i];
      const k = Math.min(1, this.choisi.t / 0.45);
      this.onde.circle(it.root.x, it.root.y, 12 + k * 70).stroke({ width: 3, color: 0xffffff, alpha: 1 - k });
      it.glow.scale.set(1.25);
      for (const o of this.items) if (o !== it) o.root.alpha = 1 - k * 0.8;
    }
    this.aiguilles.forEach((g, i) => { g.rotation = -0.6 + 0.25 * Math.sin(this.t * (0.7 + i * 0.5)) + 0.05 * Math.sin(this.t * 13 + i); });
  }

  // ------------------------------------------------------------------ decor statique
  private dessinerParoi(): void {
    const g = new Graphics();
    const n = 30;
    for (let i = 0; i < n; i++) {
      const v = Math.round(0x1c - i * 0.45);
      g.rect(0, (i * 844) / n, 390, 844 / n + 1).fill((v << 16) | ((v + 9) << 8) | (v + 14));
    }
    // plaques d'acier, joints et rivets
    for (const x of [0, 130, 260, 390]) g.rect(x - 2, 0, 4, 844).fill(0x0a0f12);
    for (const y of [150, 620]) g.rect(0, y - 2, 390, 4).fill(0x0a0f12);
    for (const x of [0, 130, 260, 390]) for (let y = 14; y < 844; y += 30) {
      g.circle(x + (x === 390 ? -7 : 7), y, 2.6).fill(0x3c4a52).circle(x + (x === 390 ? -7.6 : 6.4), y - 0.7, 1).fill({ color: 0xffffff, alpha: 0.25 });
    }
    // tuyaux de laiton en haut et sur les cotes
    g.roundRect(-10, 160, 410, 12, 6).fill(LAITON_F).roundRect(-10, 161, 410, 4, 2).fill({ color: LAITON_C, alpha: 0.35 });
    for (const x of [60, 200, 330]) g.roundRect(x - 6, 156, 12, 20, 3).fill(0x3b2c12);
    g.roundRect(6, 172, 10, 450, 5).fill(0x2f3a40).roundRect(374, 172, 10, 450, 5).fill(0x2f3a40);
    // console de pilotage
    g.rect(0, 620, 390, 224).fill(0x0d1418);
    g.rect(0, 620, 390, 6).fill(LAITON).rect(0, 626, 390, 3).fill(LAITON_F);
    for (let x = 12; x < 390; x += 46) g.circle(x, 623, 1.8).fill(LAITON_C);
    this.addChild(g);
    // plaque « SONAR »
    const plaque = new Graphics();
    plaque.roundRect(135, 186, 120, 28, 6).fill(0x1a1408).stroke({ width: 2.5, color: LAITON });
    plaque.circle(143, 200, 2).fill(LAITON_C).circle(247, 200, 2).fill(LAITON_C);
    const titre = new Text({ text: 'SONAR', style: { fontFamily: POLICE_TITRE, fontSize: 18, fontWeight: '700', fill: 0x7fffc0, letterSpacing: 6 } });
    titre.anchor.set(0.5);
    titre.position.set(195, 200);
    this.addChild(plaque, titre);
  }

  private dessinerCadrans(): void {
    const cadrans: [number, number][] = [[40, 540], [350, 540]];
    for (const [x, y] of cadrans) {
      const g = new Graphics();
      g.circle(0, 0, 28).fill(LAITON_F).circle(0, 0, 25).fill(LAITON).circle(0, 0, 21).fill(0x0c1210);
      for (let k = 0; k <= 8; k++) {
        const a = -Math.PI * 0.9 + (k / 8) * Math.PI * 0.8 + Math.PI * 0.5;
        g.moveTo(Math.cos(a) * 15, Math.sin(a) * 15).lineTo(Math.cos(a) * 19, Math.sin(a) * 19).stroke({ width: 1.5, color: k > 6 ? 0xff6a4a : 0xb8d8c8 });
      }
      g.circle(0, 0, 3).fill(LAITON_C);
      g.position.set(x, y);
      const aig = new Graphics();
      aig.moveTo(0, 2).lineTo(0, -17).stroke({ width: 2, color: 0xff6a4a });
      aig.position.set(x, y);
      this.aiguilles.push(aig);
      this.addChild(g, aig);
    }
  }

  private dessinerHublot(): void {
    const h = this.hublot;
    h.position.set(CX, CY);
    const cadre = new Graphics();
    cadre.circle(0, 4, R + BORD + 4).fill({ color: 0x000000, alpha: 0.5 }); // ombre portee
    cadre.circle(0, 0, R + BORD).fill(LAITON_F);
    cadre.circle(0, 0, R + BORD - 3).fill(LAITON);
    cadre.arc(0, 0, R + BORD - 6, Math.PI * 1.05, Math.PI * 1.75).stroke({ width: 4, color: LAITON_C, alpha: 0.7 });
    cadre.circle(0, 0, R + 3).fill(0x2a1e08);
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const x = Math.cos(a) * (R + BORD / 2 + 1), y = Math.sin(a) * (R + BORD / 2 + 1);
      cadre.circle(x, y, 3.6).fill(LAITON_F).circle(x - 0.8, y - 0.8, 2.6).fill(LAITON_C);
    }
    const fond = new Graphics();
    for (let k = 10; k >= 0; k--) fond.circle(0, 0, (R * (k + 1)) / 11).fill(k > 7 ? 0x021208 : (0x02 << 16) | ((0x14 + (10 - k) * 3) << 8) | (0x0c + (10 - k)));
    const grille = new Graphics();
    for (const r of [R * 0.25, R * 0.5, R * 0.75, R * 0.98]) grille.circle(0, 0, r).stroke({ width: 1, color: VERT, alpha: 0.28 });
    grille.moveTo(-R, 0).lineTo(R, 0).moveTo(0, -R).lineTo(0, R).stroke({ width: 1, color: VERT, alpha: 0.22 });
    for (let k = 0; k < 72; k++) {
      const a = (k / 72) * Math.PI * 2, l = k % 6 === 0 ? 9 : 4;
      grille.moveTo(Math.cos(a) * R, Math.sin(a) * R).lineTo(Math.cos(a) * (R - l), Math.sin(a) * (R - l)).stroke({ width: 1, color: VERT, alpha: 0.45 });
    }
    const masque = new Graphics();
    masque.circle(0, 0, R).fill(0xffffff);
    this.scope.addChild(fond, grille, this.bruit, this.balayage, this.zone, this.onde);
    this.scope.mask = masque;
    const reflet = new Graphics();
    reflet.arc(0, 0, R - 10, Math.PI * 1.1, Math.PI * 1.45).stroke({ width: 10, color: 0xffffff, alpha: 0.06 });
    reflet.arc(0, 0, R - 24, Math.PI * 1.15, Math.PI * 1.35).stroke({ width: 4, color: 0xffffff, alpha: 0.08 });
    h.addChild(cadre, this.scope, masque, reflet);
    this.addChild(h);
  }
}
