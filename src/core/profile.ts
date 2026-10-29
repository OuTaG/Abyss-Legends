// Profil permanent du joueur (hors partie) : record, cles de premiere fois, energie, ressources, parametres.
import { D, Decimal, fromSave, toSave } from './num';
import type { GameData } from '../data/build';
import { niveauInfo } from './difficulty';
import type { Milestone, SauvegardePartie } from './run';

export const QUALITES_CLES = ['bois', 'fer', 'laiton', 'or', 'nacre'] as const;
export type QualiteCle = (typeof QUALITES_CLES)[number];

export interface ProgresNiveau {
  record: number; // choix le plus loin atteint (1..30)
  termine: boolean;
  cles: { c10: boolean; c20: boolean; fin: boolean };
  tentatives: number;
}

export interface Profil {
  version: number;
  parametres: { abonne: boolean; preset: string; heroId: string; niveau: number; langue: string };
  energie: { valeur: number; majLe: number };
  cles: Record<QualiteCle, number>;
  ressources: { or: string; xpHeros: string; nourriture: string; ressourcePermanente: string; gemmes: number; ressourceMonde: Record<string, string> };
  niveaux: Record<string, ProgresNiveau>;
  /** Partie en cours, sauvegardee a chaque choix de Sonar (null hors partie). */
  partieEnCours: SauvegardePartie | null;
}

export function nouveauProfil(data: GameData, now: number): Profil {
  return {
    version: 3,
    parametres: { abonne: false, preset: data.prov.puissance_joueur.ratio_defaut, heroId: data.herosContent.heros_defaut, niveau: 1, langue: 'auto' },
    energie: { valeur: data.energie.plafond_regeneration, majLe: now },
    cles: { bois: 0, fer: 0, laiton: 0, or: 0, nacre: 0 },
    ressources: { or: '0', xpHeros: '0', nourriture: '0', ressourcePermanente: '0', gemmes: 0, ressourceMonde: {} },
    niveaux: {},
    partieEnCours: null,
  };
}

export const progres = (p: Profil, niveau: number): ProgresNiveau =>
  (p.niveaux[String(niveau)] ??= { record: 0, termine: false, cles: { c10: false, c20: false, fin: false }, tentatives: 0 });

// ------------------------------------------------------------ energie (calcul direct, jamais de boucle seconde par seconde)
export function energieActuelle(p: Profil, data: GameData, now: number): number {
  const e = data.energie;
  const { valeur, majLe } = p.energie;
  if (valeur >= e.plafond_regeneration) return valeur;
  const gagnes = Math.floor(Math.max(0, now - majLe) / (e.minutes_par_point * 60000));
  return Math.min(e.plafond_regeneration, valeur + gagnes);
}

/** Met a jour la valeur stockee (conserve le reste de la minuterie de regeneration). */
function synchroniserEnergie(p: Profil, data: GameData, now: number): void {
  const e = data.energie;
  const cur = energieActuelle(p, data, now);
  if (p.energie.valeur >= e.plafond_regeneration || cur >= e.plafond_regeneration) {
    p.energie = { valeur: cur, majLe: now };
    return;
  }
  const gagnes = cur - p.energie.valeur;
  p.energie = { valeur: cur, majLe: p.energie.majLe + gagnes * e.minutes_par_point * 60000 };
}

export function peutLancer(p: Profil, data: GameData, now: number): boolean {
  return energieActuelle(p, data, now) >= data.energie.cout_tentative;
}

export function depenserEnergie(p: Profil, data: GameData, now: number): boolean {
  if (!peutLancer(p, data, now)) return false;
  synchroniserEnergie(p, data, now);
  const etaitPlein = p.energie.valeur >= data.energie.plafond_regeneration;
  p.energie.valeur -= data.energie.cout_tentative;
  if (etaitPlein) p.energie.majLe = now;
  return true;
}

export function secondesAvantPoint(p: Profil, data: GameData, now: number): number {
  if (energieActuelle(p, data, now) >= data.energie.plafond_regeneration) return 0;
  const cycle = data.energie.minutes_par_point * 60000;
  return Math.ceil((cycle - ((now - p.energie.majLe) % cycle)) / 1000);
}

// ------------------------------------------------------------ cles (GDD 8.7) : premiere fois seulement
export function clesDuPalier(data: GameData, niveau: number, palier: 'c10' | 'c20' | 'fin'): QualiteCle[] {
  const t = data.tirages.cles_premiere_fois_par_niveau;
  const cfg = niveauInfo(data, niveau).boss8 ? t.niveau_boss_8 : t.niveau_normal;
  const v = palier === 'c10' ? cfg.choix_10 : palier === 'c20' ? cfg.choix_20 : cfg.fin;
  return (Array.isArray(v) ? v : [v]) as QualiteCle[];
}

/** Applique un palier atteint ; renvoie les cles gagnees ([] si deja reclame). */
export function reclamerPalier(p: Profil, data: GameData, niveau: number, m: Milestone): QualiteCle[] {
  const palier = m.type === 'choix10' ? 'c10' : m.type === 'choix20' ? 'c20' : 'fin';
  const pr = progres(p, niveau);
  pr.record = Math.max(pr.record, m.step);
  if (pr.cles[palier]) return [];
  pr.cles[palier] = true;
  const cles = clesDuPalier(data, niveau, palier);
  for (const c of cles) p.cles[c]++;
  return cles;
}

// ------------------------------------------------------------ recompenses de fin de tentative (economie_sources.json)
export interface RecompenseTentative { or: Decimal; xpHeros: Decimal; nourriture: Decimal; ressourcePermanente: Decimal; ressourceMonde: Decimal; gemmes: number }

/** Valeur victoire x echelle^(L-1) x (0,2 + 0,8 x part jouee). Premiere victoire : bonus en plus. */
export function recompenseTentative(data: GameData, niveau: number, partJouee: number, victoire: boolean, premiere: boolean): RecompenseTentative {
  const v = data.economie.victoire;
  const f = Decimal.pow(data.economie.echelle_recompense_par_niveau, niveau - 1).mul(0.2 + 0.8 * Math.min(1, Math.max(0, partJouee)));
  const r: RecompenseTentative = {
    or: D(v.or).mul(f), xpHeros: D(v.xp_heros).mul(f), nourriture: D(v.nourriture).mul(f),
    ressourcePermanente: D(v.ressource_permanente), ressourceMonde: D(v.ressource_monde), gemmes: 0,
  };
  if (victoire && premiere) {
    const pv = data.economie.premiere_victoire;
    r.or = r.or.add(D(v.or).mul(pv.or_victoires_bonus).mul(Decimal.pow(data.economie.echelle_recompense_par_niveau, niveau - 1)));
    r.gemmes = pv.gemmes;
    r.ressourcePermanente = r.ressourcePermanente.add(pv.ressource_permanente);
    r.ressourceMonde = r.ressourceMonde.add(pv.ressource_monde);
  }
  return r;
}

export function appliquerRecompense(p: Profil, data: GameData, niveau: number, r: RecompenseTentative): void {
  const res = p.ressources;
  res.or = toSave(fromSave(res.or).add(r.or));
  res.xpHeros = toSave(fromSave(res.xpHeros).add(r.xpHeros));
  res.nourriture = toSave(fromSave(res.nourriture).add(r.nourriture));
  res.ressourcePermanente = toSave(fromSave(res.ressourcePermanente).add(r.ressourcePermanente));
  res.gemmes += r.gemmes;
  const mid = String(niveauInfo(data, niveau).monde.id);
  res.ressourceMonde[mid] = toSave(fromSave(res.ressourceMonde[mid]).add(r.ressourceMonde));
}

/** Fin de partie : met a jour le record et les recompenses. Renvoie la recompense accordee. */
export function terminerPartie(p: Profil, data: GameData, niveau: number, step: number, victoire: boolean): RecompenseTentative {
  const pr = progres(p, niveau);
  pr.tentatives++;
  pr.record = Math.max(pr.record, step);
  const premiere = victoire && !pr.termine;
  if (victoire) pr.termine = true;
  const r = recompenseTentative(data, niveau, step / 30, victoire, premiere);
  appliquerRecompense(p, data, niveau, r);
  return r;
}
