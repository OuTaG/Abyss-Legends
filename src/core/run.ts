// Une partie (un niveau, 30 choix). Machine a etats pure : l'interface et les tests appellent les memes methodes.
import { D, Decimal } from './num';
import type { GameData } from '../data/build';
import { Difficulty, niveauInfo, type NiveauInfo } from './difficulty';
import { Rng } from './rng';
import { Combat, type HeroInit } from './combat';
import { buildEncounter, buildRenfort, tierDuChoix, type EnemyKind } from './enemies';
import { genererEchos, progressVide, NB_CHOIX, CHOIX_MINIBOSS, type Echo, type SonarProgress } from './sonar';
import { tirerMutations } from './mutations';
import { genererShop, prixActuel, epuise, type ShopState } from './shop';
import { addStats, stat } from './stats';
import type { Effet, Element, EventDef, EventOption, MutationDef, Rarete, StatKey, Stats } from './types';

export type Phase = 'sonar' | 'combat' | 'mutation' | 'shop' | 'rencontre' | 'victoire' | 'defaite';
export type Milestone = { type: 'choix10' | 'choix20' | 'fin'; step: number };

export interface RunOptions {
  niveau: number;
  heroId: string;
  graine: number;
  /** Ratio de puissance du joueur par rapport au niveau calibre (1 = calibre). */
  ratio: number;
  onMilestone?: (m: Milestone) => void;
}

export interface Rencontre {
  type: 'epave' | 'grotte' | 'autel' | 'mystere';
  titre: string;
  texte: string;
  options: { label: string; disabled?: boolean }[];
  etat: 'choix' | 'resultat';
  resultat?: string[];
  mutationAutel?: MutationDef;
}

/** Partie en cours sauvegardee a chaque tour (GDD 4.1) : tout ce qu'il faut pour reprendre exactement au choix de
 *  Sonar en attente. Le hasard est entierement derive de la graine (Rng.derive), plus le compteur des offres. */
export interface SauvegardePartie {
  v: 1;
  opts: { niveau: number; heroId: string; graine: number; ratio: number };
  step: number;
  echos: Echo[];
  prog: SonarProgress;
  hp: string;
  pieces: number;
  xp: number;
  niveauHeros: number;
  mutations: Record<string, number>;
  temp: { stat: StatKey; valeur: number; combats: number }[];
  pvMaxBonus: number;
  shop: { id: string; achete: number }[] | null;
  nbCombats: number;
  nbMutations: number;
  recordStep: number;
  offreCompteur: number;
  mysteresVus: string[];
  /** Echo deja choisi a ce tour (fermeture pendant la rencontre) : rejoue a la reprise, pas de second choix possible. */
  choix?: number;
}

export interface Butin { xp: number; pieces: number; niveaux: number; kind: EnemyKind }

interface TempBonus { stat: StatKey; valeur: number; combats: number }

export class Run {
  readonly info: NiveauInfo;
  readonly heroElement: Element | null;
  phase: Phase = 'sonar';
  step = 0;
  echos: Echo[] = [];
  prog: SonarProgress = progressVide();
  hp: Decimal;
  pieces: number;
  xp = 0;
  niveauHeros = 1;
  mutations: Record<string, number> = {};
  temp: TempBonus[] = [];
  pvMaxBonus = 0;
  combat: Combat | null = null;
  combatKind: EnemyKind = 'normal';
  offre: MutationDef[] = [];
  offreSource = '';
  shop: ShopState | null = null;
  rencontre: Rencontre | null = null;
  butin: Butin | null = null;
  toasts: string[] = [];
  nbCombats = 0;
  nbMutations = 0;
  recordStep = 0;
  private offreCompteur = 0;
  private pendingOffres: { rareteMin: Rarete; source: string }[] = [];
  private pendingEmbuscade: { piecesX: number } | null = null;
  private apresMutation: 'shop' | null = null;
  private resolveRencontre: ((i: number) => string[]) | null = null;
  private mysteresVus: string[] = [];
  private currentPiecesX = 1;
  private cache: { stats: Stats; maxHp: Decimal; atk: Decimal } | null = null;

  constructor(public data: GameData, public diff: Difficulty, public opts: RunOptions) {
    this.info = niveauInfo(data, opts.niveau);
    const h = data.heros.heros.find((x) => x.nom === opts.heroId);
    this.heroElement = (h?.element ?? null) as Element | null;
    this.pieces = data.prov.pieces.depart;
    this.hp = this.maxHp();
    this.nextStep();
  }

  // ------------------------------------------------------------ statistiques du heros
  /** Puissance du joueur pour le niveau de partie actuel (modele agrege). */
  puissance(): Decimal {
    const pj = this.data.prov.puissance_joueur;
    return this.diff.puissance(this.opts.niveau).mul(this.opts.ratio * pj.fraction_depart)
      .mul(Decimal.pow(pj.croissance_par_niveau_de_partie, this.niveauHeros - 1));
  }

  stats(): Stats {
    if (this.cache) return this.cache.stats;
    const s: Stats = {};
    const passif = this.heroElement ? this.data.herosContent.passifs_element[this.heroElement] : this.data.herosContent.passifs_element['neutre'];
    addStats(s, passif ?? {});
    addStats(s, this.data.herosContent.monture.bonus);
    for (const m of this.data.mutations.mutations) if (this.mutations[m.id]) addStats(s, m.effets, this.mutations[m.id]);
    for (const t of this.temp) s[t.stat] = (s[t.stat] ?? 0) + t.valeur;
    this.cache = { stats: s, maxHp: D(0), atk: D(0) };
    const r = this.puissance().sqrt();
    this.cache.maxHp = r.mul(this.data.prov.heros.pv).mul(Math.max(0.2, 1 + (s.hpPct ?? 0) + this.pvMaxBonus));
    this.cache.atk = r.mul(this.data.prov.heros.atk);
    return s;
  }
  maxHp(): Decimal { this.stats(); return this.cache!.maxHp; }
  atk(): Decimal { this.stats(); return this.cache!.atk; }
  /** Degats d'un coup du heros (hors critique) pour l'affichage. */
  degatsAffiches(): Decimal { return this.atk().mul(1 + stat(this.stats(), 'atkPct')); }

  /** Recalcule apres un changement (mutation, niveau...) : un gain de PV max soigne d'autant. */
  private refresh(): void {
    const avant = this.cache ? this.cache.maxHp : this.maxHp();
    this.cache = null;
    const apres = this.maxHp();
    if (apres.gt(avant)) this.hp = this.hp.add(apres.sub(avant));
    if (this.hp.gt(apres)) this.hp = apres;
  }

  // ------------------------------------------------------------ XP
  xpPourNiveau(k: number): number {
    return this.data.xp.xp_niveau_base * Math.pow(this.data.xp.croissance_xp_niveau, k - 1);
  }
  xpCumule(k: number): number {
    // XP totale pour atteindre le niveau k+1 depuis le niveau 1 (somme geometrique)
    let t = 0;
    for (let i = 1; i <= k; i++) t += this.xpPourNiveau(i);
    return t;
  }
  /** Progression dans le niveau courant (0..1). */
  xpFraction(): number {
    const base = this.niveauHeros > 1 ? this.xpCumule(this.niveauHeros - 1) : 0;
    return (this.xp - base) / this.xpPourNiveau(this.niveauHeros);
  }
  gagnerXp(montant: number): number {
    this.xp += montant;
    let up = 0;
    while (this.xp >= this.xpCumule(this.niveauHeros)) {
      this.niveauHeros++;
      up++;
    }
    if (up) {
      this.refresh();
      this.toasts.push(`Niveau ${this.niveauHeros} !`);
    }
    return up;
  }

  // ------------------------------------------------------------ Sonar
  private nextStep(): void {
    this.step++;
    this.recordStep = Math.max(this.recordStep, this.step);
    this.echos = genererEchos(this.data, this.opts.graine, this.step, this.prog);
    this.phase = 'sonar';
    if (this.step === CHOIX_MINIBOSS[0]) this.opts.onMilestone?.({ type: 'choix10', step: this.step });
    if (this.step === CHOIX_MINIBOSS[1]) this.opts.onMilestone?.({ type: 'choix20', step: this.step });
  }

  chooseEcho(i: number): void {
    if (this.phase !== 'sonar') throw new Error('Pas de choix de Sonar possible en phase ' + this.phase);
    const e = this.echos[i];
    if (!e) throw new Error('Echo inexistant');
    const rng = Rng.derive(this.opts.graine, this.step, e.seed);
    this.prog.compteurs[e.type] = (this.prog.compteurs[e.type] ?? 0) + 1;
    switch (e.type) {
      case 'combat':
        this.prog.combatsNormaux++;
        this.prog.combatsParTiers[tierDuChoix(this.step)]++;
        this.demarrerCombat('normal', e, rng);
        break;
      case 'miniboss':
        this.demarrerCombat('miniboss', e, rng);
        break;
      case 'boss':
        this.demarrerCombat('boss', e, rng);
        break;
      case 'epave':
        this.ouvrirEpave(rng);
        break;
      case 'grotte':
        this.ouvrirGrotte();
        break;
      case 'marchand':
        this.shop ??= genererShop(this.data, this.opts.graine);
        this.phase = 'shop';
        break;
      case 'autel':
        this.ouvrirAutel(rng);
        break;
      case 'mystere':
        this.ouvrirMystere(rng);
        break;
    }
  }

  // ------------------------------------------------------------ combat
  private demarrerCombat(kind: EnemyKind, echo: Echo | null, rng: Rng, piecesX = 1): void {
    const spec = buildEncounter(this.data, this.diff, this.info, kind, this.step, rng, {
      groupeId: echo?.groupe, miniIndex: echo?.miniIndex,
    });
    const hero: HeroInit = {
      element: this.heroElement, atk: this.atk(), maxHp: this.maxHp(), hp: this.hp, stats: { ...this.stats() },
    };
    this.currentPiecesX = piecesX;
    this.combat = new Combat(this.data, hero, spec, Rng.derive(this.opts.graine, this.step, 99, echo?.seed ?? 0),
      { renfort: (s) => buildRenfort(this.data, this.info, s, rng) });
    this.combatKind = kind;
    this.nbCombats++;
    this.phase = 'combat';
    this.butin = null;
  }

  /** A appeler a chaque image avec le dt (deja multiplie par la vitesse). */
  update(dt: number): void {
    if (this.phase !== 'combat' || !this.combat) return;
    this.combat.update(dt);
    if (this.combat.ended) this.terminerCombat();
  }

  private terminerCombat(): void {
    const c = this.combat!;
    this.hp = c.hero.hp;
    if (!c.result!.victoire) {
      this.phase = 'defaite';
      return;
    }
    const s = this.stats();
    const xpCfg = this.data.xp;
    const xpBase = this.combatKind === 'normal' ? xpCfg.xp_combat_normal : this.combatKind === 'miniboss' ? xpCfg.xp_mini_boss : xpCfg.xp_boss;
    const xp = Math.round(xpBase * (1 + stat(s, 'xpPct')));
    const pBase = this.data.prov.pieces[this.combatKind === 'normal' ? 'combat_normal' : this.combatKind];
    const pieces = Math.round(pBase * this.currentPiecesX * (1 + stat(s, 'coinPct')));
    this.pieces += pieces;
    const n0 = this.niveauHeros;
    this.gagnerXp(xp);
    this.butin = { xp, pieces, niveaux: this.niveauHeros - n0, kind: this.combatKind };
    // bonus temporaires : un combat de moins
    this.temp.forEach((t) => t.combats--);
    this.temp = this.temp.filter((t) => t.combats > 0);
    this.cache = null;
    this.hp = Decimal.min(this.hp, this.maxHp());
    if (this.combatKind === 'boss') {
      this.phase = 'victoire';
      this.opts.onMilestone?.({ type: 'fin', step: this.step });
      return;
    }
    this.pendingOffres.push({ rareteMin: 'commune', source: 'combat' });
    this.advance();
  }

  // ------------------------------------------------------------ mutations
  private ouvrirOffre(rareteMin: Rarete, source: string): void {
    const rng = Rng.derive(this.opts.graine, 1000 + this.offreCompteur++);
    this.offre = tirerMutations(this.data, rng, this.heroElement, this.mutations, { rareteMin });
    this.offreSource = source;
    if (!this.offre.length) {
      if (this.apresMutation === 'shop') {
        this.apresMutation = null;
        this.phase = 'shop';
      } else this.advance();
      return;
    }
    this.phase = 'mutation';
  }

  pickMutation(i: number): void {
    if (this.phase !== 'mutation') throw new Error('Pas de mutation a choisir');
    const m = this.offre[i];
    if (!m) throw new Error('Mutation inexistante');
    this.ajouterMutation(m);
    this.offre = [];
    if (this.apresMutation === 'shop') {
      this.apresMutation = null;
      this.phase = 'shop';
      return;
    }
    this.advance();
  }

  private ajouterMutation(m: MutationDef): void {
    this.mutations[m.id] = (this.mutations[m.id] ?? 0) + 1;
    this.nbMutations++;
    this.refresh();
  }

  /** Apres une rencontre/combat : mutations en attente, embuscade, sinon etape suivante. */
  private advance(): void {
    if (this.pendingOffres.length) {
      const o = this.pendingOffres.shift()!;
      this.ouvrirOffre(o.rareteMin, o.source);
      return;
    }
    if (this.pendingEmbuscade) {
      const e = this.pendingEmbuscade;
      this.pendingEmbuscade = null;
      this.prog.combatsNormaux++;
      this.prog.combatsParTiers[tierDuChoix(this.step)]++;
      this.demarrerCombat('normal', null, Rng.derive(this.opts.graine, this.step, 555), e.piecesX);
      return;
    }
    this.nextStep();
  }

  // ------------------------------------------------------------ effets generiques
  private appliquer(effets: Effet[]): string[] {
    const lignes: string[] = [];
    const max = () => this.maxHp();
    for (const e of effets) {
      switch (e.type) {
        case 'pv_pct': {
          const delta = max().mul(e.valeur!);
          const avant = this.hp;
          this.hp = Decimal.min(max(), Decimal.max(D(1), this.hp.add(delta)));
          lignes.push(e.valeur! >= 0 ? `+${Math.round(e.valeur! * 100)} % PV` : `${Math.round(e.valeur! * 100)} % PV`);
          void avant;
          break;
        }
        case 'pv_actuels_pct':
          this.hp = Decimal.max(D(1), this.hp.mul(1 + e.valeur!));
          lignes.push(`${Math.round(e.valeur! * 100)} % PV actuels`);
          break;
        case 'pieces': {
          const v = e.valeur! > 0 ? Math.round(e.valeur! * (1 + stat(this.stats(), 'coinPct'))) : e.valeur!;
          this.pieces = Math.max(0, this.pieces + v);
          lignes.push(`${v >= 0 ? '+' : ''}${v} pièces`);
          break;
        }
        case 'xp': {
          const v = Math.round(e.valeur! * (1 + stat(this.stats(), 'xpPct')));
          this.gagnerXp(v);
          lignes.push(`+${v} XP`);
          break;
        }
        case 'mutation':
          this.pendingOffres.push({ rareteMin: e.rarete_min ?? 'commune', source: 'effet' });
          lignes.push('Une mutation vous est offerte');
          break;
        case 'bonus_temp':
          this.temp.push({ stat: e.stat!, valeur: e.valeur!, combats: e.combats! });
          this.cache = null;
          lignes.push(`Bonus temporaire (${e.combats} combats)`);
          break;
        case 'pv_max_pct': {
          this.pvMaxBonus += e.valeur!;
          this.refresh();
          lignes.push(`${e.valeur! > 0 ? '+' : ''}${Math.round(e.valeur! * 100)} % PV max`);
          break;
        }
        case 'combat':
          this.pendingEmbuscade = { piecesX: e.pieces_x ?? 1 };
          break;
        default:
          break;
      }
    }
    return lignes;
  }

  // ------------------------------------------------------------ rencontres
  private ouvrirEpave(rng: Rng): void {
    const cfg = this.data.rencontres.epave;
    const effets: Effet[] = [{ type: 'pieces', valeur: rng.int(cfg.pieces[0], cfg.pieces[1]) }];
    if (rng.chance(cfg.chance_mutation)) effets.push({ type: 'mutation', rarete_min: cfg.rarete_min_mutation });
    this.rencontre = {
      type: 'epave', titre: 'Épave', texte: 'Vous forcez le coffre rouillé...', options: [{ label: 'Continuer' }],
      etat: 'resultat', resultat: this.appliquer(effets),
    };
    this.phase = 'rencontre';
  }

  private ouvrirGrotte(): void {
    const lignes = this.appliquer([{ type: 'pv_pct', valeur: this.data.rencontres.grotte.soin_pct }]);
    this.rencontre = {
      type: 'grotte', titre: 'Grotte', texte: 'Une poche d\'air tiède. Vous reprenez des forces.',
      options: [{ label: 'Continuer' }], etat: 'resultat', resultat: lignes,
    };
    this.phase = 'rencontre';
  }

  private ouvrirAutel(rng: Rng): void {
    const cfg = this.data.rencontres.autel;
    const [mut] = tirerMutations(this.data, rng, this.heroElement, this.mutations, { n: 1, rareteMin: cfg.rarete_min });
    const couts = cfg.couts.filter((c) => !c.conditionPieces || this.pieces >= c.conditionPieces);
    const cout = rng.pick(couts.length ? couts : cfg.couts.filter((c) => !c.conditionPieces));
    if (!mut) {
      this.rencontre = {
        type: 'autel', titre: 'Autel des Anciens', texte: 'L\'autel est muet : vous avez déjà tout reçu.',
        options: [{ label: 'Continuer' }], etat: 'resultat', resultat: [],
      };
      this.phase = 'rencontre';
      return;
    }
    this.rencontre = {
      type: 'autel', titre: 'Autel des Anciens',
      texte: `${mut.nom} (${this.data.mutations.raretes[mut.rarete].nom}) : ${mut.description}.\nPrix : ${cout.texte}.`,
      options: [{ label: 'Accepter' }, { label: 'Refuser' }], etat: 'choix', mutationAutel: mut,
    };
    this.resolveRencontre = (i) => {
      if (i !== 0) return ['Vous tournez le dos à l\'autel.'];
      const lignes = this.appliquer(cout.effets as Effet[]);
      this.ajouterMutation(mut);
      return [...lignes, `${mut.nom} acquise`];
    };
    this.phase = 'rencontre';
  }

  private ouvrirMystere(rng: Rng): void {
    let pool: EventDef[] = this.data.rencontres.mysteres.filter((e) => !this.mysteresVus.includes(e.id));
    const cfgS = this.data.prov.tirage_sonar;
    const reserve = this.prog.combatsParTiers.reduce((a, n) => a + Math.max(0, cfgS.combat_min_par_tiers - n), 0);
    if (this.prog.combatsNormaux + reserve >= cfgS.combats_normaux_max) pool = pool.filter((e) => e.id !== 'embuscade');
    const ev = rng.pick(pool.length ? pool : this.data.rencontres.mysteres);
    this.mysteresVus.push(ev.id);
    this.rencontre = {
      type: 'mystere', titre: ev.titre, texte: ev.texte, etat: 'choix',
      options: ev.options.map((o: EventOption) => ({ label: o.label + (o.coutPieces ? ` (${o.coutPieces} pièces)` : ''), disabled: !!o.coutPieces && this.pieces < o.coutPieces })),
    };
    this.resolveRencontre = (i) => {
      const opt = ev.options[i];
      const issue = opt.issues[rng.weighted(opt.issues.map((x) => x.poids))];
      return [issue.texte, ...this.appliquer(issue.effets)];
    };
    this.phase = 'rencontre';
  }

  /** Choix dans une rencontre (autel / mystere) ou 'Continuer' une fois le resultat affiche. */
  choisirRencontre(i: number): void {
    const r = this.rencontre;
    if (this.phase !== 'rencontre' || !r) throw new Error('Pas de rencontre en cours');
    if (r.etat === 'choix') {
      if (r.options[i]?.disabled) return;
      r.resultat = this.resolveRencontre!(i);
      this.resolveRencontre = null;
      r.etat = 'resultat';
      r.options = [{ label: 'Continuer' }];
      return;
    }
    this.rencontre = null;
    this.advance();
  }

  // ------------------------------------------------------------ shop
  acheter(i: number): boolean {
    if (this.phase !== 'shop' || !this.shop) return false;
    const slot = this.shop.slots[i];
    if (!slot || epuise(slot)) return false;
    const prix = prixActuel(slot);
    if (this.pieces < prix) return false;
    this.pieces -= prix;
    slot.achete++;
    const eff = slot.article.effet;
    this.appliquer([eff]);
    if (this.pendingOffres.length) {
      this.apresMutation = 'shop';
      const o = this.pendingOffres.shift()!;
      this.ouvrirOffre(o.rareteMin, 'shop');
    }
    return true;
  }

  quitterShop(): void {
    if (this.phase !== 'shop') return;
    this.advance();
  }

  // ------------------------------------------------------------ sauvegarde de la partie en cours
  /** Etat complet au choix de Sonar en attente (seul moment ou la partie est sauvegardee). */
  sauvegarde(): SauvegardePartie {
    if (this.phase !== 'sonar') throw new Error('La partie ne se sauvegarde qu\'au choix de Sonar (phase ' + this.phase + ')');
    const { niveau, heroId, graine, ratio } = this.opts;
    return JSON.parse(JSON.stringify({
      v: 1, opts: { niveau, heroId, graine, ratio }, step: this.step, echos: this.echos, prog: this.prog, hp: this.hp.toString(),
      pieces: this.pieces, xp: this.xp, niveauHeros: this.niveauHeros, mutations: this.mutations, temp: this.temp, pvMaxBonus: this.pvMaxBonus,
      shop: this.shop ? this.shop.slots.map((sl) => ({ id: sl.article.id, achete: sl.achete })) : null,
      nbCombats: this.nbCombats, nbMutations: this.nbMutations, recordStep: this.recordStep, offreCompteur: this.offreCompteur, mysteresVus: this.mysteresVus,
    }));
  }

  /** Reprend une partie sauvegardee, au choix de Sonar ou elle s'etait arretee. */
  static restaurer(data: GameData, diff: Difficulty, sv: SauvegardePartie, onMilestone?: (m: Milestone) => void): Run {
    const r = new Run(data, diff, { ...sv.opts });
    r.step = sv.step;
    r.echos = sv.echos;
    r.prog = sv.prog;
    r.pieces = sv.pieces;
    r.xp = sv.xp;
    r.niveauHeros = sv.niveauHeros;
    r.mutations = { ...sv.mutations };
    r.temp = sv.temp.map((x) => ({ ...x }));
    r.pvMaxBonus = sv.pvMaxBonus;
    r.shop = sv.shop ? { slots: sv.shop.map((x) => ({ article: data.boutique.articles.find((a) => a.id === x.id)!, achete: x.achete })) } : null;
    r.nbCombats = sv.nbCombats;
    r.nbMutations = sv.nbMutations;
    r.recordStep = sv.recordStep;
    r.offreCompteur = sv.offreCompteur;
    r.mysteresVus = [...sv.mysteresVus];
    r.cache = null;
    r.hp = D(sv.hp);
    r.phase = 'sonar';
    r.opts.onMilestone = onMilestone;
    if (sv.choix !== undefined) r.chooseEcho(sv.choix); // la rencontre reprend depuis son debut
    return r;
  }

  get fini(): boolean { return this.phase === 'victoire' || this.phase === 'defaite'; }
  get progression(): number { return this.step / NB_CHOIX; }
}
