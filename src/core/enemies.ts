import { Decimal } from './num';
import type { GameData } from '../data/build';
import type { Difficulty, NiveauInfo } from './difficulty';
import type { Comportement, Element, BossPattern, FamilleDef } from './types';
import { Rng } from './rng';

export type EnemyKind = 'normal' | 'miniboss' | 'boss';

export interface EnemySpec {
  nom: string;
  famille: string | null;
  element: Element;
  forme: string;
  comportement: Comportement | 'boss';
  kind: EnemyKind;
  hp: Decimal;
  atk: Decimal;
  intervalle: number;
  echelle: number; // taille visuelle (niveau 1/2/3, boss)
  tier: number; // 0..2
  def?: FamilleDef;
  pattern?: BossPattern;
}

export interface EncounterSpec {
  kind: EnemyKind;
  enemies: EnemySpec[];
  tier: number;
  groupe?: string;
  /** Puissance de l'ennemi (reference), utile pour l'affichage/debug. */
  puissance: Decimal;
}

/** Index de tiers 0/1/2 selon le choix (GDD 5.1) : niveau 1 avant le choix 10, 2 entre 10 et 20, 3 ensuite. */
export function tierDuChoix(step: number): number {
  return step < 10 ? 0 : step < 20 ? 1 : 2;
}

/** Puissance attendue du joueur (fraction de D(L)) au choix donne, interpolee lineairement. */
export function puissanceAttendue(data: GameData, step: number): number {
  const pts = data.prov.puissance_joueur.courbe_attendue as number[][];
  if (step <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (step <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return y0 + ((y1 - y0) * (step - x0)) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
}

/** Multiplicateur de difficulte de l'ennemi (difficulte_niveaux.json > ennemis_pour_developpeurs). */
export function multiplicateurEnnemi(data: GameData, kind: EnemyKind, step: number): number {
  const c = data.difficulte.ennemis_pour_developpeurs;
  if (kind === 'boss') return c.boss_final;
  if (kind === 'miniboss') return step <= 10 ? c.mini_boss_choix_10 : c.mini_boss_choix_20;
  const t = tierDuChoix(step);
  return [c.niveau_ennemi_1_choix_1_a_9, c.niveau_ennemi_2_choix_11_a_19, c.niveau_ennemi_3_choix_21_a_30][t];
}

export function choisirGroupe(data: GameData, rng: Rng, exclure: string[] = []): string {
  const g = data.familles.groupes.filter((x) => !exclure.includes(x.id));
  const liste = g.length ? g : data.familles.groupes;
  return liste[rng.weighted(liste.map((x) => x.poids))].id;
}

export interface BuildOpts {
  groupeId?: string;
  miniIndex?: number;
  /** Renfort : nombre/forme specifiques (ex. essaim invoque par le boss). */
}

export function buildEncounter(
  data: GameData, diff: Difficulty, info: NiveauInfo, kind: EnemyKind, step: number, rng: Rng, opts: BuildOpts = {},
): EncounterSpec {
  const P = data.prov;
  const puissance = diff.puissance(info.niveau).mul(puissanceAttendue(data, step)).mul(multiplicateurEnnemi(data, kind, step));
  const racine = puissance.sqrt();
  const pvTotal = racine.mul(P.ennemis.pv_par_unite * P.ennemis.unites_pv[kind]);
  const dpsTotal = racine.mul(P.ennemis.dps_par_unite * P.ennemis.unites_dps[kind]);
  const tier = kind === 'normal' ? tierDuChoix(step) : kind === 'miniboss' ? (step <= 10 ? 1 : 2) : 2;
  const tiers = data.familles.tiers;

  if (kind !== 'normal') {
    const pool = kind === 'boss' ? [info.boss] : info.monde.miniboss;
    const def = kind === 'boss' ? info.boss : pool[(opts.miniIndex ?? 0) % pool.length];
    const pattern = kind === 'boss' ? data.familles.boss_pattern.boss : data.familles.boss_pattern.miniboss;
    const interval = kind === 'boss' ? P.ennemis.intervalle_boss_s : P.ennemis.intervalle_miniboss_s;
    return {
      kind, tier, puissance,
      enemies: [{
        nom: def.nom, famille: null, element: def.element, forme: def.forme, comportement: 'boss', kind,
        hp: pvTotal, atk: dpsTotal.mul(interval), intervalle: interval,
        echelle: kind === 'boss' ? 2.2 : 1.6, tier, pattern,
      }],
    };
  }

  const gid = opts.groupeId ?? choisirGroupe(data, rng);
  const groupe = data.familles.groupes.find((g) => g.id === gid)!;
  const fams = groupe.familles.map((f) => ({ id: f, def: data.familles.familles[f] }));
  const sumPv = fams.reduce((a, f) => a + f.def.pv, 0);
  const sumDps = fams.reduce((a, f) => a + f.def.atk / f.def.intervalle, 0);
  const enemies: EnemySpec[] = fams.map((f) => {
    const w = info.monde.familles[f.id];
    const partDps = f.def.atk / f.def.intervalle / sumDps;
    return {
      nom: w.nom + tiers[tier].suffixe, famille: f.id, element: w.element, forme: f.def.forme,
      comportement: f.def.comportement, kind, tier, def: f.def,
      hp: pvTotal.mul(f.def.pv / sumPv),
      atk: dpsTotal.mul(partDps).mul(f.def.intervalle),
      intervalle: f.def.intervalle,
      echelle: tiers[tier].echelle * (f.def.pv >= 2 ? 1.15 : f.def.pv < 0.5 ? 0.8 : 1),
    };
  });
  return { kind, tier, enemies, groupe: gid, puissance };
}

/** Renfort invoque par un boss (une famille du monde, petite). */
export function buildRenfort(data: GameData, info: NiveauInfo, spec: EnemySpec, rng: Rng): EnemySpec {
  const pat = spec.pattern!;
  const famId = pat.renforts_famille ?? 'essaim';
  const def = data.familles.familles[famId];
  const w = info.monde.familles[famId];
  const frac = data.prov.ennemis.renfort_part_pv;
  void rng;
  return {
    nom: w.nom, famille: famId, element: w.element, forme: def.forme, comportement: def.comportement,
    kind: 'normal', tier: spec.tier, def,
    hp: spec.hp.mul(frac), atk: spec.atk.mul(0.35), intervalle: def.intervalle, echelle: 0.7,
  };
}
