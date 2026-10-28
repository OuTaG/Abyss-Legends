import { buildGameData } from '../src/data/build';
import { Difficulty } from '../src/core/difficulty';
import { Run, type RunOptions } from '../src/core/run';
import m1 from '../content/worlds/monde1.json';
import m2 from '../content/worlds/monde2.json';

export const data = buildGameData([m1, m2] as any);
export const diff = new Difficulty(data);
export const nouvelleRun = (o: Partial<RunOptions> = {}) =>
  new Run(data, diff, { niveau: 1, heroId: 'Plongeur', graine: 1234, ratio: 1, ...o });
