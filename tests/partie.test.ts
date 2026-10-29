// Sauvegarde de la partie en cours a chaque tour (GDD 4.1) et marchand recurrent (GDD 5.5).
import { describe, expect, it } from 'vitest';
import { data, diff, nouvelleRun } from './helpers';
import { Run } from '../src/core/run';
import { jouerPartie } from '../src/core/bot';
import { Rng } from '../src/core/rng';
import { choisirEcho } from '../src/core/bot';
import { nouveauProfil } from '../src/core/profile';
import { exporter, importer } from '../src/core/save';

/** Joue avec le bot jusqu'au choix de Sonar `etape` (ou la fin). */
function jouerJusqua(run: Run, etape: number, graineBot: number): void {
  const rng = new Rng(graineBot);
  let garde = 0;
  while (!run.fini && !(run.phase === 'sonar' && run.step >= etape)) {
    if (garde++ > 100000) throw new Error('blocage');
    switch (run.phase) {
      case 'sonar': run.chooseEcho(choisirEcho(run, 'aleatoire', rng)); break;
      case 'combat': run.update(0.25); break;
      case 'mutation': run.pickMutation(rng.int(0, run.offre.length - 1)); break;
      case 'shop': run.acheter(rng.int(0, run.shop!.slots.length - 1)); if (run.phase === 'shop') run.quitterShop(); break;
      case 'rencontre': {
        const ok = run.rencontre!.options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
        run.choisirRencontre(ok[rng.int(0, ok.length - 1)]);
        break;
      }
    }
  }
}

describe('sauvegarde de la partie en cours', () => {
  it('reprendre une sauvegarde redonne exactement la meme partie (mutations, PV, pieces, XP, Sonar, hasard)', () => {
    for (const [graine, etape] of [[11, 6], [12, 14], [13, 23]]) {
      const a = nouvelleRun({ graine, ratio: 1.3 });
      jouerJusqua(a, etape, graine);
      if (a.fini) continue;
      const texte = JSON.stringify(a.sauvegarde()); // passe par du texte, comme le stockage
      const b = Run.restaurer(data, diff, JSON.parse(texte));
      expect(b.step).toBe(a.step);
      expect(b.echos).toEqual(a.echos);
      expect(b.hp.toString()).toBe(a.hp.toString());
      expect(b.maxHp().toString()).toBe(a.maxHp().toString());
      expect([b.pieces, b.xp, b.niveauHeros, b.mutations]).toEqual([a.pieces, a.xp, a.niveauHeros, a.mutations]);
      const ra = jouerPartie(a, 'aleatoire', 99);
      const rb = jouerPartie(b, 'aleatoire', 99);
      expect(rb).toEqual(ra);
      expect(b.hp.toString()).toBe(a.hp.toString());
    }
  });
  it('un echo deja choisi est rejoue a la reprise (pas de second choix)', () => {
    const a = nouvelleRun({ graine: 31 });
    jouerJusqua(a, 4, 31);
    const sv = { ...a.sauvegarde(), choix: 1 };
    a.chooseEcho(1);
    const b = Run.restaurer(data, diff, JSON.parse(JSON.stringify(sv)));
    expect(b.phase).toBe(a.phase);
    expect(b.step).toBe(a.step);
    expect(jouerPartie(b, 'aleatoire', 3)).toEqual(jouerPartie(a, 'aleatoire', 3));
  });
  it('ne se sauvegarde qu\'au choix de Sonar', () => {
    const run = nouvelleRun();
    expect(() => run.sauvegarde()).not.toThrow();
    run.chooseEcho(Math.max(0, run.echos.findIndex((e) => e.type === 'combat')));
    if (run.phase !== 'sonar') expect(() => run.sauvegarde()).toThrow();
  });
  it('la partie en cours survit a l\'export / import du profil', () => {
    const run = nouvelleRun({ graine: 5 });
    jouerJusqua(run, 8, 5);
    const p = nouveauProfil(data, 0);
    p.partieEnCours = run.sauvegarde();
    const q = importer(data, exporter(p), 0);
    expect(q.partieEnCours).toEqual(p.partieEnCours);
    expect(Run.restaurer(data, diff, q.partieEnCours!).step).toBe(run.step);
  });
});

describe('marchand', () => {
  it('peut revenir plusieurs fois dans la partie, avec le meme stock', () => {
    const run = nouvelleRun({ graine: 21 });
    run.echos = [{ type: 'marchand', seed: 1 }, { type: 'marchand', seed: 2 }, { type: 'marchand', seed: 3 }];
    run.chooseEcho(0);
    expect(run.phase).toBe('shop');
    const stock = run.shop!.slots.map((s) => s.article.id);
    run.pieces = 1000;
    const i = run.shop!.slots.findIndex((s) => s.article.effet.type === 'pv_pct');
    expect(run.acheter(i)).toBe(true);
    run.quitterShop();
    expect(run.phase).toBe('sonar');
    // sauvegarde / reprise entre les deux visites
    const b = Run.restaurer(data, diff, JSON.parse(JSON.stringify(run.sauvegarde())));
    b.echos = [{ type: 'marchand', seed: 4 }, { type: 'marchand', seed: 5 }, { type: 'marchand', seed: 6 }];
    b.chooseEcho(1);
    expect(b.phase).toBe('shop');
    expect(b.shop!.slots.map((s) => s.article.id)).toEqual(stock);
    expect(b.shop!.slots[i].achete).toBe(1);
  });
});
