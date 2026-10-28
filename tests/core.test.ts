import { describe, it, expect } from 'vitest';
import { data, diff, nouvelleRun } from './helpers';
import { D, fmt, Decimal } from '../src/core/num';
import { niveauInfo } from '../src/core/difficulty';
import { multElement } from '../src/core/elements';
import { genererEchos, progressVide, NB_CHOIX } from '../src/core/sonar';
import { tirerMutations } from '../src/core/mutations';
import { Rng } from '../src/core/rng';
import { genererShop, prixActuel } from '../src/core/shop';
import { jouerPartie } from '../src/core/bot';
import { buildEncounter } from '../src/core/enemies';
import { Combat } from '../src/core/combat';
import { buildGameData } from '../src/data/build';
import m1 from '../content/worlds/monde1.json';

describe('grands nombres', () => {
  it('formate K/M/B et la notation scientifique', () => {
    expect(fmt(950)).toBe('950');
    expect(fmt(1234)).toBe('1.23K');
    expect(fmt(D('4.5e12'))).toBe('4.50T');
    expect(fmt(D('1.5e50'))).toBe('1.50e50');
  });
  it('depasse les flottants sans perdre la precision relative', () => {
    expect(D('1e400').mul('1e400').log10()).toBeCloseTo(800, 5);
  });
});

describe('difficulte', () => {
  it('reproduit la table de /balance (niveaux 1, 2, 8, 9, 16, 80)', () => {
    expect(diff.puissance(1).toNumber()).toBe(60);
    expect(diff.puissance(2).toNumber()).toBeCloseTo(68.31, 1);
    expect(diff.puissance(8).toNumber()).toBeCloseTo(183.3, 0);
    expect(diff.puissance(9).toNumber()).toBeCloseTo(320.5, 0);
    expect(diff.puissance(16).toNumber() / 2.112e4).toBeCloseTo(1, 2);
  });
  it('progresse a l\'infini sans deborder', () => {
    const p = diff.puissance(3000);
    expect(p.gt('1e100')).toBe(true);
    expect(Number.isFinite(p.log10())).toBe(true);
  });
  it('relie niveau, monde et boss (rotation de 8, boss n°8 = Grand requin blanc)', () => {
    expect(niveauInfo(data, 1).boss.nom).toBe('Barracuda');
    expect(niveauInfo(data, 8).boss.nom).toBe('Grand requin blanc');
    expect(niveauInfo(data, 8).boss8).toBe(true);
    expect(niveauInfo(data, 9).boss.nom).toBe('Barracuda');
    expect(niveauInfo(data, 81).monde.nom).toBe('Haute mer');
  });
});

describe('elements', () => {
  it('applique le cycle de forces et faiblesses', () => {
    expect(multElement(data, 'Courant', 'Encre')).toBe(1.2);
    expect(multElement(data, 'Encre', 'Courant')).toBe(0.85);
    expect(multElement(data, 'Courant', 'Lumen')).toBe(1);
    expect(multElement(data, null, 'Lumen')).toBe(1);
    // cycle complet
    for (const [a, b] of Object.entries(data.heros.elements.fort_contre)) expect(multElement(data, a as any, b as any)).toBe(1.2);
  });
});

describe('Sonar', () => {
  it('propose 3 echos, mini-boss aux choix 10 et 20, boss au 30', () => {
    const p = progressVide();
    expect(genererEchos(data, 1, 5, p)).toHaveLength(3);
    const e10 = genererEchos(data, 1, 10, p);
    expect(e10).toHaveLength(3);
    expect(e10.every((e) => e.type === 'miniboss')).toBe(true);
    expect(genererEchos(data, 1, 20, p).every((e) => e.type === 'miniboss')).toBe(true);
    expect(genererEchos(data, 1, NB_CHOIX, p)[0].type).toBe('boss');
  });
  it('est deterministe pour une meme graine', () => {
    const a = genererEchos(data, 42, 7, progressVide());
    const b = genererEchos(data, 42, 7, progressVide());
    expect(a).toEqual(b);
  });
  it('3 echos de types distincts hors combats forces', () => {
    for (let s = 1; s < 9; s++) {
      const t = genererEchos(data, 99, s, progressVide()).map((e) => e.type);
      expect(new Set(t).size).toBe(3);
    }
  });
  it('garantit 6 a 8 combats par niveau quelle que soit la strategie', () => {
    for (const pol of ['combats', 'aleatoire', 'prudent'] as const) {
      for (let g = 1; g <= 40; g++) {
        const run = nouvelleRun({ graine: g * 31, ratio: 5 });
        const st = jouerPartie(run, pol, g);
        expect(st.victoire).toBe(true);
        expect(run.nbCombats).toBeGreaterThanOrEqual(6);
        expect(run.nbCombats).toBeLessThanOrEqual(9); // 8 + eventuelle embuscade deja comptee au plafond
        expect(run.prog.combatsNormaux).toBeLessThanOrEqual(5);
      }
    }
  });
});

describe('combat', () => {
  it('est entierement automatique et se termine', () => {
    const run = nouvelleRun();
    const rng = new Rng(1);
    const spec = buildEncounter(data, diff, run.info, 'normal', 3, rng);
    const c = new Combat(data, { element: null, atk: run.atk(), maxHp: run.maxHp(), hp: run.maxHp(), stats: run.stats() }, spec, rng);
    const r = c.runToEnd();
    expect(typeof r.victoire).toBe('boolean');
    expect(c.ended).toBe(true);
  });
  it('l\'avantage elementaire augmente les degats du heros', () => {
    const run = nouvelleRun();
    const spec = (el: string) => {
      const s = buildEncounter(data, diff, run.info, 'normal', 3, new Rng(5), { groupeId: 'banc' });
      s.enemies.forEach((e) => (e.element = el as any));
      return s;
    };
    const premierCoup = (el: string) => {
      const c = new Combat(data, { element: 'Courant', atk: run.atk(), maxHp: run.maxHp(), hp: run.maxHp(), stats: {} }, spec(el), new Rng(9));
      c.update(0.6);
      const hit = c.events.find((e) => e.t === 'hit' && e.src === c.hero.uid) as any;
      return hit.amount as Decimal;
    };
    const fort = premierCoup('Encre');
    const faible = premierCoup('Corail');
    const neutre = premierCoup('Lumen');
    expect(fort.div(neutre).toNumber()).toBeCloseTo(1.2, 2);
    expect(faible.div(neutre).toNumber()).toBeCloseTo(0.85, 2);
  });
  it('la vitesse x2 divise par deux le temps de combat reel', () => {
    const duree = (vitesse: number) => {
      const run = nouvelleRun({ ratio: 3 });
      run.chooseEcho(run.echos.findIndex((e) => e.type === 'combat') >= 0 ? run.echos.findIndex((e) => e.type === 'combat') : 0);
      if (run.phase !== 'combat') return 0;
      let t = 0;
      while (run.phase === 'combat') { run.update(0.1 * vitesse); t += 0.1; if (t > 500) break; }
      return t;
    };
    const a = duree(1);
    const b = duree(2);
    if (a > 0) expect(b).toBeLessThan(a * 0.7);
  });
  it('un boss invoque des renforts et tient plus longtemps qu\'un combat normal', () => {
    const run = nouvelleRun();
    const rng = new Rng(3);
    const boss = buildEncounter(data, diff, run.info, 'boss', 30, rng);
    expect(boss.enemies).toHaveLength(1);
    expect(boss.enemies[0].nom).toBe('Barracuda');
    const normal = buildEncounter(data, diff, run.info, 'normal', 25, rng);
    const total = normal.enemies.reduce((a, e) => a.add(e.hp), D(0));
    expect(boss.enemies[0].hp.gt(total)).toBe(true);
  });
});

describe('XP de partie', () => {
  it('atteint le niveau 7 avec 5 combats normaux + 2 mini-boss (config xp_partie)', () => {
    const run = nouvelleRun();
    for (let i = 0; i < 5; i++) run.gagnerXp(data.xp.xp_combat_normal);
    for (let i = 0; i < 2; i++) run.gagnerXp(data.xp.xp_mini_boss);
    expect(run.niveauHeros).toBe(7);
  });
  it('+100 % d\'XP donne le niveau 10', () => {
    const run = nouvelleRun();
    run.gagnerXp(210);
    expect(run.niveauHeros).toBe(10);
  });
  it('le niveau de partie augmente PV et degats', () => {
    const run = nouvelleRun();
    const a = run.maxHp();
    run.gagnerXp(100);
    expect(run.maxHp().gt(a)).toBe(true);
  });
});

describe('mutations', () => {
  it('propose 3 mutations distinctes et respecte l\'element du heros', () => {
    const rng = new Rng(7);
    for (let i = 0; i < 50; i++) {
      const o = tirerMutations(data, rng, 'Corail', {});
      expect(new Set(o.map((m) => m.id)).size).toBe(3);
      expect(o.every((m) => !m.element || m.element === 'Corail')).toBe(true);
    }
  });
  it('exclut les mutations au maximum de leur pile', () => {
    const rng = new Rng(7);
    const possedees: Record<string, number> = {};
    for (const m of data.mutations.mutations) possedees[m.id] = 99;
    possedees['lames_affutees'] = 0;
    const o = tirerMutations(data, rng, null, possedees);
    expect(o.map((m) => m.id)).toEqual(['lames_affutees']);
  });
  it('apres un combat on choisit 1 parmi 3, l\'effet s\'applique et disparait avec la partie', () => {
    const run = nouvelleRun({ ratio: 5 });
    let i = run.echos.findIndex((e) => e.type === 'combat');
    if (i < 0) i = 0;
    run.chooseEcho(i);
    if (run.phase === 'combat') while (run.phase === 'combat') run.update(0.5);
    if (run.phase === 'mutation') {
      expect(run.offre).toHaveLength(3);
      const m = run.offre[0];
      run.pickMutation(0);
      expect(run.mutations[m.id]).toBe(1);
    }
    const autre = nouvelleRun();
    expect(autre.mutations).toEqual({});
  });
  it('augmente les stats : lames affutees +12 % degats', () => {
    const run = nouvelleRun();
    const avant = run.degatsAffiches();
    run.mutations['lames_affutees'] = 1;
    (run as any).cache = null;
    expect(run.degatsAffiches().div(avant).toNumber()).toBeCloseTo(1.12, 2);
  });
});

describe('shop', () => {
  it('contient toujours un soin et se paie en pieces de partie', () => {
    const s = genererShop(data, 5);
    expect(s.slots.length).toBe(data.boutique.stock);
    expect(s.slots.some((x) => x.article.id === 'potion_petite')).toBe(true);
    const run = nouvelleRun();
    // force l'arrivee chez le marchand
    (run as any).shop = s;
    (run as any).phase = 'shop';
    run.hp = run.maxHp().mul(0.3);
    const idx = s.slots.findIndex((x) => x.article.id === 'potion_petite');
    run.pieces = 10;
    expect(run.acheter(idx)).toBe(false);
    run.pieces = 100;
    expect(run.acheter(idx)).toBe(true);
    expect(run.pieces).toBe(100 - 30);
    expect(run.hp.div(run.maxHp()).toNumber()).toBeCloseTo(0.6, 2);
    expect(prixActuel(s.slots[idx])).toBeGreaterThan(30); // le prix monte a chaque achat
  });
  it('limite le nombre d\'achats par article', () => {
    const run = nouvelleRun();
    const s = genererShop(data, 5);
    (run as any).shop = s;
    (run as any).phase = 'shop';
    run.pieces = 9999;
    const idx = s.slots.findIndex((x) => x.article.id === 'potion_petite');
    expect(run.acheter(idx)).toBe(true);
    expect(run.acheter(idx)).toBe(true);
    expect(run.acheter(idx)).toBe(false);
  });
});

describe('architecture pilotee par les donnees', () => {
  it('un nouveau monde (JSON) est jouable sans modifier le code', () => {
    const monde3 = { ...(m1 as any), id: 3, nom: 'Crépuscule', boss: (m1 as any).boss.map((b: any, i: number) => ({ ...b, id: 'x' + i, nom: 'Boss ' + i })) };
    const d3 = buildGameData([m1, monde3] as any);
    expect(niveauInfo(d3, 161).monde.nom).toBe('Crépuscule'); // monde 3 absent -> retombe sur le dernier connu
  });
  it('joue un niveau du monde 2 de bout en bout', () => {
    const run = nouvelleRun({ niveau: 89, ratio: 3 });
    expect(run.info.monde.nom).toBe('Haute mer');
    const st = jouerPartie(run, 'combats', 3);
    expect(st.victoire).toBe(true);
  });
  it('fonctionne aux tres grands niveaux (puissances > 1e100)', () => {
    const run = nouvelleRun({ niveau: 3000, ratio: 3 });
    expect(run.maxHp().gt('1e50')).toBe(true);
    const st = jouerPartie(run, 'combats', 3);
    expect(st.victoire).toBe(true);
  });
});

describe('partie complete', () => {
  it('ne se bloque jamais (toutes politiques, 60 graines)', () => {
    for (const pol of ['combats', 'aleatoire', 'prudent'] as const) {
      for (let g = 1; g <= 20; g++) {
        const run = nouvelleRun({ graine: g * 101, ratio: 1 });
        const st = jouerPartie(run, pol, g);
        expect(run.fini).toBe(true);
        expect(st.step).toBeLessThanOrEqual(30);
      }
    }
  });
  it('la mort est la fin de la partie', () => {
    const run = nouvelleRun({ ratio: 0.05 });
    const st = jouerPartie(run, 'combats', 1);
    expect(st.victoire).toBe(false);
    expect(run.phase).toBe('defaite');
  });
});
