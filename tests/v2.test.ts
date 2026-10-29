// Decisions recentes du porteur : Sonar a incertitude complete, traversee non acceleree, seuls heros et monture
// touchables, energie « 45/60 », couleurs de rarete, traductions.
import { describe, expect, it } from 'vitest';
import { data, diff, nouvelleRun } from './helpers';
import { genererEchos, progressVide, NB_CHOIX, NB_ECHOS } from '../src/core/sonar';
import { Combat } from '../src/core/combat';
import { buildEncounter } from '../src/core/enemies';
import { Rng } from '../src/core/rng';
import { jouerPartie } from '../src/core/bot';
import { DUREE_TRAVERSEE_S, Traversee, facteurTemps } from '../src/core/rythme';
import { nouveauProfil, energieActuelle } from '../src/core/profile';
import { COULEUR_RARETE, HALO_RANG, RARETES } from '../src/ui/theme';
import { DICTIONNAIRES, LANGUES, definirLangue, detecterLangue, t } from '../src/i18n';
import { texteEnergie } from '../src/ui/menu';

describe('Sonar : incertitude complete', () => {
  it('toujours 3 echos, a chaque etape d\'une partie complete', () => {
    for (const graine of [1, 2, 3]) {
      const run = nouvelleRun({ graine, ratio: 1.3 });
      const vus: number[] = [];
      const orig = run.chooseEcho.bind(run);
      run.chooseEcho = (i: number) => { vus.push(run.echos.length); orig(i); };
      jouerPartie(run, 'aleatoire', graine);
      expect(vus.length).toBeGreaterThan(5);
      expect(vus.every((n) => n === NB_ECHOS)).toBe(true);
    }
  });
  it('aux choix 10, 20 et 30, les 3 echos menent tous au mini-boss / boss', () => {
    for (const graine of [5, 6, 7]) {
      const e10 = genererEchos(data, graine, 10, progressVide());
      const e20 = genererEchos(data, graine, 20, progressVide());
      const e30 = genererEchos(data, graine, NB_CHOIX, progressVide());
      for (const [e, type] of [[e10, 'miniboss'], [e20, 'miniboss'], [e30, 'boss']] as const) {
        expect(e).toHaveLength(3);
        expect(e.every((x) => x.type === type)).toBe(true);
      }
    }
  });
  it('n\'importe lequel des 3 echos du choix 30 lance le combat de boss', () => {
    for (let i = 0; i < 3; i++) {
      const run = nouvelleRun();
      run.step = NB_CHOIX - 1;
      (run as any).nextStep();
      run.chooseEcho(i);
      expect(run.phase).toBe('combat');
      expect(run.combatKind).toBe('boss');
    }
  });
  it('aucun choix possible pendant le combat', () => {
    const run = nouvelleRun();
    const i = Math.max(0, run.echos.findIndex((e) => e.type === 'combat'));
    run.chooseEcho(i);
    if (run.phase === 'combat') expect(() => run.chooseEcho(0)).toThrow();
  });
});

describe('Combat : seuls le heros et la monture peuvent etre touches', () => {
  it('aucun coup ennemi ne vise un pet ou un gardien ; la monture est parfois touchee', () => {
    let coupsMonture = 0, coupsHeros = 0;
    for (let g = 0; g < 12; g++) {
      const run = nouvelleRun({ graine: 100 + g });
      const spec = buildEncounter(data, diff, run.info, g % 3 === 0 ? 'miniboss' : 'normal', 12, new Rng(g));
      const c = new Combat(data, { element: null, atk: run.atk(), maxHp: run.maxHp(), hp: run.maxHp(), stats: run.stats() }, spec, new Rng(g + 7));
      const intouchables = new Set(c.allies.filter((a) => a.kind === 'pet' || a.kind === 'guardian').map((a) => a.uid));
      const ennemis = new Set(c.enemies.map((e) => e.uid));
      while (!c.ended && c.time < 400) {
        c.update(0.5);
        for (const ev of c.drainEvents()) {
          if ((ev.t === 'hit' || ev.t === 'attack' || ev.t === 'projectile' || ev.t === 'miss') && 'src' in ev && ennemis.has(ev.src)) {
            expect(intouchables.has(ev.dst)).toBe(false);
            expect([c.hero.uid, c.mount.uid]).toContain(ev.dst);
            if (ev.t === 'hit') { if (ev.dst === c.mount.uid) coupsMonture++; else coupsHeros++; }
          }
        }
      }
    }
    expect(coupsMonture).toBeGreaterThan(0);
    expect(coupsHeros).toBeGreaterThan(coupsMonture);
  });
  it('une monture hors de combat n\'attaque plus et n\'est plus visee', () => {
    const run = nouvelleRun();
    const spec = buildEncounter(data, diff, run.info, 'boss', 30, new Rng(3));
    const c = new Combat(data, { element: null, atk: run.atk().mul(0.01), maxHp: run.maxHp().mul(50), hp: run.maxHp().mul(50), stats: {} }, spec, new Rng(4));
    c.mount.hp = c.mount.maxHp.mul(1e-9);
    let ko = false;
    while (!c.ended && c.time < 120) {
      c.update(0.25);
      for (const ev of c.drainEvents()) {
        if (ev.t === 'death' && ev.uid === c.mount.uid) ko = true;
        if (ko && ev.t === 'attack' && 'src' in ev) {
          expect(ev.src).not.toBe(c.mount.uid);
          expect(ev.dst).not.toBe(c.mount.uid);
        }
      }
    }
    expect(ko).toBe(true);
  });
});

describe('Rythme : l\'abonnement n\'accelere que les combats', () => {
  it('facteurs de temps par scene', () => {
    expect(facteurTemps('combat', 2)).toBe(2);
    expect(facteurTemps('traversee', 2)).toBe(1);
    expect(facteurTemps('sonar', 2)).toBe(1);
    expect(facteurTemps('choix', 2)).toBe(1);
  });
  it('la traversee dure ~2,5 s avec ou sans abonnement', () => {
    expect(DUREE_TRAVERSEE_S).toBeCloseTo(2.5);
    for (const v of [1, 2]) {
      const tr = new Traversee();
      let n = 0;
      while (!tr.avancer(1 / 60, v)) n++;
      expect((n + 1) / 60).toBeCloseTo(2.5, 1);
    }
  });
});

describe('Interface : energie, raretes, langues', () => {
  it('energie affichee « 45/60 » et sans recharge au-dela du maximum', () => {
    expect(texteEnergie(45, 60)).toBe('45/60');
    const p = nouveauProfil(data, 0);
    p.energie = { valeur: 75, majLe: 0 };
    expect(energieActuelle(p, data, 10 * 3600_000)).toBe(75);
    expect(texteEnergie(energieActuelle(p, data, 0), data.energie.plafond_regeneration)).toBe('75/60');
  });
  it('couleurs des raretes decidees par le porteur (theme central)', () => {
    expect(RARETES).toEqual(['commun', 'original', 'rare', 'epique', 'legendaire', 'mythique']);
    const teinte = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      if (d < 0.08) return 'gris';
      const hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      const deg = (hh * 60 + 360) % 360;
      return deg < 20 || deg > 340 ? 'rouge' : deg < 70 ? 'jaune' : deg < 170 ? 'vert' : deg < 250 ? 'bleu' : 'violet';
    };
    expect(RARETES.map((r) => teinte(COULEUR_RARETE[r]))).toEqual(['gris', 'vert', 'bleu', 'violet', 'jaune', 'rouge']);
    expect(HALO_RANG.S.toLowerCase()).toBe('#ffffff');
    expect(teinte(HALO_RANG.SS)).toBe('rouge');
  });
  it('fr et en ont les memes cles ; ja / ko / zh-Hant ont la structure (sans traduction inventee)', () => {
    const cles = Object.keys(DICTIONNAIRES.fr).sort();
    expect(Object.keys(DICTIONNAIRES.en).sort()).toEqual(cles);
    for (const l of ['ja', 'ko', 'zh-Hant'] as const) {
      expect(Object.keys(DICTIONNAIRES[l]).sort()).toEqual(cles);
      expect(Object.values(DICTIONNAIRES[l]).every((v) => v === '')).toBe(true);
    }
    expect(Object.values(DICTIONNAIRES.fr).every((v) => v.length > 0)).toBe(true);
    expect(LANGUES.map((l) => l.code)).toEqual(['fr', 'en', 'ja', 'ko', 'zh-Hant']);
  });
  it('replis : cle vide -> anglais ; detection de la langue de l\'appareil', () => {
    definirLangue('ja');
    expect(t('nav.boutique')).toBe('Shop');
    definirLangue('fr');
    expect(t('nav.boutique')).toBe('Boutique');
    expect(t('menu.niveau_n', { n: 12 })).toBe('Niveau 12');
    expect(detecterLangue(['zh-TW'])).toBe('zh-Hant');
    expect(detecterLangue(['zh-CN', 'ko-KR'])).toBe('ko');
    expect(detecterLangue(['de-DE'])).toBe('en');
    expect(detecterLangue(['fr-CA'])).toBe('fr');
  });
});
