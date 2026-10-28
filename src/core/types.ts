export type Element = 'Courant' | 'Encre' | 'Lumen' | 'Pression' | 'Corail';
export const ELEMENTS: Element[] = ['Courant', 'Encre', 'Lumen', 'Pression', 'Corail'];

export type Rarete = 'commune' | 'rare' | 'epique';
export type StatKey =
  | 'atkPct' | 'hpPct' | 'critChance' | 'critMult' | 'speedPct' | 'regen' | 'dr'
  | 'petDmg' | 'mountDmg' | 'guardianDmg' | 'coinPct' | 'xpPct' | 'lifesteal' | 'thorns'
  | 'dodge' | 'poisonOnHit' | 'stunChance' | 'execute' | 'healOnKill' | 'shieldStart'
  | 'multiHit' | 'advDmg' | 'assistReduce' | 'ramp';
export type Stats = Partial<Record<StatKey, number>>;

export interface MutationDef {
  id: string;
  nom: string;
  rarete: Rarete;
  description: string;
  effets: Stats;
  element?: Element;
  pileMax?: number;
}

export interface BossDef { id: string; nom: string; element: Element; forme: string }
export interface WorldFamily { nom: string; element: Element }
export interface WorldDef {
  id: number;
  nom: string;
  niveaux: number;
  palette: { fondHaut: string; fondBas: string; rayons: string; accent: string };
  boss: BossDef[];
  miniboss: BossDef[];
  familles: Record<string, WorldFamily>;
}

export type Comportement = 'essaim' | 'armure' | 'poison' | 'charge' | 'embuscade' | 'distance';
export interface FamilleDef {
  role: string;
  comportement: Comportement;
  pv: number;
  atk: number;
  intervalle: number;
  forme: string;
  armure?: number;
  poison_dps?: number;
  poison_duree?: number;
  faiblesse?: number;
  charge_prep?: number;
  charge_mult?: number;
  embuscade_delai?: number;
  embuscade_mult?: number;
}
export interface BossPattern {
  lourde_toutes_s: number; lourde_prep: number; lourde_mult: number;
  enrage_sous: number; enrage_atk: number; renforts: number[];
  renforts_famille?: string; renforts_nombre?: number;
}
export interface FamillesData {
  tiers: { echelle: number; suffixe: string }[];
  familles: Record<string, FamilleDef>;
  groupes: { id: string; familles: string[]; poids: number }[];
  boss_pattern: { miniboss: BossPattern; boss: BossPattern };
}

export type EchoType = 'combat' | 'epave' | 'grotte' | 'marchand' | 'autel' | 'mystere' | 'miniboss' | 'boss';

export interface Effet {
  type: 'pv_pct' | 'pv_actuels_pct' | 'pieces' | 'xp' | 'mutation' | 'bonus_temp' | 'combat' | 'pv_max_pct' | 'rien';
  valeur?: number;
  rarete_min?: Rarete;
  stat?: StatKey;
  combats?: number;
  pieces_x?: number;
}
export interface EventOption {
  label: string;
  coutPieces?: number;
  issues: { poids: number; texte: string; effets: Effet[] }[];
}
export interface EventDef { id: string; titre: string; texte: string; options: EventOption[] }
export interface ShopArticle {
  id: string; nom: string; description: string; prix: number; poids: number; max: number; garanti?: boolean; effet: Effet;
}
