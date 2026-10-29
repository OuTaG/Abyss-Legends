// Sauvegarde versionnee : localStorage, export/import (texte base64), migrations successives.
import type { GameData } from '../data/build';
import { nouveauProfil, type Profil } from './profile';

export const VERSION_SAUVEGARDE = 3;
export const CLE_STOCKAGE = 'abyss-legends-save';

export type Migration = (s: any) => any;

/** migrations[n] transforme une sauvegarde de version n en version n+1. */
export const MIGRATIONS: Record<number, Migration> = {
  // 0 -> 1 : anciennes sauvegardes sans numero de version (prototypes tres precoces)
  0: (s) => ({ ...s, version: 1, niveaux: s.niveaux ?? {} }),
  // 1 -> 2 : choix de la langue (auto = langue de l'appareil)
  1: (s) => ({ ...s, parametres: { ...(s.parametres ?? {}), langue: s.parametres?.langue ?? 'auto' } }),
  // 2 -> 3 : sauvegarde de la partie en cours (aucune pour les anciennes sauvegardes)
  2: (s) => ({ ...s, partieEnCours: s.partieEnCours ?? null }),
};

export function migrer(brut: any, cible = VERSION_SAUVEGARDE, migrations: Record<number, Migration> = MIGRATIONS): any {
  let s = { ...brut };
  let v = typeof s.version === 'number' ? s.version : 0;
  if (v > cible) throw new Error(`Sauvegarde trop récente (v${v} > v${cible})`);
  while (v < cible) {
    const m = migrations[v];
    if (!m) throw new Error(`Migration ${v} -> ${v + 1} manquante`);
    s = m(s);
    v++;
    s.version = v;
  }
  return s;
}

/** Complete une sauvegarde partielle avec les valeurs par defaut (nouveaux champs ajoutes par une mise a jour). */
export function completer(data: GameData, brut: any, now: number): Profil {
  const base = nouveauProfil(data, now);
  return {
    ...base, ...brut,
    parametres: { ...base.parametres, ...(brut.parametres ?? {}) },
    energie: { ...base.energie, ...(brut.energie ?? {}) },
    cles: { ...base.cles, ...(brut.cles ?? {}) },
    ressources: { ...base.ressources, ...(brut.ressources ?? {}) },
    niveaux: brut.niveaux ?? {},
    partieEnCours: brut.partieEnCours ?? null,
  };
}

export function exporter(p: Profil): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(p))));
}
export function importer(data: GameData, texte: string, now: number): Profil {
  const json = JSON.parse(decodeURIComponent(escape(atob(texte.trim()))));
  return completer(data, migrer(json), now);
}

export interface Stockage { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

export function charger(data: GameData, st: Stockage, now: number): Profil {
  const txt = st.getItem(CLE_STOCKAGE);
  if (!txt) return nouveauProfil(data, now);
  try {
    return completer(data, migrer(JSON.parse(txt)), now);
  } catch (e) {
    console.warn('Sauvegarde illisible, nouvelle partie', e);
    return nouveauProfil(data, now);
  }
}
export function sauvegarder(p: Profil, st: Stockage): void {
  st.setItem(CLE_STOCKAGE, JSON.stringify(p));
}
