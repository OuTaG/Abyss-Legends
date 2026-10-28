// Calibrage / banc d'essai du combat : joue N parties automatiques et resume les taux de victoire, durees, etc.
// Usage : npx tsx scripts/calibrer.ts [niveau] [nbParties] [ratio] [heroId] [politique]
import { buildGameData } from '../src/data/build';
import { Difficulty } from '../src/core/difficulty';
import { Run } from '../src/core/run';
import { jouerPartie, type Politique } from '../src/core/bot';
import m1 from '../content/worlds/monde1.json';
import m2 from '../content/worlds/monde2.json';

const data = buildGameData([m1, m2] as any);
const diff = new Difficulty(data);
const niveau = Number(process.argv[2] ?? 1);
const n = Number(process.argv[3] ?? 200);
const ratio = Number(process.argv[4] ?? 1);
const hero = process.argv[5] ?? 'Plongeur';
const politique = (process.argv[6] ?? 'combats') as Politique;

let vict = 0;
const steps: number[] = [];
const combats: number[] = [];
const lv: number[] = [];
const muts: number[] = [];
const dur: Record<string, number[]> = {};
const morts: Record<number, number> = {};
for (let g = 1; g <= n; g++) {
  const run = new Run(data, diff, { niveau, heroId: hero, graine: g * 7919, ratio });
  const kinds: string[] = [];
  const st = jouerPartie(run, politique, g);
  if (st.victoire) vict++;
  else morts[st.step] = (morts[st.step] ?? 0) + 1;
  steps.push(st.step); combats.push(st.combats); lv.push(st.niveauHeros); muts.push(st.mutations);
  void kinds;
  st.dureeCombats.forEach((d, i) => { (dur[i < 3 ? 'c' + i : 'autres'] ??= []).push(d); });
}
const moy = (a: number[]) => (a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)).toFixed(2);
console.log(`niveau ${niveau} ratio ${ratio} hero ${hero} politique ${politique} parties ${n}`);
console.log(`victoires ${(100 * vict / n).toFixed(1)} %  choix atteint moyen ${moy(steps)}  combats ${moy(combats)}  niveau heros ${moy(lv)}  mutations ${moy(muts)}`);
console.log('duree des combats (s, x1) :', Object.entries(dur).map(([k, v]) => `${k}=${moy(v)}`).join(' '));
console.log('morts par choix :', JSON.stringify(morts));
