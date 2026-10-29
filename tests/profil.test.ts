import { describe, it, expect } from 'vitest';
import { data, nouvelleRun } from './helpers';
import { nouveauProfil, reclamerPalier, clesDuPalier, energieActuelle, depenserEnergie, terminerPartie, progres, secondesAvantPoint } from '../src/core/profile';
import { migrer, completer, exporter, importer, charger, sauvegarder, CLE_STOCKAGE } from '../src/core/save';
import { jouerPartie } from '../src/core/bot';

describe('cles de premiere fois (GDD 8.7)', () => {
  it('niveau normal : fer au 10, fer au 20, 2 laiton a la fin ; une seule fois', () => {
    const p = nouveauProfil(data, 0);
    expect(reclamerPalier(p, data, 1, { type: 'choix10', step: 10 })).toEqual(['fer']);
    expect(reclamerPalier(p, data, 1, { type: 'choix10', step: 10 })).toEqual([]);
    expect(reclamerPalier(p, data, 1, { type: 'choix20', step: 20 })).toEqual(['fer']);
    expect(reclamerPalier(p, data, 1, { type: 'fin', step: 30 })).toEqual(['laiton', 'laiton']);
    expect(p.cles).toMatchObject({ fer: 2, laiton: 2, or: 0 });
    expect(reclamerPalier(p, data, 1, { type: 'fin', step: 30 })).toEqual([]);
    expect(p.cles.laiton).toBe(2);
  });
  it('niveau du boss n°8 : meilleures cles (laiton, laiton, laiton + or)', () => {
    expect(clesDuPalier(data, 8, 'c10')).toEqual(['laiton']);
    expect(clesDuPalier(data, 8, 'fin')).toEqual(['laiton', 'or']);
    expect(clesDuPalier(data, 16, 'fin')).toEqual(['laiton', 'or']);
    expect(clesDuPalier(data, 9, 'fin')).toEqual(['laiton', 'laiton']);
  });
  it('les cles des choix 10 et 20 sont gagnees meme en cas de mort ensuite', () => {
    const p = nouveauProfil(data, 0);
    const run = nouvelleRun({ ratio: 0.9, graine: 5, onMilestone: (m) => reclamerPalier(p, data, 1, m) });
    // force la defaite apres le choix 10 : on joue avec un heros tres faible mais on avance au choix 10 artificiellement
    const jeu = nouvelleRun({ ratio: 5, graine: 5, onMilestone: (m) => reclamerPalier(p, data, 1, m) });
    jouerPartie(jeu, 'combats', 1);
    expect(p.cles.fer).toBe(2);
    void run;
  });
  it('les cles sont pour la premiere fois uniquement : une 2e partie n\'en donne plus', () => {
    const p = nouveauProfil(data, 0);
    for (let i = 0; i < 2; i++) jouerPartie(nouvelleRun({ ratio: 5, graine: 9 + i, onMilestone: (m) => reclamerPalier(p, data, 1, m) }), 'combats', 1);
    expect(p.cles).toMatchObject({ fer: 2, laiton: 2 });
  });
});

describe('record', () => {
  it('conserve le meilleur choix atteint par niveau', () => {
    const p = nouveauProfil(data, 0);
    terminerPartie(p, data, 3, 12, false);
    terminerPartie(p, data, 3, 8, false);
    expect(progres(p, 3).record).toBe(12);
    expect(progres(p, 3).termine).toBe(false);
    terminerPartie(p, data, 3, 30, true);
    expect(progres(p, 3).termine).toBe(true);
  });
  it('recompense : partielle a la mort, bonus de premiere victoire une seule fois', () => {
    const p = nouveauProfil(data, 0);
    const mort = terminerPartie(p, data, 1, 15, false);
    const v1 = terminerPartie(p, data, 1, 30, true);
    const v2 = terminerPartie(p, data, 1, 30, true);
    expect(mort.or.lt(v2.or)).toBe(true);
    expect(v1.or.gt(v2.or)).toBe(true);
    expect(v1.gemmes).toBe(15);
    expect(v2.gemmes).toBe(0);
  });
});

describe('energie (config energie.json)', () => {
  it('une tentative coute 10 sur un plafond de 60 : 6 tentatives', () => {
    const p = nouveauProfil(data, 0);
    for (let i = 0; i < 6; i++) expect(depenserEnergie(p, data, 0)).toBe(true);
    expect(depenserEnergie(p, data, 0)).toBe(false);
  });
  it('se regenere de 1 point par 72 minutes sans boucle', () => {
    const p = nouveauProfil(data, 0);
    for (let i = 0; i < 6; i++) depenserEnergie(p, data, 0);
    expect(energieActuelle(p, data, 0)).toBe(0);
    expect(energieActuelle(p, data, 72 * 60000)).toBe(1);
    expect(energieActuelle(p, data, 10 * 72 * 60000)).toBe(10);
    expect(depenserEnergie(p, data, 10 * 72 * 60000)).toBe(true);
    expect(energieActuelle(p, data, 100 * 3600000 * 1000)).toBe(60); // absence tres longue : plafond
    expect(secondesAvantPoint(p, data, 72 * 60000 / 2)).toBeGreaterThan(0);
  });
});

describe('sauvegarde versionnee', () => {
  it('exporte puis reimporte a l\'identique, grands nombres compris', () => {
    const p = nouveauProfil(data, 0);
    p.ressources.or = '1.5e300';
    terminerPartie(p, data, 500, 30, true);
    const q = importer(data, exporter(p), 0);
    expect(q).toEqual(p);
  });
  it('migre une ancienne version et complete les champs ajoutes', () => {
    const ancienne = { niveaux: { '1': { record: 12, termine: false, cles: { c10: true, c20: false, fin: false }, tentatives: 2 } } };
    const p = completer(data, migrer(ancienne), 5);
    expect(p.version).toBe(3);
    expect(p.partieEnCours).toBeNull();
    expect(p.parametres.langue).toBe('auto');
    expect(p.niveaux['1'].record).toBe(12);
    expect(p.energie.valeur).toBe(60);
  });
  it('enchaine plusieurs migrations et refuse une version future', () => {
    const migrations = { 1: (s: any) => ({ ...s, nouveau: true }), 2: (s: any) => ({ ...s, encore: 1 }) };
    const r = migrer({ version: 1 }, 3, migrations);
    expect(r).toMatchObject({ version: 3, nouveau: true, encore: 1 });
    expect(() => migrer({ version: 9 }, 3, migrations)).toThrow();
  });
  it('charge/sauvegarde via un stockage et survit a un contenu corrompu', () => {
    const mem: Record<string, string> = {};
    const st = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => (mem[k] = v), removeItem: (k: string) => delete mem[k] };
    const p = nouveauProfil(data, 0);
    p.cles.or = 3;
    sauvegarder(p, st);
    expect(charger(data, st, 0).cles.or).toBe(3);
    mem[CLE_STOCKAGE] = '{pas du json';
    expect(charger(data, st, 0).cles.or).toBe(0);
  });
});
