// Rig provisoire a partir des pieces PNG detourees (en attendant l'export Spine) : conteneurs imbriques, un par os,
// pivot a l'articulation. La description (positions, pivots, ordre d'affichage) est dans content/rigs/<heros>.json.
import { Assets, Container, Sprite, type Texture } from 'pixi.js';
import type { AnimHeros, VisuelHeros } from './visuel';

type Vec = [number, number];
export interface NoeudRig {
  id: string;
  img?: string;
  /** Articulation dans l'image de la piece (px). */
  pivot?: Vec;
  /** Articulation dans l'espace de la reference (px). */
  at: Vec;
  /** Position du pivot de l'image si elle differe de l'articulation de l'os (ex. torse sur l'os du buste). */
  at_img?: Vec;
  scale?: number | Vec;
  rot?: number;
  back?: NoeudRig[];
  front?: NoeudRig[];
}
export interface DefRig { dossier: string; sol: Vec; hauteur: number; racine: NoeudRig }

const RIGS = import.meta.glob('/content/rigs/*.json', { eager: true, import: 'default' }) as Record<string, DefRig>;
const IMAGES = import.meta.glob('/assets/heros/*/pieces/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export function defRig(heroId: string): DefRig | undefined {
  return RIGS[`/content/rigs/${heroId.toLowerCase()}.json`];
}

/** Charge toutes les textures de pieces (a appeler une fois avant de creer un rig). */
export async function prechargerRigs(): Promise<void> {
  const textures = (await Assets.load(Object.values(IMAGES))) as Record<string, Texture>;
  for (const t of Object.values(textures)) {
    t.source.scaleMode = 'linear';
    t.source.autoGenerateMipmaps = true;
  }
}

// ------------------------------------------------------------------ animations (images cles simples, en radians / px)
type Cle = [number, number]; // [temps normalise 0..1, valeur]
function courbe(cles: Cle[], k: number): number {
  if (k <= cles[0][0]) return cles[0][1];
  for (let i = 1; i < cles.length; i++) {
    const [t1, v1] = cles[i];
    if (k <= t1) {
      const [t0, v0] = cles[i - 1];
      const u = (k - t0) / (t1 - t0 || 1);
      const s = u * u * (3 - 2 * u); // lissage
      return v0 + (v1 - v0) * s;
    }
  }
  return cles[cles.length - 1][1];
}

const DUREES: Record<AnimHeros, number> = { attente: 0, nage: 0, attaque: 0.5, coup: 0.42 };
const ATTAQUE = {
  bras: [[0, 0], [0.25, 0.4], [0.45, -2.2], [0.68, -2.1], [1, 0]] as Cle[],
  main: [[0, 0], [0.25, 0.1], [0.45, -0.25], [0.68, -0.2], [1, 0]] as Cle[],
  buste: [[0, 0], [0.25, -0.07], [0.45, 0.13], [0.68, 0.1], [1, 0]] as Cle[],
  dx: [[0, 0], [0.25, -30], [0.45, 110], [0.68, 95], [1, 0]] as Cle[],
};
const COUP = {
  dx: [[0, 0], [0.18, -150], [1, 0]] as Cle[],
  buste: [[0, 0], [0.18, -0.16], [1, 0]] as Cle[],
  tete: [[0, 0], [0.18, -0.14], [1, 0]] as Cle[],
  bras: [[0, 0], [0.18, 0.25], [1, 0]] as Cle[],
};

export class RigPieces implements VisuelHeros {
  readonly vue = new Container();
  readonly hauteur: number;
  private corps = new Container();
  private os: Record<string, Container> = {};
  private sprites: Sprite[] = [];
  private repos: Record<string, { x: number; y: number }> = {};
  private anim: AnimHeros = 'attente';
  private ta = 0;
  private t = Math.random() * 10;
  private fige = false;

  /** echelle : pixels d'ecran par pixel de la reference (ex. 0,1 => heros de ~126 px). */
  constructor(private def: DefRig, echelle: number) {
    this.hauteur = def.hauteur * echelle;
    this.corps.scale.set(echelle);
    this.vue.addChild(this.corps);
    this.construire(def.racine, def.sol, this.corps);
  }

  private construire(n: NoeudRig, parentAt: Vec, parent: Container): void {
    const os = new Container();
    os.label = n.id;
    os.position.set(n.at[0] - parentAt[0], n.at[1] - parentAt[1]);
    this.os[n.id] = os;
    this.repos[n.id] = { x: os.x, y: os.y };
    for (const c of n.back ?? []) this.construire(c, n.at, os);
    if (n.img) {
      const url = IMAGES[`/${this.def.dossier}/${n.img}.png`];
      const sp = new Sprite(Assets.get<Texture>(url));
      const [px, py] = n.pivot ?? [sp.texture.width / 2, sp.texture.height / 2];
      sp.anchor.set(px / sp.texture.width, py / sp.texture.height);
      const ai = n.at_img ?? n.at;
      sp.position.set(ai[0] - n.at[0], ai[1] - n.at[1]);
      const s = n.scale ?? 1;
      if (Array.isArray(s)) sp.scale.set(s[0], s[1]);
      else sp.scale.set(s);
      sp.rotation = ((n.rot ?? 0) * Math.PI) / 180;
      sp.label = n.img;
      os.addChild(sp);
      this.sprites.push(sp);
    }
    for (const c of n.front ?? []) this.construire(c, n.at, os);
    parent.addChild(os);
  }

  jouer(anim: AnimHeros): void {
    // un coup recu n'interrompt pas une attaque deja lancee a plus de la moitie (lisibilite)
    if (anim === 'coup' && this.anim === 'attaque' && this.ta > DUREES.attaque * 0.5) return;
    this.anim = anim;
    this.ta = 0;
  }

  /** Nom de l'animation en cours (tests, captures). */
  get animation(): AnimHeros { return this.anim; }

  figer(anim: AnimHeros | null, t = 0): void {
    this.fige = anim !== null;
    if (anim) { this.anim = anim; this.ta = t; }
    this.maj(0);
  }

  maj(dt: number): void {
    if (this.fige) dt = 0;
    this.t += dt;
    this.ta += dt;
    const d = DUREES[this.anim];
    if (d && this.ta >= d && !this.fige) { this.anim = 'attente'; this.ta = 0; }
    const o = this.os;
    for (const [id, p] of Object.entries(this.repos)) { o[id].position.set(p.x, p.y); o[id].rotation = 0; }
    o.buste.scale.set(1, 1);
    // respiration (toujours presente, meme pendant les autres animations)
    const nage = this.anim === 'nage';
    const f = nage ? 4 : 2.4;
    const r = Math.sin(this.t * f);
    o.buste.scale.y = 1 + 0.018 * r;
    o.buste.rotation = 0.012 * r + (nage ? 0.1 : 0);
    o.tete.rotation = 0.03 * Math.sin(this.t * f + 0.6);
    o.bras_avant.rotation = 0.05 * Math.sin(this.t * f + 1);
    o.bras_arriere.rotation = -0.06 * Math.sin(this.t * f + 1.3);
    if (nage) {
      o.jambe_avant.rotation = 0.22 * Math.sin(this.t * 7);
      o.jambe_arriere.rotation = -0.22 * Math.sin(this.t * 7);
    }
    let teinte = 0xffffff;
    const k = d ? this.ta / d : 0;
    if (this.anim === 'attaque') {
      o.bras_avant.rotation += courbe(ATTAQUE.bras, k);
      o.main_avant.rotation = courbe(ATTAQUE.main, k);
      o.buste.rotation += courbe(ATTAQUE.buste, k);
      o.racine.x += courbe(ATTAQUE.dx, k);
    } else if (this.anim === 'coup') {
      o.racine.x += courbe(COUP.dx, k);
      o.buste.rotation += courbe(COUP.buste, k);
      o.tete.rotation += courbe(COUP.tete, k);
      o.bras_avant.rotation += courbe(COUP.bras, k);
      o.bras_arriere.rotation += courbe(COUP.bras, k);
      if (this.ta < 0.24) teinte = Math.floor(this.ta / 0.06) % 2 ? 0xffb0b0 : 0xff6060;
    }
    for (const s of this.sprites) s.tint = teinte;
  }

  detruire(): void { this.vue.destroy({ children: true }); }
}
