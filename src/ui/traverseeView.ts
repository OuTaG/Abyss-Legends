// Transition « traversee de l'eau » (guide de style 13, storyboard) : apres le choix de Sonar, le heros sur sa monture
// file vers la droite (bulles, trainees, rayons de lumiere), une forme sombre indistincte apparait, puis la rencontre
// est revelee (titre bref). Duree DUREE_TRAVERSEE_S, en temps reel : jamais acceleree par l'abonnement.
import { BlurFilter, Container, Graphics, Text } from 'pixi.js';
import { creerVisuelHeros, type VisuelHeros } from './heros';
import { dessinerMonture, hex } from './sprites';
import { POLICE_TITRE, POLICE_UI } from './polices';

/** Premiere partie de la traversee : le hublot du Sonar se referme (affiche par SonarView). */
export const FERMETURE_SONAR_S = 0.45;

interface Trainee { g: Graphics; v: number; y: number; l: number }
interface Bulle { g: Graphics; vx: number; vy: number }
export interface Revelation { titre: string; sous: string; couleur: number }

export class TraverseeView extends Container {
  private fond = new Graphics();
  private rayons = new Graphics();
  private trainees: Trainee[] = [];
  private bulles: Bulle[] = [];
  private monture = new Container();
  private heros: VisuelHeros | null = null;
  private heroId = '';
  private forme = new Graphics();
  private titre: Text;
  private sous: Text;
  private noir = new Graphics();
  private t = 0;
  private duree = 2.5;
  private revelation: Revelation | null = null;

  constructor() {
    super();
    this.addChild(this.fond, this.rayons);
    for (let i = 0; i < 46; i++) {
      const g = new Graphics();
      this.addChild(g);
      this.trainees.push({ g, v: 0, y: 0, l: 0 });
    }
    this.forme.filters = [new BlurFilter({ strength: 18, quality: 3 })];
    this.addChild(this.forme, this.monture);
    for (let i = 0; i < 34; i++) {
      const g = new Graphics();
      g.circle(0, 0, 1.5 + Math.random() * 3.5).stroke({ width: 1.2, color: 0xd8f6ff, alpha: 0.7 });
      this.addChild(g);
      this.bulles.push({ g, vx: 0, vy: 0 });
    }
    const st = { fontFamily: POLICE_TITRE, fontSize: 30, fontWeight: '700' as const, fill: 0xf3dfa2, stroke: { color: 0x02080c, width: 5 }, align: 'center' as const, wordWrap: true, wordWrapWidth: 350 };
    this.titre = new Text({ text: '', style: st });
    this.titre.anchor.set(0.5);
    this.titre.position.set(195, 640);
    this.sous = new Text({ text: '', style: { fontFamily: POLICE_UI, fontSize: 15, fontWeight: '700', fill: 0x7af4ff, letterSpacing: 4 } });
    this.sous.anchor.set(0.5);
    this.sous.position.set(195, 682);
    this.noir.rect(0, 0, 390, 844).fill(0x000000);
    this.addChild(this.titre, this.sous, this.noir);
  }

  /** Prepare une traversee ; la revelation (titre de la rencontre) n'apparait qu'a la fin. */
  demarrer(heroId: string, palette: { fondHaut: string; fondBas: string; rayons: string }, revelation: Revelation, duree: number): void {
    this.t = 0;
    this.duree = duree;
    this.revelation = revelation;
    if (this.heroId !== heroId || !this.heros) {
      this.monture.removeChildren().forEach((c) => c.destroy({ children: true })); // detruit aussi l'ancien heros
      const arr = new Graphics(), av = new Graphics();
      dessinerMonture(arr, av);
      this.heros = creerVisuelHeros(heroId, 132);
      this.heros.vue.position.set(-6, 10);
      this.monture.addChild(arr, this.heros.vue, av);
      this.monture.scale.set(1.15);
      this.heroId = heroId;
    }
    this.heros.jouer('nage');
    this.fond.clear();
    const n = 30;
    const h1 = hex(palette.fondHaut), h2 = hex(palette.fondBas);
    for (let i = 0; i < n; i++) this.fond.rect(0, (i * 844) / n, 390, 844 / n + 1).fill(melange(melange(h1, 0x000000, 0.45), melange(h2, 0x000000, 0.5), i / (n - 1)));
    this.rayons.clear();
    const c = hex(palette.rayons);
    for (let i = 0; i < 6; i++) {
      const x = i * 90 - 40;
      this.rayons.poly([x, 0, x + 50, 0, x + 170, 844, x + 70, 844]).fill({ color: c, alpha: 0.05 + (i % 2) * 0.03 });
    }
    for (const tr of this.trainees) {
      tr.y = 120 + Math.random() * 620;
      tr.v = 500 + Math.random() * 900;
      tr.l = 30 + Math.random() * 110;
      tr.g.clear();
      tr.g.rect(0, 0, tr.l, Math.random() < 0.3 ? 2 : 1).fill({ color: 0xbfefff, alpha: 0.18 + Math.random() * 0.3 });
      tr.g.position.set(Math.random() * 500, tr.y);
    }
    for (const b of this.bulles) {
      b.g.position.set(Math.random() * 420, 140 + Math.random() * 640);
      b.vx = -(280 + Math.random() * 520);
      b.vy = -(20 + Math.random() * 60);
    }
    this.forme.clear();
    this.forme.ellipse(0, 0, 95, 60).fill({ color: 0x000000, alpha: 0.85 });
    this.forme.alpha = 0;
    this.titre.text = '';
    this.sous.text = '';
    this.maj(0);
  }

  maj(dt: number): void {
    this.t += dt;
    const t = this.t, D = this.duree;
    const vitesse = t < 1.6 ? 1 : Math.max(0.35, 1 - (t - 1.6) * 0.9); // le heros ralentit a l'approche
    for (const tr of this.trainees) {
      tr.g.x -= tr.v * vitesse * dt;
      tr.g.scale.x = 0.6 + vitesse;
      if (tr.g.x < -tr.l * 2) { tr.g.x = 400 + Math.random() * 120; tr.g.y = 120 + Math.random() * 620; }
    }
    for (const b of this.bulles) {
      b.g.x += b.vx * vitesse * dt;
      b.g.y += b.vy * dt;
      if (b.g.x < -10 || b.g.y < 120) { b.g.x = 400 + Math.random() * 60; b.g.y = 200 + Math.random() * 600; }
    }
    this.rayons.x = -((t * 160 * vitesse) % 90);
    // le heros arrive par la gauche et file vers la droite, la camera le suit
    const entree = Math.min(1, Math.max(0, (t - FERMETURE_SONAR_S) / 0.6));
    const x = -80 + 220 * (1 - (1 - entree) ** 3) + Math.max(0, t - 1.6) * 25;
    this.monture.position.set(x, 470 + Math.sin(t * 5) * 6);
    this.monture.rotation = -0.06 + Math.sin(t * 5 + 1) * 0.02;
    this.heros?.maj(dt);
    // forme sombre indistincte (la meme pour toutes les rencontres)
    const kf = Math.min(1, Math.max(0, (t - 1.3) / 0.8));
    this.forme.alpha = kf * (t > D - 0.35 ? Math.max(0, (D - t) / 0.35) : 1);
    this.forme.position.set(330 - kf * 20, 430);
    this.forme.scale.set(0.6 + kf * 0.6);
    // revelation
    if (this.revelation && t >= D - 0.45) {
      const k = Math.min(1, (t - (D - 0.45)) / 0.2);
      this.titre.text = this.revelation.titre;
      this.sous.text = this.revelation.sous;
      this.sous.style.fill = this.revelation.couleur;
      this.titre.alpha = this.sous.alpha = k;
      this.titre.scale.set(0.9 + 0.1 * k);
    }
    // ouverture au noir (le Sonar vient de se refermer) puis fondu vers la rencontre
    this.noir.alpha = t < FERMETURE_SONAR_S ? 1 : t < FERMETURE_SONAR_S + 0.3 ? 1 - (t - FERMETURE_SONAR_S) / 0.3 : t > D - 0.12 ? ((t - (D - 0.12)) / 0.12) * 0.6 : 0;
  }
}

function melange(a: number, b: number, k: number): number {
  const c = (s: number) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return (c(16) << 16) | (c(8) << 8) | c(0);
}
